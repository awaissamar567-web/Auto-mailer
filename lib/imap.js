import { ImapFlow } from 'imapflow';
import { cleanReply, htmlToText, hardTag, snippetOf } from './replies';

// Reads replies for one Gmail account over IMAP, using the same App Password as SMTP.
// Only messages tied to the creator list are fetched: mail from a creator's address,
// mail that references one of our sent Message-IDs, and bounce notices.

const HEADERS = ['references', 'in-reply-to', 'auto-submitted', 'x-autoreply', 'x-autorespond', 'precedence', 'x-failed-recipients'];
const MAX_MESSAGES = 400;

function parseHeaders(buf) {
  const out = {};
  const raw = String(buf || '').replace(/\r\n[ \t]+/g, ' ');
  for (const line of raw.split(/\r\n/)) {
    const i = line.indexOf(':');
    if (i > 0) out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}

function msgIds(s) {
  return String(s || '').match(/<[^<>\s]+>/g) || [];
}

function textPart(node) {
  let plain = null, html = null;
  (function walk(n) {
    if (!n) return;
    if (n.childNodes && n.childNodes.length) return n.childNodes.forEach(walk);
    if (n.disposition === 'attachment') return;
    const type = String(n.type || '').toLowerCase();
    if (type === 'text/plain' && !plain) plain = n;
    if (type === 'text/html' && !html) html = n;
  })(node);
  const pick = plain || html;
  return pick ? { part: pick.part || '1', html: !plain } : null;
}

async function readStream(stream, max) {
  const chunks = [];
  let size = 0;
  for await (const c of stream) {
    chunks.push(c);
    size += c.length;
    if (size >= max) break;
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function mapImapError(e, acct) {
  const text = String((e && (e.responseText || e.response || e.message)) || '');
  if ((e && e.authenticationFailed) || /AUTHENTICATIONFAILED|Invalid credentials|Application-specific password/i.test(text)) {
    return { code: 'auth', message: 'Gmail rejected the inbox login for ' + acct.user + '. Check its App Password in Vercel.' };
  }
  if (/IMAP access is disabled|not enabled for IMAP/i.test(text)) {
    return { code: 'imap_off', message: 'IMAP is turned off for ' + acct.user + '. Turn it on in Gmail settings, under Forwarding and POP/IMAP.' };
  }
  if (/timeout|ETIMEDOUT|ECONN|ENOTFOUND|EAI_AGAIN|socket/i.test(text + ' ' + ((e && e.code) || ''))) {
    return { code: 'network', message: 'Could not reach the Gmail inbox for ' + acct.user + '. Try again in a minute.' };
  }
  return { code: 'unknown', message: 'Could not read the inbox for ' + acct.user + '. ' + text.replace(/\s+/g, ' ').slice(0, 140) };
}

// contacts: [{ id, email, messageId, sentAt }]. Returns one entry per contact that has mail:
//   { id, kind: 'reply' | 'auto' | 'bounce', tag?, text, subject, at, from, msgId }
export async function readReplies(acct, contacts) {
  if (process.env.MAIL_TEST_JSON === '1') return [];
  const self = acct.user.toLowerCase();
  const byEmail = new Map(), byMsgId = new Map();
  let earliest = Date.now();
  for (const c of contacts) {
    if (c.email) byEmail.set(c.email, c);
    if (c.messageId) byMsgId.set(c.messageId, c);
    if (c.sentAt && c.sentAt < earliest) earliest = c.sentAt;
  }
  const since = new Date(earliest - 36 * 3600000);

  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: acct.user, pass: acct.pass },
    logger: false, connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 30000,
  });
  client.on('error', () => {});
  await client.connect();
  try {
    const boxes = await client.list();
    const all = boxes.find((b) => b.specialUse === '\\All');
    const lock = await client.getMailboxLock(all ? all.path : 'INBOX', { readOnly: true });
    try {
      const uids = new Set();
      const run = async (query) => {
        const found = await client.search({ since, ...query }, { uid: true });
        (found || []).forEach((u) => uids.add(u));
      };
      const emails = [...byEmail.keys()], ids = [...byMsgId.keys()];
      for (let i = 0; i < emails.length; i += 20) {
        const group = emails.slice(i, i + 20).map((from) => ({ from }));
        await run(group.length > 1 ? { or: group } : group[0]);
      }
      await run({ or: [{ from: 'mailer-daemon' }, { from: 'postmaster' }] });
      // Replies sent from a different address (a manager, an assistant) still reference our Message-ID.
      for (let i = 0; i < ids.length; i += 12) {
        const group = ids.slice(i, i + 12).map((id) => ({ header: { references: id } }));
        try { await run(group.length > 1 ? { or: group } : group[0]); } catch { /* header search is best effort */ }
      }

      const list = [...uids].sort((a, b) => b - a).slice(0, MAX_MESSAGES);
      const matched = [];
      if (list.length) {
        for await (const m of client.fetch(list, { uid: true, envelope: true, internalDate: true, bodyStructure: true, headers: HEADERS }, { uid: true })) {
          const env = m.envelope || {};
          const from = (env.from && env.from[0]) || {};
          const fromAddr = String(from.address || '').toLowerCase();
          if (!fromAddr || fromAddr === self) continue;
          const headers = parseHeaders(m.headers);
          const refs = msgIds(headers.references).concat(msgIds(headers['in-reply-to']), msgIds(env.inReplyTo));
          const failed = String(headers['x-failed-recipients'] || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
          let c = null;
          for (const r of refs) { if (byMsgId.has(r)) { c = byMsgId.get(r); break; } }
          if (!c) for (const f of failed) { if (byEmail.has(f)) { c = byEmail.get(f); break; } }
          if (!c) c = byEmail.get(fromAddr) || null;
          const at = new Date(m.internalDate || env.date || 0).getTime() || 0;
          if (!c || (c.sentAt && at < c.sentAt - 120000)) continue;
          matched.push({ c, uid: m.uid, at, fromAddr, fromName: from.name || '', subject: env.subject || '', msgId: env.messageId || '', headers, part: textPart(m.bodyStructure) });
        }
      }

      // Newest first, and only read bodies until every contact has an answer.
      matched.sort((a, b) => b.at - a.at);
      const best = new Map();
      const rank = { reply: 3, bounce: 2, auto: 1 };
      for (const m of matched) {
        const cur = best.get(m.c.id);
        if (cur && cur.kind === 'reply') continue;
        let text = '';
        if (m.part) {
          try {
            const dl = await client.download(String(m.uid), m.part.part, { uid: true, maxBytes: 40000 });
            if (dl && dl.content) text = await readStream(dl.content, 40000);
            if (m.part.html) text = htmlToText(text);
          } catch { /* keep going with the subject only */ }
        }
        const hard = hardTag({ fromAddr: m.fromAddr, fromName: m.fromName, subject: m.subject, headers: m.headers, text: cleanReply(text) });
        if (hard === 'ignore') continue;
        const kind = hard === 'bounced' ? 'bounce' : hard === 'auto_reply' ? 'auto' : 'reply';
        if (cur && rank[cur.kind] >= rank[kind]) continue;
        const body = kind === 'bounce' ? text : cleanReply(text);
        best.set(m.c.id, {
          id: m.c.id, kind, tag: hard || null, at: m.at, from: m.fromAddr, msgId: m.msgId,
          subject: snippetOf(m.subject, 200), text: snippetOf(body, 1500),
        });
      }
      return [...best.values()];
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch { client.close(); }
  }
}
