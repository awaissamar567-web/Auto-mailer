import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { getTransport, mailConfig, mapMailError, EMAIL_RE } from '../../../lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const fail = (status, code, message) => NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request) {
  if (!(await getSession(request))) return fail(401, 'unauthorized', 'Log in again.');

  const transport = getTransport();
  if (!transport) {
    return fail(500, 'config', 'Gmail is not set up. Add GMAIL_USER and GMAIL_APP_PASSWORD in your Vercel project settings, then redeploy.');
  }

  let b;
  try { b = await request.json(); } catch { return fail(400, 'invalid', 'The request was not valid JSON.'); }

  const to = String(b.to || '').trim();
  if (!EMAIL_RE.test(to)) return fail(422, 'recipient', 'That email address is not valid.');

  const subject = String(b.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 250);
  const text = String(b.body || '');
  if (!subject) return fail(400, 'invalid', 'The subject is empty.');
  if (!text.trim()) return fail(400, 'invalid', 'The email body is empty.');
  if (text.length > 20000) return fail(400, 'invalid', 'The email body is too long.');

  const inReplyTo = typeof b.inReplyTo === 'string' && /^<[^<>\s]+@[^<>\s]+>$/.test(b.inReplyTo) ? b.inReplyTo : null;

  const { user, fromName } = mailConfig();
  const message = {
    from: fromName ? { name: fromName, address: user } : user,
    to,
    subject,
    text,
  };
  if (inReplyTo) {
    message.inReplyTo = inReplyTo;
    message.references = [inReplyTo];
  }

  try {
    const info = await transport.sendMail(message);
    return NextResponse.json({ ok: true, messageId: info.messageId || '' });
  } catch (e) {
    const [status, payload] = mapMailError(e);
    return NextResponse.json({ ok: false, ...payload }, { status });
  }
}
