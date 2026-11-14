// Server-side copy of the rules the browser app uses (lib/mailer-client.js), for the scheduler.
// Keep the two in step: templating, eligibility, caps and time windows must agree.

export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;
const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;
const HOUR = 3600000, DAY = 86400000, FOLLOW2_DAYS = 6;

/* ---------- time in the sending zone ---------- */
export function zoneOf(S) {
  const tz = S && S.settings && S.settings.tz;
  try { if (tz) { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } } catch {}
  return 'UTC';
}
export function nowIn(tz, d) {
  const o = {};
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
    .formatToParts(d || new Date()).forEach((x) => { o[x.type] = x.value; });
  return { date: o.year + '-' + o.month + '-' + o.day, mins: (Number(o.hour) % 24) * 60 + Number(o.minute), weekday: o.weekday };
}
const toMins = (t) => { const p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1]); };
const dateOf = (ts, tz) => (ts ? nowIn(tz, new Date(ts)).date : '');

/* ---------- templates ---------- */
function varsFor(S, c) {
  const v = {};
  for (const k in S.globals || {}) v[k] = S.globals[k];
  const name = String(c.name || '').trim();
  v.name = name;
  v.first_name = String(c.first_name || '').trim() || name.split(/\s+/)[0] || '';
  v.email = c.email || ''; v.handle = c.handle || ''; v.niche = c.niche || ''; v.line = c.line || '';
  if (c.extra) for (const k in c.extra) if (String(c.extra[k] || '').trim()) v[k] = c.extra[k];
  return v;
}
function fill(S, tpl, c) {
  tpl = String(tpl || '');
  const vars = varsFor(S, c), missing = [];
  let out = '', last = 0, m;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(tpl))) {
    out += tpl.slice(last, m.index);
    const key = m[1].toLowerCase();
    const val = String(vars[key] == null ? '' : vars[key]).trim();
    if (val) out += val;
    else if (m[2] !== undefined) out += m[2].trim();
    else { out += m[0]; if (missing.indexOf(key) < 0) missing.push(key); }
    last = m.index + m[0].length;
  }
  out += tpl.slice(last);
  return { text: out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), missing };
}
const tplById = (S, id) => (S.templates || []).find((t) => t.id === id) || null;
const tplOfKind = (S, kind) => (S.templates || []).find((t) => t.kind === kind) || null;
export const campById = (S, id) => (S.campaigns || []).find((k) => k.id === id) || null;
function firstTpl(S) { const t = tplById(S, S.settings && S.settings.firstTpl); return t && t.kind === 'first' ? t : tplOfKind(S, 'first'); }
function firstTplFor(S, c) { const k = c.campaignId && campById(S, c.campaignId); const t = k && tplById(S, k.tpl); return t && t.kind === 'first' ? t : firstTpl(S); }
function threadTpl(S, c, kind) {
  if (kind === 'followup') return ((c.followCount || 0) >= 1 && tplOfKind(S, 'followup2')) || tplOfKind(S, 'followup');
  return tplOfKind(S, kind) || tplOfKind(S, 'followup');
}
export function compose(S, c, kind) {
  if (kind !== 'first') {
    const t = threadTpl(S, c, kind);
    if (!t) return { subject: '', text: '', missing: ['template'] };
    const b = fill(S, t.body, c);
    const base = c.subject || fill(S, (firstTplFor(S, c) || {}).subject, c).text;
    return { subject: /^re:/i.test(base) ? base : 'Re: ' + base, text: b.text, missing: b.missing };
  }
  const t = firstTplFor(S, c);
  if (!t) return { subject: '', text: '', missing: ['template'] };
  const s = fill(S, t.subject, c), b = fill(S, t.body, c);
  const miss = s.missing.slice(); b.missing.forEach((k) => { if (miss.indexOf(k) < 0) miss.push(k); });
  return { subject: s.text, text: b.text, missing: miss, tplId: t.id };
}

/* ---------- eligibility ---------- */
export const validEmail = (c) => EMAIL_RE.test(String(c.email || '').trim());
export const locked = (c) => !!(c.example || c.dnc || c.bounced);
export function tagOf(c) {
  if (c.dnc) return 'do_not_contact';
  if (c.bounced) return 'bounced';
  if (c.status === 'replied') return (c.reply && c.reply.tag) || 'replied';
  if (c.reply && c.reply.tag === 'auto_reply') return 'auto_reply';
  return 'no_reply';
}
const ok = (S, c, kind) => compose(S, c, kind).missing.length === 0;
export function canFirst(S, c) { return !locked(c) && validEmail(c) && c.status === 'ready' && ok(S, c, 'first'); }
export function isDue(S, c) {
  if (locked(c) || !c.messageId || !c.sentAt) return false;
  const dueHours = Number(S.settings && S.settings.dueHours) || 20;
  if (c.status === 'sent') return Date.now() - c.sentAt >= dueHours * HOUR;
  if (c.status === 'followed') return (c.followCount || 0) === 1 && Date.now() >= c.sentAt + FOLLOW2_DAYS * DAY;
  return false;
}
export function canFollowDue(S, c) { return validEmail(c) && (c.status === 'sent' || c.status === 'followed') && (c.followCount || 0) < 2 && isDue(S, c) && ok(S, c, 'followup'); }
export function canNext(S, c) { return !locked(c) && validEmail(c) && c.status === 'replied' && tagOf(c) === 'interested' && !c.nextAt && !!c.messageId && ok(S, c, 'next'); }
export function canCounter(S, c) { return !locked(c) && validEmail(c) && c.status === 'replied' && tagOf(c) === 'not_interested' && !!(c.reply && c.reply.soft) && !c.counterAt && !!c.messageId && ok(S, c, 'counter'); }

export function campStats(S, k, tz) {
  const today = nowIn(tz).date;
  const r = { total: 0, sent: 0, ready: 0, today: 0 };
  for (const c of S.contacts || []) {
    if (c.campaignId !== k.id || c.example) continue;
    r.total++;
    if (c.sentAt) { r.sent++; if (dateOf(c.sentAt, tz) === today) r.today++; }
    else if (canFirst(S, c)) r.ready++;
  }
  return r;
}
export function campOpen(S, k, tz) {
  if (k.state === 'done' || k.state === 'paused') return false;
  const n = nowIn(tz);
  if (n.date < k.date || n.mins < toMins(k.start) || n.mins >= toMins(k.end)) return false;
  const st = campStats(S, k, tz);
  return st.ready > 0 && !(k.cap && st.today >= k.cap);
}
// Follow-ups, next steps and counter-questions only go out in working hours on the allowed days.
export function inWorkHours(S, tz) {
  const st = S.settings || {}, n = nowIn(tz);
  if ((st.autoDays || 'weekdays') === 'weekdays' && (n.weekday === 'Sat' || n.weekday === 'Sun')) return false;
  return n.mins >= toMins(st.workStart || '09:00') && n.mins < toMins(st.workEnd || '19:00');
}

/* ---------- caps ---------- */
export function sentToday(S, id, tz, primary) {
  const today = nowIn(tz).date;
  let n = 0;
  for (const c of S.contacts || []) {
    const from = c.sentFrom || primary;
    if (dateOf(c.sentAt, tz) === today && from === id) n++;
    if (dateOf(c.followAt, tz) === today && (c.followFrom || from) === id) n++;
    for (const k of ['nextAt', 'counterAt', 'answerAt']) if (dateOf(c[k], tz) === today && from === id) n++;
  }
  return n;
}

/* ---------- merge ---------- */
// The browser and the scheduler both save the same blob. A save never undoes a send or a newer reply
// that the other side recorded: progress fields are taken from whichever copy is further along.
// resetAt / replyClearedAt mark deliberate undos in the browser so they are not brought back.
const SEND_FIELDS = ['sentAt', 'sentFrom', 'messageId', 'subject', 'tpl'];
const REPLY_FIELDS = ['reply', 'dnc', 'bounced', 'repliedAt', 'prevStatus'];
export function mergeState(stored, incoming) {
  if (!stored || !Array.isArray(stored.contacts)) return incoming;
  if (!incoming || !Array.isArray(incoming.contacts)) return stored;
  const out = { ...incoming };
  const old = new Map(stored.contacts.filter((c) => c && c.id).map((c) => [c.id, c]));
  out.contacts = incoming.contacts.map((c) => {
    const s = c && old.get(c.id);
    if (!s) return c;
    const m = { ...c };
    const resetAt = Number(c.resetAt) || 0;
    if (s.sentAt && s.sentAt > resetAt && (!m.sentAt || m.status === 'ready' || m.status === 'unconfirmed' && s.status !== 'unconfirmed')) {
      SEND_FIELDS.forEach((k) => { if (s[k] !== undefined) m[k] = s[k]; });
      if (m.status === 'ready' || m.status === 'failed' || m.status === 'unconfirmed') { m.status = s.status; m.error = s.error || ''; }
    }
    if (!s.sentAt && !m.sentAt && (s.status === 'failed' || s.status === 'unconfirmed') && m.status === 'ready' && (s.failAt || 0) > resetAt) {
      m.status = s.status; m.error = s.error || ''; m.failAt = s.failAt;
    }
    if ((s.followCount || 0) > (m.followCount || 0) && (s.followAt || 0) > resetAt) {
      m.followCount = s.followCount; m.followAt = s.followAt; m.followFrom = s.followFrom;
      if (m.status === 'sent' || m.status === 'followed') m.status = s.status === 'replied' ? m.status : 'followed';
    }
    for (const k of ['nextAt', 'counterAt', 'answerAt']) if (s[k] && (!m[k] || s[k] > m[k]) && s[k] > resetAt) m[k] = s[k];
    if ((s.answerCount || 0) > (m.answerCount || 0)) m.answerCount = s.answerCount;
    const sAt = (s.reply && s.reply.at) || 0, mAt = (m.reply && m.reply.at) || 0;
    if (s.reply && sAt > mAt && sAt > (Number(c.replyClearedAt) || 0) && sAt > resetAt && !(m.reply && m.reply.by === 'manual' && sAt <= mAt)) {
      REPLY_FIELDS.forEach((k) => { if (s[k] !== undefined) m[k] = s[k]; else delete m[k]; });
      m.status = s.status; m.error = s.error || '';
    }
    return m;
  });
  const oldCamps = new Map((stored.campaigns || []).map((k) => [k.id, k]));
  out.campaigns = (incoming.campaigns || []).map((k) => {
    const s = oldCamps.get(k.id);
    if (!s) return k;
    const m = { ...k };
    if (s.state === 'done' && m.state === 'scheduled' && (s.doneAt || 0) > (k.editedAt || 0)) { m.state = 'done'; m.doneAt = s.doneAt; }
    if (s.startedAt && !m.startedAt) m.startedAt = s.startedAt;
    if ((s.errAt || 0) > (m.errAt || 0)) m.errAt = s.errAt;
    return m;
  });
  out.checkedAt = Math.max(Number(stored.checkedAt) || 0, Number(incoming.checkedAt) || 0);
  if ((Number(stored.cronAt) || 0) > (Number(incoming.cronAt) || 0)) { out.cronAt = stored.cronAt; out.cronLog = stored.cronLog; out.cronDigest = stored.cronDigest; }
  out.updatedAt = Math.max(Number(stored.updatedAt) || 0, Number(incoming.updatedAt) || 0);
  return out;
}
