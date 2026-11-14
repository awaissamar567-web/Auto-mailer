import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { redisConfig } from '../../../lib/store';
import { runScheduler, cronUser } from '../../../lib/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function secretOk(request) {
  const want = (process.env.CRON_SECRET || '').trim();
  if (!want) return false;
  const got = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

async function handle(request) {
  const scheduled = secretOk(request);
  const session = scheduled ? null : await getSession(request);
  if (!scheduled && !session) return NextResponse.json({ ok: false, code: 'unauthorized', message: 'Not allowed.' }, { status: 401 });
  if (!redisConfig()) return NextResponse.json({ ok: false, code: 'no_cloud', message: 'Connect Upstash Redis in Vercel Storage first. The scheduler reads your list from there.' }, { status: 400 });
  try {
    // Run now from the app keeps it short so the button answers quickly; scheduled runs use most of the 5 minutes.
    const res = await runScheduler({ user: scheduled ? cronUser() : session.u, budgetMs: scheduled ? 240000 : 50000, source: scheduled ? 'cron' : 'manual' });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ ok: false, code: 'error', message: String((e && e.message) || e).slice(0, 200) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
