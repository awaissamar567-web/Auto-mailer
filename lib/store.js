// Optional cloud save through Upstash Redis (Vercel Marketplace, free tier).
// Connecting it in Vercel adds these env vars automatically.

export function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

export async function redis(command) {
  const cfg = redisConfig();
  if (!cfg) throw new Error('Cloud storage is not connected.');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || 'Storage error ' + res.status);
  return json.result;
}

export function stateKey(username) {
  return 'creator-mailer:state:' + String(username || 'admin').toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

// One-time claims so the browser and the scheduler can never send the same step twice.
// Returns null when this caller got the claim, otherwise the stored value ('pending' or a Message-ID).
export function onceKey(username, step) {
  return 'creator-mailer:once:' + String(username || 'admin').toLowerCase().replace(/[^a-z0-9._-]/g, '_') + ':' + String(step).replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 120);
}
export async function claimOnce(key) {
  const got = await redis(['SET', key, 'pending', 'NX', 'EX', 60 * 60 * 24 * 45]);
  return got === 'OK' ? null : (await redis(['GET', key])) || 'pending';
}
export async function settleOnce(key, value) {
  if (value) await redis(['SET', key, value, 'EX', 60 * 60 * 24 * 45]);
  else await redis(['DEL', key]);
}
