import nodemailer from 'nodemailer';

export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

let transporter = null;
let transporterKey = '';

export function mailConfig() {
  const user = (process.env.GMAIL_USER || '').trim();
  // Google shows App Passwords with spaces ("abcd efgh ijkl mnop"); SMTP wants them without.
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  const fromName = (process.env.FROM_NAME || '').trim();
  return { user, pass, fromName, configured: !!(user && pass) };
}

export function getTransport() {
  const { user, pass, configured } = mailConfig();
  if (!configured) return null;
  const key = user + ':' + pass.length;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
    transporterKey = key;
  }
  return transporter;
}

function short(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

// Turns a nodemailer / SMTP error into [httpStatus, { code, message }].
export function mapMailError(e) {
  const code = e && e.code;
  const rc = e && e.responseCode;
  const text = String((e && (e.response || e.message)) || '');

  if (code === 'EAUTH' || rc === 535 || rc === 534) {
    return [502, { code: 'auth', message: 'Gmail rejected the login. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel. It has to be a 16-character App Password, not your normal Gmail password.' }];
  }
  if (/5\.4\.5|daily user sending|sending limit|quota/i.test(text)) {
    return [429, { code: 'limit', message: 'Gmail says you hit your sending limit for today. Wait 24 hours before sending more.' }];
  }
  if (code === 'EENVELOPE' || (rc >= 550 && rc < 560) || rc === 501 || rc === 553) {
    return [422, { code: 'recipient', message: 'Gmail refused this address. ' + short(text) }];
  }
  if (rc === 421 || rc === 450 || rc === 451 || rc === 452 || rc === 454) {
    return [503, { code: 'throttled', message: 'Gmail is slowing your sends down. Wait 10 to 15 minutes, then press Send again.' }];
  }
  if (code === 'ETIMEDOUT') {
    return [504, { code: 'unconfirmed', message: 'Gmail did not confirm in time.' }];
  }
  if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'EDNS' || code === 'ECONNREFUSED' || code === 'ECONNRESET') {
    return [503, { code: 'network', message: 'Could not reach Gmail from the server. Try again in a minute.' }];
  }
  return [500, { code: 'unknown', message: short(text) || 'Something went wrong sending this email.' }];
}
