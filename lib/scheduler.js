import { accounts, getTransport, mapMailError } from './mail';
import { redis, stateKey, onceKey, claimOnce, settleOnce } from './store';
import { readReplies, mapImapError } from './imap';
import { tagReplies, snippetOf } from './replies';
import {
  zoneOf, nowIn, compose, validEmail, tagOf, canFirst, canFollowDue, canNext, canCounter,
  campById, campStats, campOpen, inWorkHours, sentToday, mergeState,
} from './engine';

// One scheduler run: lock, read inboxes and tag replies, then send what is due, one email per gap,
// saving after every send. Called by /api/cron (Vercel Cron, an outside scheduler, or Run now).

const STOP_CODES = ['auth', 'limit', 'throttled', 'network', 'config', 'account'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const cronUser = () => (process.env.APP_USERNAME || 'admin').trim().toLowerCase();

export function autoSettings(S) {
  const a = (S.settings && S.settings.auto) || {};
  return { on: a.on !== false, follow: a.follow !== false, next: a.next !== false, counter: a.counter === true };
}

async function load(user) {
  const raw = await redis(['GET', stateKey(user)]);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}
// Re-read the saved blob and fold this run's progress into it, so edits made in the browser meanwhile survive.
async function persist(user, S) {
  const latest = await load(user);
  const merged = mergeState(S, latest || S);
  merged.updatedAt = Date.now();
  await redis(['SET', stateKey(user), JSON.stringify(merged)]);
  return merged;
}

function applyTag(c, r) {
  if (c.reply && c.reply.by === 'manual' && (!r.at || r.at <= (c.reply.at || 0))) return false;
  if (c.dnc && r.tag !== 'do_not_contact') return false;
  const tag = r.tag;
  c.reply = { tag, soft: !!r.soft, by: r.by || 'rules', snippet: String(r.snippet || ''), at: Number(r.at) || Date.now(), from: String(r.from || ''), msgId: String(r.msgId || '') };
  c.dnc = tag === 'do_not_contact';
  c.bounced = tag === 'bounced';
  if (tag === 'bounced') { if (c.status !== 'failed') c.prevStatus = c.status; c.status = 'failed'; c.error = 'This address bounced. The email was not delivered.'; }
  else if (tag === 'auto_reply') { if (c.status === 'replied' || c.status === 'failed') c.status = c.followAt ? 'followed' : 'sent'; c.error = ''; }
  else { if (c.status !== 'replied') { c.prevStatus = c.status; c.repliedAt = c.reply.at; } c.status = 'replied'; c.error = ''; }
  return true;
}

async function checkInbox(S, log) {
  const primary = (accounts()[0] || {}).id;
  const byAcct = new Map();
  for (const c of S.contacts || []) {
    if (c.example || !c.sentAt || !validEmail(c)) continue;
    const from = c.sentFrom || primary;
    const acct = accounts().find((a) => a.id === from);
    if (!acct) continue;
    if (!byAcct.has(acct.id)) byAcct.set(acct.id, { acct, list: [] });
    byAcct.get(acct.id).list.push({ id: c.id, email: String(c.email).trim().toLowerCase(), messageId: c.messageId || '', sentAt: c.sentAt });
  }
  const found = [];
  await Promise.all([...byAcct.values()].map(async ({ acct, list }) => {
    try { found.push(...(await readReplies(acct, list))); }
    catch (e) { log.errors.push(mapImapError(e, acct).message); }
  }));
  const byId = new Map((S.contacts || []).map((c) => [c.id, c]));
  const results = [], toTag = [];
  for (const f of found) {
    const c = byId.get(f.id); if (!c) continue;
    if (f.msgId && c.reply && c.reply.msgId === f.msgId) continue;
    const base = { id: f.id, at: f.at, from: f.from, msgId: f.msgId || '', snippet: snippetOf(f.text || f.subject, 400) };
    if (f.kind === 'bounce') results.push({ ...base, tag: 'bounced', by: 'rules' });
    else if (f.kind === 'auto') results.push({ ...base, tag: 'auto_reply', by: 'rules' });
    else if (f.tag === 'do_not_contact') results.push({ ...base, tag: 'do_not_contact', by: 'rules' });
    else toTag.push({ base, subject: f.subject, text: f.text });
  }
  const tags = await tagReplies(toTag.map((t) => ({ subject: t.subject, text: t.text })));
  toTag.forEach((t, i) => results.push({ ...t.base, ...tags[i] }));
  for (const r of results) {
    const c = byId.get(r.id);
    if (c && applyTag(c, r) && r.tag !== 'auto_reply') {
      log.replies++;
      if (['interested', 'question', 'not_interested'].indexOf(r.tag) >= 0) log.news.push({ who: c.name || c.handle || c.email, tag: r.tag, snippet: c.reply.snippet });
    }
  }
  S.checkedAt = Date.now();
}

// The next email to send, or null. Priority: next steps, counter-questions, follow-ups, then campaigns.
function nextJob(S, ctx) {
  const { tz, auto, blocked, primary } = ctx;
  const cap = Number(S.settings && S.settings.cap) || 40;
  const live = accounts().filter((a) => !blocked.has(a.id) && sentToday(S, a.id, tz, primary) < cap);
  if (!live.length) return null;
  const has = (id) => live.find((a) => a.id === id);
  const contacts = (S.contacts || []).filter((c) => !c.example && !ctx.tried.has(c.id));
  if (auto.on && inWorkHours(S, tz)) {
    const kinds = [];
    if (auto.next) kinds.push(['next', canNext]);
    if (auto.counter) kinds.push(['counter', canCounter]);
    if (auto.follow) kinds.push(['followup', canFollowDue]);
    for (const [kind, test] of kinds) {
      for (const c of contacts) {
        if (!test(S, c)) continue;
        const a = has(c.sentFrom || primary);
        if (a) return { kind, c, acct: a };
      }
    }
  }
  if (!auto.on) return null;
  const camps = (S.campaigns || []).filter((k) => campOpen(S, k, tz))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : 1));
  for (const k of camps) {
    const c = contacts.find((x) => x.campaignId === k.id && canFirst(S, x));
    if (!c) continue;
    let a = null;
    if (k.sender && k.sender !== 'rotate') a = has(k.sender);
    else {
      const mode = S.settings && S.settings.sender;
      if (mode && mode !== 'rotate') a = has(mode);
      else a = live.slice().sort((x, y) => sentToday(S, x.id, tz, primary) - sentToday(S, y.id, tz, primary))[0];
    }
    if (a) return { kind: 'first', c, acct: a, camp: k };
  }
  return null;
}

function stepKey(c, kind) {
  if (kind === 'first') return c.id + ':first';
  if (kind === 'followup') return c.id + ':follow' + ((c.followCount || 0) + 1);
  return c.id + ':' + kind;
}

function record(c, kind, acct, messageId, comp) {
  const now = Date.now();
  if (kind === 'first') { c.subject = comp.subject; c.tpl = comp.tplId; c.messageId = messageId || ''; c.status = 'sent'; c.sentAt = now; c.sentFrom = acct.id; }
  else if (kind === 'followup') { c.status = 'followed'; c.followAt = now; c.followCount = (c.followCount || 0) + 1; c.followFrom = acct.id; }
  else if (kind === 'next') c.nextAt = now;
  else if (kind === 'counter') c.counterAt = now;
  c.error = '';
  c.by = 'scheduler';
}

async function sendJob(user, S, job, log, ctx) {
  const { c, kind, acct } = job;
  const comp = compose(S, c, kind);
  const message = {
    from: acct.fromName ? { name: acct.fromName, address: acct.user } : acct.user,
    to: String(c.email).trim(), subject: comp.subject.replace(/[\r\n]+/g, ' ').slice(0, 250), text: comp.text,
  };
  if (kind !== 'first' && c.messageId) {
    const theirs = kind !== 'followup' && c.reply && c.reply.msgId;
    message.inReplyTo = theirs || c.messageId;
    message.references = theirs ? [c.messageId, theirs] : [c.messageId];
  }
  const key = onceKey(user, stepKey(c, kind));
  const prior = await claimOnce(key);
  if (prior) {
    // Someone already sent (or is sending) this step. Record it if we know the Message-ID, never resend.
    if (prior !== 'pending' && prior !== 'sent') record(c, kind, acct, prior, comp);
    ctx.tried.add(c.id);
    return true;
  }
  try {
    const info = await getTransport(acct).sendMail(message);
    await settleOnce(key, info.messageId || 'sent').catch(() => {});
    record(c, kind, acct, info.messageId || '', comp);
    log.sent++; log.kinds[kind] = (log.kinds[kind] || 0) + 1;
    return true;
  } catch (e) {
    const [, p] = mapMailError(e, acct);
    ctx.tried.add(c.id);
    if (p.code === 'recipient') { await settleOnce(key, null).catch(() => {}); if (kind === 'first') { c.status = 'failed'; c.error = p.message; c.failAt = Date.now(); } log.failed++; return true; }
    if (STOP_CODES.indexOf(p.code) >= 0) { await settleOnce(key, null).catch(() => {}); ctx.blocked.add(acct.id); log.errors.push(p.message); return true; }
    // Timed out or unclear: it may have gone out. Keep the claim and ask for a check.
    if (kind === 'first') { c.status = 'unconfirmed'; c.error = (p.message || 'Gmail did not confirm.') + ' Check your Sent folder.'; c.failAt = Date.now(); }
    ctx.blocked.add(acct.id); log.errors.push('Unconfirmed send to ' + c.email + '. Check the Sent folder of ' + acct.user + '.');
    return true;
  }
}

async function digest(S, log, tz) {
  const acct = accounts()[0];
  if (!acct) return;
  const today = nowIn(tz).date;
  const d = S.cronDigest && S.cronDigest.date === today ? S.cronDigest : { date: today, errors: [] };
  const newErrors = log.errors.filter((e) => d.errors.indexOf(e) < 0);
  if (!log.news.length && !newErrors.length) return;
  const label = { interested: 'Interested', question: 'Needs your reply', not_interested: 'Not interested' };
  const lines = [];
  if (log.news.length) {
    lines.push('New replies:');
    log.news.forEach((n) => lines.push('- ' + n.who + ' (' + label[n.tag] + '): ' + snippetOf(n.snippet, 160)));
    lines.push('');
  }
  if (log.sent) lines.push('Sent this run: ' + log.sent + '.');
  if (newErrors.length) { lines.push('Problems:'); newErrors.forEach((e) => lines.push('- ' + e)); }
  lines.push('', 'Open Creator Mailer to act on these.');
  try {
    await getTransport(acct).sendMail({
      from: acct.fromName ? { name: 'Creator Mailer', address: acct.user } : acct.user,
      to: (process.env.DIGEST_TO || '').trim() || acct.user,
      subject: '[Creator Mailer] ' + (log.news.length ? log.news.length + ' new repl' + (log.news.length === 1 ? 'y' : 'ies') : 'Needs attention'),
      text: lines.join('\n'),
    });
    d.errors = d.errors.concat(newErrors).slice(-30);
    S.cronDigest = d;
  } catch { /* the digest is best effort */ }
}

export async function runScheduler({ user = cronUser(), budgetMs = 240000, source = 'cron' } = {}) {
  const t0 = Date.now();
  const lockKey = 'creator-mailer:lock:' + user;
  const got = await redis(['SET', lockKey, String(t0), 'NX', 'EX', Math.ceil(budgetMs / 1000) + 50]);
  if (got !== 'OK') return { ok: true, skipped: 'Another run is still going.' };
  const log = { at: t0, source, sent: 0, failed: 0, replies: 0, kinds: {}, errors: [], news: [], note: '' };
  try {
    let S = await load(user);
    if (!S || !Array.isArray(S.contacts)) { log.note = 'Nothing saved in the cloud yet. Open the app once so your list uploads.'; return { ok: true, log }; }
    const tz = zoneOf(S), auto = autoSettings(S);
    if (!accounts().length) { log.errors.push('Gmail is not set up on the server.'); return { ok: true, log }; }

    if ((S.contacts || []).some((c) => c.sentAt && !c.example)) {
      await checkInbox(S, log).catch((e) => log.errors.push('Inbox check failed: ' + String(e && e.message || e).slice(0, 120)));
      S = await persist(user, S);
    }

    if (!auto.on) log.note = 'Automation is off in Sending.';
    const ctx = { tz, auto, blocked: new Set(), tried: new Set(), primary: (accounts()[0] || {}).id };
    const gap = Math.max(20, Number(S.settings && S.settings.gap) || 45) * 1000;
    let job = nextJob(S, ctx);
    while (job) {
      await sendJob(user, S, job, log, ctx);
      if (job.camp) {
        const k = campById(S, job.camp.id);
        if (k && !campStats(S, k, tz).ready && k.state !== 'paused') { k.state = 'done'; k.doneAt = Date.now(); }
        else if (k && !k.startedAt) k.startedAt = Date.now();
      }
      S = await persist(user, S);
      job = nextJob(S, ctx);
      if (!job) break;
      const wait = Math.round(gap * (0.75 + Math.random() * 0.5));
      if (Date.now() - t0 + wait > budgetMs) { log.note = 'More is due. It continues next run.'; break; }
      await sleep(wait);
      S = (await load(user)) || S; // pick up pauses or edits made in the browser during the wait
      job = nextJob(S, ctx);
    }

    await digest(S, log, tz);
    S.cronAt = Date.now();
    S.cronLog = [{ at: log.at, source, sent: log.sent, failed: log.failed, replies: log.replies, kinds: log.kinds, errors: log.errors.slice(0, 5), note: log.note }].concat(Array.isArray(S.cronLog) ? S.cronLog : []).slice(0, 30);
    await persist(user, S);
    return { ok: true, log };
  } finally {
    await redis(['DEL', lockKey]).catch(() => {});
  }
}
