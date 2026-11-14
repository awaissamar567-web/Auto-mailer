---
name: "csv-to-message"
description: "Turn Instagram links or emails into a Creator Mailer CSV, then ask about the offer and write one universal outreach email with tags and fallbacks that works for every row."
---

# CSV to message

Two deliverables from one list of creators:

1. **A CSV** that uploads straight into Creator Mailer, with real emails and a personal opener line per creator.
2. **One universal outreach message** (subject, body, optional follow-up) written with the mailer's tags, so a single template personalizes correctly for every row.

## Order of work

1. **Ask the intake questions first** (below), in one message. Skip any the user already answered in their request.
2. While waiting is not an option (the user is away), build the CSV anyway, then stop and ask before writing the message. Never write a generic message without the answers.
3. Build the CSV (Part 1).
4. Write the message from the answers and the real CSV columns (Part 2).
5. Run the checks (Part 3) and deliver.

## Intake questions

Ask all four together. Use multiple-choice for tone and draft if a question tool is available; the rest are free text.

1. **What is this outreach for, and what should they do after reading?** For example an affiliate partnership, a service pitch or a collab. The ask could be: reply, try a free copy, or book a call.
2. **What exactly do you offer them?** The product or service name, what's inside, the price, what they earn (commission or fee), and any proof you can honestly claim (testimonials, results, numbers).
3. **How should it sound?** For example casual, friendly-professional, direct or warm, and how long.
4. **Do you already have a draft?** If yes, paste it. Keep the user's wording and only add tags and fallbacks.

Only put claims in the message that the user stated. Never invent results, customer counts, testimonials or features.

---

# Part 1: Build the CSV

## Columns

Header row, always these five, in this order:

```
name,email,handle,niche,line
```

- **name**: the creator's real display name, like `Sara Khan`. Strip descriptors from Instagram names (`Lorie | Super Simple Recipes` becomes `Lorie`). The mailer uses the first word as `{{first_name}}`. Leave blank if no real name is shown, or for a duo or brand account. Never use the handle as the name.
- **email**: lowercase. Only an email the user gave you or one shown publicly (bio text, the business Email button, or the creator's own link-in-bio page or website). **Never guess or build an email from a name or handle.**
- **handle**: `@username`. Convert links: `https://www.instagram.com/sara.fit/?hl=en` becomes `@sara.fit`. Strip query strings, trailing slashes and `/reels` or `/p/...` paths.
- **niche**: 1 to 3 lowercase words from what they actually post, kept consistent across the list. Examples: `recipe creator`, `dietitian`, `nutritionist`, `meal prep creator`, `dessert creator`, `fitness coach`, `ugc creator`. Leave blank if unclear.
- **line**: the personal opener (rules below). Blank if you didn't see their real content.

**Extra columns:** add one only when the message uses it (for example `dish` for a recent recipe name). Fill it for every row, or give its tag a fallback in the message. A `link` column overrides the global `{{link}}` per creator, which suits individual affiliate links.

**CSV format:** comma-separated, one row per creator, UTF-8. Quote any field containing a comma, quote or line break, and double quotes inside it. No blank rows.

## Finding emails from Instagram links

1. **Parse and dedupe** every email, Instagram URL and `@handle`. Match duplicates on email first, then handle.
2. **Scrape the profiles** with a connected Instagram tool (for example the Apify Instagram profile scraper): full name, bio, external URL, category and public business email.
3. **Read emails from the bio text.** Watch for formats like `💌 name@x.com`, `Email - name@x.com` and `collabs: name@x.com`.
4. **No email in the bio?** If the bio links to a link-in-bio page (Linktree, Beacons, Stan) or the creator's own site, fetch it and look for a contact email. Use only what is shown.
5. **Flag manager emails.** An agency or talent domain, `mgmt`, or a different person's name (like `sam@talent-agency.example` for Mia) means the email reaches a manager. Keep them in the CSV but list them in the report, because "Hey Mia" lands in Sam's inbox and replies are slower and more formal.
6. **Private or unreachable accounts:** skip them and say so.

## Recent posts for the line

Use an Instagram post scraper for creators who have an email: the latest 6 posts, skipping pinned ones, reading the captions. Don't spend effort on rows with no email.

## Writing the `line`

The line becomes its own paragraph right after the greeting. It proves you watched their content.

- One sentence, 8 to 20 words, capital letter at the start and a period at the end.
- Point to something specific and real: a named series, a recipe, a format, how they explain things.
- Natural American English, casual-professional. No pitch, no question, no emojis, no exclamation marks, no hashtags.
- Avoid AI-sounding filler: truly, amazing, incredible, game-changer, resonates, inspiring journey, top-notch, I stumbled upon, love what you're doing.
- Never invent details. If you didn't see it, leave the line blank. The message's fallback covers it.
- Vary the openings. Don't start most lines with "The" or "Your".
- Avoid sensitive posts (health struggles, body image, grief) even if they are the most recent.

## Split and deliver the CSV

- **Ready rows** (valid email) go in the CSV.
- **No email found** go in a separate list as `@handle (profile link)` with a short note, so the user can DM them.
- Save as `creators-YYYY-MM-DD.csv` and send the file. If there are 30 rows or fewer, also show it in a code block.

---

# Part 2: Write the universal message

## How tags work in Creator Mailer

- **Syntax:** `{{tag}}`, or `{{tag|fallback text}}` to use the fallback when that creator has no value. Tag names are letters, digits and underscores, and are not case-sensitive. A fallback can't contain `}`.
- **Creator tags** come from the CSV row:
  - `{{first_name}}`: the `first_name` column if present, otherwise the first word of `name`.
  - `{{name}}`, `{{handle}}`, `{{niche}}`, `{{line}}`, `{{email}}`.
  - Any extra column becomes a tag. Its header is lowercased and spaces or symbols become underscores, so `Recent Dish` becomes `{{recent_dish}}`.
- **Your tags** come from the **Your details** panel: `{{my_name}}`, `{{brand}}`, `{{product}}`, `{{commission}}`, `{{link}}`. The user fills these in once. A CSV column with the same name overrides it for that creator.
- **Missing value, no fallback:** that creator's email is blocked. The row shows "Needs niche" (for example) and won't send until it's fixed. This is deliberate, so a raw `{{tag}}` never reaches anyone.
- **Empty fallback** `{{tag|}}` drops the tag silently. Blank lines left behind collapse automatically, so a paragraph that is only `{{line|}}` disappears cleanly.
- **Square brackets** like `[product name]` are not placeholders. The preview flags them as leftovers, so never use them.
- **Plain text only.** No HTML, Markdown, bold or bullet formatting. Line breaks are kept. Sign the email inside the template, because no signature is added.
- **Subject** uses the same tags. Keep it under 50 characters (the preview warns over 70) and on one line.
- **Follow-ups** reply in the same Gmail thread with `Re:` plus the first email's subject, so a follow-up template has a body only.
- **Import aliases:** headers like `Full Name`, `Email Address`, `Instagram URL`, `Category` and `Opener` map to the right tags automatically.

## Rules for one message that works on every row

- **Every creator tag either has a natural fallback or is 100% filled in the CSV.** Check the fill counts. A tag filled for 21 of 22 rows needs a fallback.
- **Fallbacks must read naturally** in the sentence: `Hey {{first_name|there}},` and `{{handle|your page}}`, never `{{first_name|FIRSTNAME}}`.
- **The `{{line}}` fallback** is a general but honest compliment that fits the whole niche, for example "I've been going through your recipes and I like how simple and doable you make healthy cooking."
- **Don't over-tag.** Name, line and maybe one more detail is enough. Every extra tag is another way to look templated.
- **Your tags** (`{{product}}`, `{{commission}}`) get no fallback, so the mailer blocks sending until the user fills them in.

## Message craft

**Structure:**

1. `Hey {{first_name|there}},`
2. `{{line|...}}`, as its own paragraph.
3. Who you are and what you offer, in one or two concrete sentences.
4. What's in it for them (commission, effort, what you handle).
5. One low-friction ask, phrased as a question, like "Want me to send you a free copy?"
6. Sign-off: `{{my_name}}` and `{{brand}}` on separate lines.

- **Length:** 90 to 150 words. Short paragraphs of 1 to 3 sentences.
- **Tone:** follow the user's answer. Default to natural American English, casual-professional, confident and specific. It should sound like one person writing to another.
- **No links or attachments in the first email.** Cold emails with links land in spam more often. Offer to send the link, a copy or a demo instead.
- **Avoid spam triggers:** ALL CAPS, multiple exclamation marks, "free!!!", "guaranteed", "act now", "$$$", "100%".
- **Avoid AI-sounding phrasing:** "I hope this email finds you well", "I wanted to reach out", "game-changer", "elevate", "unlock", "in today's fast-paced world".
- **Match the list.** If the CSV is cooking creators, don't call the product "a fitness product" or ask for "coaches". Point out anyone the pitch doesn't fit, for example vegan creators for a meat-heavy recipe product.

**If the user gave a draft:** keep their wording and structure. Replace specifics with tags, add fallbacks, and remove square-bracket placeholders. Don't rewrite their voice unless they ask. Show what you changed in a short list.

**Follow-up (optional):** 1 to 3 sentences that restate the easy ask, for example "Hey {{first_name|there}}, just bumping this in case it got buried. Happy to send the free copy over, no pressure either way." Then the sign-off.

---

# Part 3: Check and deliver

Before delivering, check:

- Every tag in the message exists: built-in, a CSV column, or a Your tag.
- Every creator tag without a fallback is filled for 100% of rows.
- No square brackets, no Markdown, no links in the first email.
- Subject under 50 characters.
- Render the message for two real rows: one with every value filled, and one with missing values so the fallbacks show. Read both out loud in your head. Fix anything that sounds off.

Deliver, in this order:

1. **The CSV file**, plus a short report: rows ready, rows with a personal line, manager emails, the DM-only list, and profiles you couldn't read.
2. **Subject, body and follow-up**, each in its own code block, ready to paste into **Message**. Click **New template** first.
3. **The two rendered previews.**
4. **What to fill in Your details** (for example the product name and commission), and any creators the pitch doesn't fit.

## Using it in Creator Mailer

- **CSV:** open **Add creators**, then drop the file on the upload box or click **choose a file**. Every column becomes a tag automatically, and the summary shows each mapping with how many rows have a value. Uploading the same creators again updates their rows instead of duplicating them.
- **Message:** in **Message**, click **New template**, name it, and paste the subject and body. Set it as **First email uses** under Sending. Paste the follow-up into the **Follow-up** template.
- **Check:** click a few creators to preview their exact email before sending.