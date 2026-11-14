import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { accounts, findAccount, EMAIL_RE } from '../../../lib/mail';
import { readReplies, mapImapError } from '../../../lib/imap';
import { tagReplies, aiEnabled, snippetOf } from '../../../lib/replies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const fail = (status, code, message) => NextResponse.json({ ok: false, code, message }, { status });
const MSG_ID = /^<[^<>\s]+@[^<>\s]+>$/;

// Body: { contacts: [{ id, email, messageId, sentAt, from, known }] }
//   from  = the account that sent the first email, known = Message-ID of the reply already stored.
// Returns: { ok, ai, results: [{ id, same } | { id, tag, soft, by, snippet, at, from, msgId }], errors: [{ account, code, message }] }
export async function POST(request) {
  if (!(await getSession(request))) return fail(401, 'unauthorized', 'Log in again.');
  if (!accounts().length) return fail(500, 'config', 'Gmail is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings, then redeploy.');

  let b;
  try { b = await request.json(); } catch { return fail(400, 'invalid', 'The request was not valid JSON.'); }
  const input = Array.isArray(b && b.contacts) ? b.contacts.slice(0, 500) : [];

  const groups = new Map();
  const known = new Map();
  const errors = [];
  const gone = new Set();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const id = String(raw.id || '').slice(0, 64);
    const email = String(raw.email || '').trim().toLowerCase();
    const sentAt = Number(raw.sentAt) || 0;
    if (!id || !EMAIL_RE.test(email) || !sentAt) continue;
    const acct = findAccount(raw.from);
    if (!acct) { gone.add(String(raw.from || '')); continue; }
    if (!groups.has(acct.id)) groups.set(acct.id, { acct, list: [] });
    groups.get(acct.id).list.push({ id, email, sentAt, messageId: MSG_ID.test(raw.messageId) ? raw.messageId : '' });
    if (typeof raw.known === 'string' && raw.known) known.set(id, raw.known);
  }
  gone.forEach((a) => errors.push({ account: a, code: 'account', message: 'The Gmail account ' + a + ' is not set up on the server anymore, so its replies were not checked.' }));

  const found = [];
  await Promise.all([...groups.values()].map(async ({ acct, list }) => {
    try {
      found.push(...(await readReplies(acct, list)));
    } catch (e) {
      errors.push({ account: acct.id, ...mapImapError(e, acct) });
    }
  }));

  const results = [];
  const toTag = [];
  for (const f of found) {
    if (f.msgId && known.get(f.id) === f.msgId) { results.push({ id: f.id, same: true }); continue; }
    const base = { id: f.id, at: f.at, from: f.from, msgId: MSG_ID.test(f.msgId) ? f.msgId : '', snippet: snippetOf(f.text || f.subject, 400) };
    if (f.kind === 'bounce') results.push({ ...base, tag: 'bounced', soft: false, by: 'rules' });
    else if (f.kind === 'auto') results.push({ ...base, tag: 'auto_reply', soft: false, by: 'rules' });
    else if (f.tag === 'do_not_contact') results.push({ ...base, tag: 'do_not_contact', soft: false, by: 'rules' });
    else toTag.push({ base, subject: f.subject, text: f.text });
  }
  const tags = await tagReplies(toTag.map((t) => ({ subject: t.subject, text: t.text })));
  toTag.forEach((t, i) => results.push({ ...t.base, ...tags[i] }));

  if (!found.length && errors.length && errors.length >= groups.size + gone.size) {
    return NextResponse.json({ ok: false, code: errors[0].code, message: errors[0].message, errors }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ai: aiEnabled(), checked: input.length, results, errors });
}
