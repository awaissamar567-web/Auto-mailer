import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { accounts, publicAccounts, getTransport, mapMailError } from '../../../lib/mail';
import { redisConfig } from '../../../lib/store';
import { aiEnabled } from '../../../lib/replies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Log in again.' }, { status: 401 });

  const list = publicAccounts();
  const mail = { configured: list.length > 0, from: list[0] ? list[0].email : '', accounts: list };

  if (list.length && new URL(request.url).searchParams.get('verify') === '1') {
    const full = accounts();
    await Promise.all(full.map(async (acct, i) => {
      try {
        await getTransport(acct).verify();
        list[i].verified = true;
      } catch (e) {
        list[i].verified = false;
        list[i].error = mapMailError(e, acct)[1];
      }
    }));
  }

  return NextResponse.json({ ok: true, user: session.u, mail, cloud: !!redisConfig(), ai: aiEnabled() });
}
