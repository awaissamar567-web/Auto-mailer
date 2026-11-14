import nodemailer from 'nodemailer';

export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;
export const MAX_ACCOUNTS = 5;

// Gmail accounts come from env vars:
//   account 1: GMAIL_USER,   GMAIL_APP_PASSWORD,   FROM_NAME
//   account 2: GMAIL_USER_2, GMAIL_APP_PASSWORD_2, FROM_NAME_2  (and so on up to 5)
// Each account's id is its lowercased address, so saved history survives reordering.
export function accounts() {
  const list = [];
  const seen = new Set();
  for (let slot = 1; slot <= MAX_ACCOUNTS; slot++) {
    const sfx = slot === 1 ? '' : '_' + slot;
    const user = (process.env['GMAIL_USER' + sfx] || '').trim();
    // Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); SMTP wants them without.
    const pass = (process.env['GMAIL_APP_PASSWORD' + sfx] || '').replace(/\s+/g, '');
    if (!user || !pass) continue;
    const id = user.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const fromName = (process.env['FROM_NAME' + sfx] || process.env.FROM_NAME || '').trim();
    list.push({ id, user, pass, fromName, slot });
  }
  return list;
}

// Public view of the accounts, safe to send to the browser.
export function publicAccounts() {
  return accounts().map(({ id, user, fromName, slot }) => ({ id, email: user, name: fromName, slot }));
}

export function findAccount(id) {
  const list = accounts();
  if (!id) return list[0] || null;
  const want = String(id).trim().toLowerCase();
  return list.find((a) => a.id === want) || null;
}

const transports = new Map();
export function getTransport(acct) {
  if (!acct) return null;
  const key = acct.id + ':' + acct.pass;
  let t = transports.get(acct.id);
  // Tests only: MAIL_TEST_JSON=1 builds messages without sending, and MAIL_TEST_LOG lists them.
  if (process.env.MAIL_TEST_JSON === '1') return testTransport(acct);
  if (!t || t.__key !== key) {
    t = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: acct.user, pass: acct.pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    t.__key = key;
    transports.set(acct.id, t);
  }
  return t;
}

function envNames(acct) {
  const sfx = !acct || acct.slot === 1 ? '' : '_' + acct.slot;
  return 'GMAIL_USER' + sfx + ' and GMAIL_APP_PASSWORD' + sfx;
}

function short(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

// Turns a nodemailer / SMTP error into [httpStatus, { code, message }].
export function mapMailError(e, acct) {
  const code = e && e.code;
  const rc = e && e.responseCode;
  const text = String((e && (e.response || e.message)) || '');
  const who = acct ? acct.user : 'this account';

  if (code === 'EAUTH' || rc === 535 || rc === 534) {
    return [502, { code: 'auth', message: 'Gmail rejected the login for ' + who + '. Check ' + envNames(acct) + ' in Vercel. It has to be a 16-character App Password, not the normal Gmail password.' }];
  }
  if (/5\.4\.5|daily user sending|sending limit|quota/i.test(text)) {
    return [429, { code: 'limit', message: 'Gmail says ' + who + ' hit its sending limit for today. Wait 24 hours before sending more from it.' }];
  }
  if (code === 'EENVELOPE' || (rc >= 550 && rc < 560) || rc === 501 || rc === 553) {
    return [422, { code: 'recipient', message: 'Gmail refused this address. ' + short(text) }];
  }
  if (rc === 421 || rc === 450 || rc === 451 || rc === 452 || rc === 454) {
    return [503, { code: 'throttled', message: 'Gmail is slowing down sends from ' + who + '. Wait 10 to 15 minutes, then press Send again.' }];
  }
  if (code === 'ETIMEDOUT') {
    return [504, { code: 'unconfirmed', message: 'Gmail did not confirm in time.' }];
  }
  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'EDNS' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return [503, { code: 'network', message: 'Could not reach Gmail from the server. Try again in a minute.' }];
  }
  return [500, { code: 'unknown', message: short(text) || 'Something went wrong sending this email.' }];
}

function testTransport(acct) {
  const t = nodemailer.createTransport({ jsonTransport: true });
  return {
    verify: async () => true,
    sendMail: async (m) => {
      const info = await t.sendMail(m);
      if (process.env.MAIL_TEST_LOG) {
        const fs = await import('node:fs');
        fs.appendFileSync(process.env.MAIL_TEST_LOG, JSON.stringify({ from: acct.id, to: m.to, subject: m.subject, inReplyTo: m.inReplyTo || null, references: m.references || null, messageId: info.messageId }) + '\n');
      }
      return info;
    },
  };
}
