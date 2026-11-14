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
- `settings`: `gap (20|30|45|60|90|120 s), cap (daily per account), firstTpl, dueHours (12|20|24|48|72), sender ('rotate' | account id), tz (IANA name, blank = browser zone)`.
- `campaigns[]`: `{id, name, tpl, date 'YYYY-MM-DD', start 'HH:MM', end 'HH:MM', sender, cap (0 = account limit), state: scheduled|running|paused|done, createdAt, startedAt?, doneAt?, errAt?}`. Contacts in a campaign carry `campaignId`. `cleanCampaign()` snaps saved values.
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

## Reply reader (built)

- `app/api/replies/route.js` reads each sending account over IMAP (`lib/imap.js`, `imapflow`, same App Password) in `[Gmail]/All Mail`, read-only. Only mail from creator addresses, mail whose `References` holds one of our Message-IDs, and mailer-daemon bounces are fetched; bodies are capped at 40 KB and only a 400-char snippet goes back to the browser.
- Tagging in `lib/replies.js`: hard rules first (bounce, auto-reply headers, stop/unsubscribe), then Groq (`GROQ_API_KEY`, optional `GROQ_MODEL`, default `llama-3.3-70b-versatile`) with keyword rules as the fallback. `/api/status` reports `ai: true|false`.
- Contact fields: `reply {tag, soft, by: ai|rules|manual, snippet, at, from, msgId}`, `dnc`, `bounced`, `nextAt`, `counterAt`, `answerAt`, `answerCount`. Tags: `interested, not_interested (soft flag), question, no_reply, auto_reply, bounced, do_not_contact`. A manual tag is kept until the creator writes again. `tagOf(c)` is the single source of truth.
- New threaded template kinds: `followup2` (sent as the second follow-up, due 6 days after the first email), `next` (interested), `counter` (soft no, once). Follow-ups reply to our Message-ID; next-step, counter and typed answers reply to the creator's `reply.msgId` with our id in `References`. `/api/send` accepts `references[]`.
- Two follow-ups max. A follow-up batch checks the inbox first and skips anyone who replied. `locked(c)` (dnc or bounced) blocks every send.
- Replies view: `#viewSeg` toggles `#sendView` / `#repliesView`. Opening it auto-checks if the last check is over 30 minutes old. "Download interested list" exports the interested creators as CSV (the owner's CRM step).

## Campaigns and calendar (built)

- Views: the left side panel (`#side`, nav `#viewSeg`) switches Calendar (`#calendarView`), Creators (`#sendView`) and Replies, with count badges. `#btnSide` in the header hides it fully (`localStorage["creator-mailer-side"]`); under 900px it sits above the content as a row. The last view is remembered in `localStorage["creator-mailer-view"]`.
- `campReason(k)` explains in words why a campaign is or isn't sending (no creators, missing tags, paused, automation off, starts at, hours over, limit reached, due now). Calendar cards and the side panel status (`renderSideStatus`, scheduler health) use it. Keep it in step with `campDue()` and `campOpen()` in `lib/engine.js`.
- A campaign is a CSV plus template, date, time window, sender and optional per-campaign daily cap. `importText(text, source, campaignId)` skips anyone already emailed (`sentAt`, `dnc`, `bounced`) or already in another campaign, and reports them. The Creators panel has an "Add to campaign" select when open campaigns exist.
- `firstTplFor(c)` picks the campaign's template; `pickSender` honours the campaign's sender. Quick select "All ready" excludes campaign rows; their status pill reads "Scheduled <date>".
- Time: all campaign dates and windows are in `settings.tz` (`nowIn()`, `todayIso()`); the calendar footer shows the clock. `campDue(k)` = date reached, inside the window, under the campaign cap, and still has `canFirst` rows.
- Runner: `runBatch(kind, ids, camp)` marks the campaign `running`, stops for the day when `campStop()` says the cap is hit or the window closed (`run.note`), and leaves it `scheduled` (more to send), `paused` (user pressed Stop) or `done`. Leftovers continue in the same window on following days. `tickCampaigns()` auto-starts the earliest due campaign every minute while the tab is open; a run that ended in an error backs off 30 minutes (`errAt`).
- Calendar: Monday-start week, drag a non-done campaign to another day, click to edit (pause, resume, send now, show creators, delete; delete removes only its unsent creators).

## Server scheduler (built)

- `app/api/cron/route.js` runs `runScheduler()` from `lib/scheduler.js`. Auth: `Authorization: Bearer CRON_SECRET` (Vercel Cron, cron-job.org) or a logged-in session ("Run now", 50 s budget). `middleware.js` lets `/api/cron` through so the route can check the secret itself. `maxDuration` 300, scheduled budget 240 s.
- `vercel.json` has a daily cron (Hobby plans allow only daily). For every 15 minutes the owner points an outside scheduler at `/api/cron` with the Bearer header; the Automation panel explains it.
- A run: Redis lock `creator-mailer:lock:<user>`, load the state blob, inbox check and tagging, then one email per `gap` (jittered) in priority order: next steps, counter-questions, follow-ups (these three only in work hours `workStart`-`workEnd` on `autoDays`), then due campaigns. It saves after every send and re-reads between sends so pauses in the browser take effect. Ends with a digest email to account 1 (or `DIGEST_TO`) when there are new interested / question / not-interested replies or new errors, and a `cronLog` entry.
- `lib/engine.js` is the server copy of the browser rules (templating, `canFirst`, `isDue`, `canNext`, `canCounter`, `campOpen`, caps, work hours). Keep it in step with `lib/mailer-client.js`.
- No double sends: every step has a once key `creator-mailer:once:<user>:<contactId>:<first|follow1|follow2|next|counter>` claimed with SET NX. `/api/send` takes `once` and answers `409 duplicate` (with the Message-ID when known); the browser records that as sent. Clear refusals free the key; timeouts keep it.
- No lost sends: `mergeState(stored, incoming)` in `lib/engine.js` runs on every `PUT /api/state` and every scheduler save. Progress fields (send, follow-up, next/counter/answer, newer reply, failed first send, campaign done) win from whichever copy is further along. `resetAt`, `replyClearedAt` and campaign `editedAt` mark deliberate undos in the browser. PUT returns the merged `state` when it differs; the browser adopts it, and polls `/api/state` every 45 s.
- Settings: `auto {on, follow, next, counter}` (counter off by default), `autoDays weekdays|all`, `workStart`, `workEnd`. State: `cronAt`, `cronLog[]`, `cronDigest`. While the scheduler ran in the last 25 minutes the browser does not auto-start campaigns.
- Tests: `MAIL_TEST_JSON=1` (with `MAIL_TEST_LOG=<file>`) makes `lib/mail.js` build messages without sending and makes IMAP return nothing. Never set it in Vercel. Point `KV_REST_API_URL` at a fake Upstash REST server to test the scheduler.

## Roadmap: next features (planned, not built)

- AI-drafted answers for "needs your reply" creators, saved as editable drafts.
- Dashboard tab: weekly totals and per-campaign / per-template reply and interest rates.
- Per-account caps with a warm-up ramp for new inboxes.
