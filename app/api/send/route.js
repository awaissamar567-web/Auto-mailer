import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { accounts, findAccount, getTransport, mapMailError, EMAIL_RE } from '../../../lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MSG_ID = /^<[^<>\s]+@[^<>\s]+>$/;
const fail = (status, code, message) => NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request) {
  if (!(await getSession(request))) return fail(401, 'unauthorized', 'Log in again.');

  if (!accounts().length) {
    return fail(500, 'config', 'Gmail is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings, then redeploy.');
  }

  let b;
  try { b = await request.json(); } catch { return fail(400, 'invalid', 'The request was not valid JSON.'); }

  const acct = findAccount(b.from);
  if (!acct) {
    return fail(400, 'account', 'The Gmail account ' + String(b.from || '') + ' is not set up on the server anymore. Add it back in Vercel, or reset these creators.');
  }

  const to = String(b.to || '').trim();
  if (!EMAIL_RE.test(to)) return fail(422, 'recipient', 'That email address is not valid.');

  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 250);
  const text = String(b.body || '');
  if (!subject) return fail(400, 'invalid', 'The subject is empty.');
  if (!text.trim()) return fail(400, 'invalid', 'The email body is empty.');
  if (text.length > 20000) return fail(400, 'invalid', 'The email body is too long.');

  const inReplyTo = typeof b.inReplyTo === 'string' && MSG_ID.test(b.inReplyTo) ? b.inReplyTo : null;

  const message = {
    from: acct.fromName ? { name: acct.fromName, address: acct.user } : acct.user,
    to,
    subject,
    text,
  };
  if (inReplyTo) {
    // Replying to a creator's reply: keep the whole thread in References, ending with the message we answer.
    const refs = (Array.isArray(b.references) ? b.references : []).filter((r) => typeof r === 'string' && MSG_ID.test(r) && r !== inReplyTo).slice(0, 10);
    message.inReplyTo = inReplyTo;
    message.references = refs.concat([inReplyTo]);
  }

  try {
    const info = await getTransport(acct).sendMail(message);
    return NextResponse.json({ ok: true, messageId: info.messageId || '', from: acct.id });
  } catch (e) {
    const [status, payload] = mapMailError(e, acct);
    return NextResponse.json({ ok: false, from: acct.id, ...payload }, { status });
  }
}
