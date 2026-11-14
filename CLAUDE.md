# Creator Mailer (Auto-mailer)

A private, password-protected web app for cold outreach to Instagram creators. The owner imports a creator list (CSV), picks a template with `{{tags}}`, previews each personalized email, and sends batches from one or more Gmail accounts. It tracks sent, follow-up due and replied.

Live on Vercel. Every push to `main` deploys to production.

## Rules for working in this repo

- **This repo is public.** Never commit secrets, `.env*` files, real creator lists or scraped data. Lead CSVs stay out of git.
- **Work on a branch, then fast-forward `main`.** Never force-push or rewrite history on GitHub.
- **Build before every push:** `npx next build` must pass.
- **Test in a real browser before pushing** (see Testing). The app is mostly client-side, so a passing build proves very little.
- **Keep the client app in vanilla JS.** `lib/mailer-client.js` is one self-contained script. Don't port it to React or add a UI framework.
- **Escape everything** that goes into `innerHTML` with `esc()`. Creator data comes from scraped CSVs and is untrusted.
- **Keep it backward compatible with saved data.** Users have state in localStorage and possibly Redis. New fields need defaults in `fresh()` / `normalize()`, and settings pass through `cleanSettings()`.

## Stack

- Next.js 15 (App Router), plain JavaScript, no TypeScript, no Tailwind.
- `nodemailer` over Gmail SMTP (`smtp.gmail.com:465`) with Gmail App Passwords.
- Optional Upstash Redis via its REST API (no SDK) for cloud sync.
- Fonts from Fontsource: Geist (body), Open Sauce Sans (headings), Doto with the ROND axis (numbers).

## File map

| Path | What it does |
| --- | --- |
| `middleware.js` | Redirects to `/login` (pages) or returns 401 (API) without a valid session cookie. |
| `lib/auth.js` | HMAC-signed session cookie (Web Crypto, works in edge and node). Credentials from env. |
| `lib/mail.js` | Gmail accounts from env (up to 5), cached transports, SMTP error mapping to user-facing messages. |
| `lib/store.js` | Upstash Redis REST helper. One JSON blob per user at `creator-mailer:state:<user>`. |
| `app/api/login`, `app/api/logout` | Sign in and out. Login has a small random delay on failure. |
| `app/api/send/route.js` | Sends one email. Body: `{to, subject, body, from, inReplyTo}`. Returns `{ok, messageId, from}` or `{ok:false, code, message}`. |
| `app/api/status/route.js` | Lists configured Gmail accounts (no secrets). `?verify=1` tests each SMTP login. |
| `app/api/state/route.js` | GET/PUT the saved workspace when Redis is connected, 404 `no_cloud` when not. |
| `app/markup.js` | Static HTML for the whole app UI, injected once. |
| `app/MailerApp.js` | Mounts the markup, then calls `initMailer()`. |
| `lib/mailer-client.js` | The entire browser app: state, templating, CSV import, batch sending, walkthrough, rendering. |
| `app/login/page.js` | Login page (React). |
| `app/globals.css` | The design system (tokens + components). |
| `.claude/skills/` | Lead skills: Instagram links to CSV, and CSV to outreach message. |

## Environment variables (set in Vercel)

- `APP_USERNAME`, `APP_PASSWORD`, `AUTH_SECRET`: login. Changing the password or secret logs everyone out.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FROM_NAME`: account 1.
- `GMAIL_USER_2`, `GMAIL_APP_PASSWORD_2`, `FROM_NAME_2`: account 2, and so on up to `_5`.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`): optional cloud sync. Added automatically when Upstash is connected in Vercel Storage.

## Data model (browser state, `localStorage["creator-mailer-v1"]`)

- `contacts[]`: `id, name, first_name?, email, handle, niche, line, extra{}, status, example?`
  - `status`: `ready | sent | followed | replied | failed | unconfirmed`
  - After sending: `sentAt, sentFrom (account id), messageId, subject, tpl`. After follow-up: `followAt, followFrom, followCount`.
  - Follow-ups thread by sending `inReplyTo = messageId` from the same account (`sentFrom`).
- `templates[]`: `{id, name, kind: 'first'|'followup', subject, body}`. Built-ins: `fit`, `ugc`, `fu`.
- `globals`: "Your details" tags: `my_name, brand, product, commission, link`.
- `settings`: `gap (20|30|45|60|90|120 s), cap (daily per account), firstTpl, dueHours (12|20|24|48|72), sender ('rotate' | account id)`.
- Other keys: `creator-mailer-tour-v1` (walkthrough done) and `creator-mailer-mode` (`dark|light`).

## Templating

- `{{tag}}` or `{{tag|fallback}}`. Case-insensitive names.
- A missing value with no fallback blocks that creator from sending (status "Needs …").
- Creator tags: `first_name, name, handle, niche, line, email`, plus any extra CSV column, lowercased and slugged.
- CSV import maps header aliases (for example "Full Name", "Email Address", "Instagram URL") in `ALIASES`. Upload and paste share `importText()`, which also returns the column-to-tag report.

## Sending behavior

- Batches run **in the browser tab**: one email per `gap` seconds with ±25% jitter, capped at 150 s, timed with `performance.now()`. Closing the tab stops the batch.
- Rotation picks the account with the fewest sends today that is under its cap. Follow-ups always use `sentFrom`.
- Errors that make the batch stop: `auth, limit, throttled, network, config, account, unauthorized`. Recipient errors mark that row failed and the batch continues. Ambiguous errors mark it `unconfirmed` ("Check Sent folder") and stop.

## Design system (GladOS, gold)

- Soft charcoal ground. Cards are 28px radius with a fill step plus one neutral shadow. **No borders**: inputs use an inset ring only.
- The only gradient is the gold hero card, **at most two per view** (Reply rate, Sent today).
- Headings: Open Sauce Sans, weight 300. Body: Geist. **Numbers: Doto with `font-variation-settings: 'ROND' 100`** (round dots, not square).
- Dark mode is the default; light mode via `data-mode="light"` on `<html>`. Every colour is a `--g-*` token in `globals.css`.
- Icons: inline SVG, lucide paths, `stroke-width: 1.7`. No emojis in the UI.
- Icon-only controls need `aria-label` plus `data-tip` (CSS tooltip).

## Testing

```
npx next build
APP_USERNAME=awais APP_PASSWORD=test GMAIL_USER=a@gmail.com GMAIL_APP_PASSWORD=x \
GMAIL_USER_2=b@gmail.com GMAIL_APP_PASSWORD_2=y npx next start -p 3111
```

Then drive it with Playwright (Chrome at `/usr/bin/google-chrome` in the cloud workspace):

- Mock `**/api/send` to return `{ok:true, messageId:'<m1@x>', from: body.from}`. Never send real email from tests.
- Set `localStorage['creator-mailer-tour-v1'] = 'done'` to skip the walkthrough.
- Check: login, CSV upload (`#csvFile`), batch send (`[data-q=ready]`, `#btnFirst`, `#mOk`), rotation `from` values, follow-up `inReplyTo`, and no page errors.

## Roadmap: next feature (planned, not built)

**Reply reader.** Read replies from creators and act on them.

- Read Gmail over IMAP (`imap.gmail.com:993`, TLS) with the **same App Password** used for SMTP. IMAP is always on for personal Gmail accounts. Use `imapflow` in a new `app/api/replies` route.
- Only fetch messages **from addresses on the creator list**, since each contact's first `sentAt`, across `INBOX` and `[Gmail]/All Mail`. Match on `In-Reply-To`/`References` to the stored `messageId`, falling back to the sender address. Strip quoted text and store a short snippet only.
- Tags: `interested, not_interested, question (needs your reply), no_reply, auto_reply, bounced, do_not_contact`. Bounces (mailer-daemon) mark the email bad. Auto-replies don't count as replies. "stop / unsubscribe / remove me" locks the contact. Every tag can be overridden manually in one click.
- Replies view: totals (sent, replied, interested, not interested, needs reply, no reply, bounced, reply rate, interest rate), one card per creator with the snippet, tag and next action.
- Actions, all sent in-thread with the existing batch sender and daily caps:
  - No reply: follow-up 1 (about 2 days), follow-up 2 (about 6 days), then stop.
  - Interested: next-step template.
  - Not interested (soft no only): one polite counter-question, once, never to `do_not_contact`.
  - Question: show their message with a reply box.
- Later: automatic follow-ups with the tab closed. Needs Redis for server-side state plus a Vercel Cron job, and must skip anyone who replied.

**Open decisions (ask the owner before building):**
1. What interested creators get next: a free-copy link, an affiliate signup link, a call link, or something else.
2. Tagging: keyword rules with manual override (free) or AI tagging via Groq's free tier.
3. Confirm the counter-question rule: one question, soft no only, sent once.
