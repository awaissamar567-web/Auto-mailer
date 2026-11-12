import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { getTransport, mailConfig, mapMailError } from '../../../lib/mail';
import { redisConfig } from '../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Log in again.' }, { status: 401 });

  const { user, configured } = mailConfig();
  const mail = { configured, from: configured ? user : '' };

  if (configured && new URL(request.url).searchParams.get('verify') === '1') {
    try {
      await getTransport().verify();
      mail.verified = true;
    } catch (e) {
      mail.verified = false;
      mail.error = mapMailError(e)[1];
    }
  }

  return NextResponse.json({ ok: true, user: session.u, mail, cloud: !!redisConfig() });
}
