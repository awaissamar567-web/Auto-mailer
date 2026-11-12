import { NextResponse } from 'next/server';
import { authConfigured, checkCredentials, createToken, cookieOptions, COOKIE } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { ok: false, code: 'config', message: 'Login is not set up yet. Add APP_PASSWORD in your Vercel project settings, then redeploy.' },
      { status: 500 }
    );
  }
  let body = {};
  try { body = await request.json(); } catch {}
  const username = String(body.username || '').slice(0, 100);
  const password = String(body.password || '').slice(0, 200);

  if (!(await checkCredentials(username, password))) {
    // Slow down guessing.
    await sleep(700 + Math.floor(Math.random() * 500));
    return NextResponse.json({ ok: false, code: 'invalid', message: 'Wrong username or password.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createToken(username.trim().toLowerCase()), cookieOptions());
  return res;
}
