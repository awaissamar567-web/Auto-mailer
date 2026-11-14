import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';
import { redis, redisConfig, stateKey } from '../../../lib/store';
import { mergeState } from '../../../lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 900_000;

export async function GET(request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });
  if (!redisConfig()) return NextResponse.json({ ok: false, code: 'no_cloud' }, { status: 404 });
  try {
    const raw = await redis(['GET', stateKey(session.u)]);
    const state = raw ? JSON.parse(raw) : null;
    return NextResponse.json({ ok: true, state });
  } catch (e) {
    return NextResponse.json({ ok: false, code: 'storage', message: 'Could not load from cloud storage.' }, { status: 502 });
  }
}

export async function PUT(request) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });
  if (!redisConfig()) return NextResponse.json({ ok: false, code: 'no_cloud' }, { status: 404 });

  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, code: 'too_big', message: 'Your list is too big to save. Remove old creators.' }, { status: 413 });
  }
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ ok: false, code: 'invalid' }, { status: 400 }); }
  if (!body || typeof body.state !== 'object' || !body.state) return NextResponse.json({ ok: false, code: 'invalid' }, { status: 400 });

  try {
    // Fold in anything the scheduler recorded since this browser last loaded, so a save never undoes a send.
    const raw = await redis(['GET', stateKey(session.u)]);
    let stored = null;
    try { stored = raw ? JSON.parse(raw) : null; } catch { stored = null; }
    const merged = mergeState(stored, body.state);
    const out = JSON.stringify(merged);
    await redis(['SET', stateKey(session.u), out]);
    return NextResponse.json(out === JSON.stringify(body.state) ? { ok: true } : { ok: true, state: merged });
  } catch (e) {
    return NextResponse.json({ ok: false, code: 'storage', message: 'Could not save to cloud storage.' }, { status: 502 });
  }
}
