---
name: "creator-lead-csv"
description: "Turn pasted creator emails, Instagram links or handles into a Creator Mailer CSV (name, email, handle, niche, line) with a real personal opener per creator."
---

# Creator lead CSV

Turn whatever the user pastes (emails, Instagram profile links, @handles, or a messy mix) into a CSV that pastes straight into Creator Mailer's **Add creators** box.

## Output format (must match the mailer exactly)

Header row, always these five columns in this order:

```
name,email,handle,niche,line
```

- **name**: the creator's real display name, like `Sara Khan`. The mailer uses the first word as `{{first_name}}`. If you can't find a real name, leave it blank. Never use the handle as the name. The template falls back to "Hey there".
- **email**: lowercase. Only an email the user gave you, or one shown publicly on the creator's profile (bio text or the business Email button). **Never guess or build an email from a name or handle.**
- **handle**: `@username` format. Convert links: `https://www.instagram.com/sara.fit/?hl=en` becomes `@sara.fit`. Strip query strings, trailing slashes and `/reels`, `/p/...` paths.
- **niche**: 1 to 3 lowercase words from what they actually post. Prefer these labels so templates stay consistent: `fitness coach`, `online fitness coach`, `gym coach`, `nutrition coach`, `yoga instructor`, `ugc creator`, `fitness creator`. Leave blank if unclear.
- **line**: the personal opener (rules below). Leave blank if you haven't seen their real content.

CSV rules: comma-separated, one row per creator. Wrap a field in double quotes if it contains a comma, quote or line break, and double any quotes inside it. No blank rows, no extra columns unless the user asks for them. Any extra column becomes its own `{{tag}}` in the mailer.

## Steps

1. **Parse the input.** Pull out every email, Instagram URL and `@handle`. Pair an email with a handle when they sit on the same line or are clearly the same person. Ignore anything that isn't a creator, like the user's own notes.
2. **Deduplicate.** Match on email first, then on handle. Merge details from duplicates into one row.
3. **Look up each profile, when you have a way to.** In order of preference:
   - An Instagram scraping tool that is connected (for example an Apify Instagram profile scraper). Read the full name, bio, public business email, category and the captions of the latest 6 to 12 posts.
   - Web fetch or search on the profile URL. Instagram often blocks this, so expect gaps.
   - If neither works, don't invent anything. Fill what the user gave you and leave the rest blank.
   Use public information only. Skip private accounts and say so.
4. **Write the `line` for each creator you could actually read** (rules below).
5. **Split the results.**
   - **Ready rows:** have a valid email. These go in the CSV.
   - **No email found:** list these separately as `@handle (profile link)` so the user can DM them instead. Don't put them in the CSV, because the mailer would flag them as bad emails.
6. **Deliver.** Always save the CSV as a file named `creators-YYYY-MM-DD.csv` and send it, because the user uploads the file straight into the mailer. If there are 30 rows or fewer, also show the CSV in a code block so it can be copied and pasted directly.
7. **Report in a few short lines:** rows ready, rows with a personal line, creators with no email (listed), duplicates merged, and profiles you couldn't read.

## Writing the `line`

The line becomes its own paragraph, right after "Hey {first_name}," and right before the pitch. It shows you actually watched their stuff.

- **One sentence, 8 to 20 words**, starting with a capital letter and ending with a period.
- **Point to something specific and real** from their content: a series, a format, a result, a recurring segment, how they explain things. Example: `Your 20-minute home workout series is really useful, especially the form cues.`
- **Natural American English, casual-professional.** It should sound like a person typing, not a marketer.
- **No pitch, no question, no emojis, no exclamation marks, no hashtags.**
- **Avoid AI-sounding and filler words:** truly, amazing, incredible, game-changer, resonates, inspiring journey, top-notch, I stumbled upon, love what you're doing.
- **Don't overpraise.** One clear, accurate compliment beats three adjectives.
- **Never invent details.** If you didn't see it, don't mention it. A blank line is fine, because the template has a general fallback opener.
- **Vary the lines.** Don't start every row with "Your" or reuse the same structure.

## Example

Input:

```
https://instagram.com/sara.fit
jordan@example.com @jordanmakesugc
coachdee@example.com
```

Output CSV:

```
name,email,handle,niche,line
Jordan Lee,jordan@example.com,@jordanmakesugc,ugc creator,The kitchen product demos you shoot feel like real use instead of an ad.
,coachdee@example.com,,,
```

No email found (DM instead):
- @sara.fit (https://instagram.com/sara.fit)

## Using the CSV in Creator Mailer

Open **Add creators** and drop the CSV file on the upload box, or click **choose a file**. Pasting the rows also works. The mailer turns every column into a tag automatically and shows which tag each column became, with how many creators have a value. Any extra column (for example `followers`) becomes a new tag the user can click to add to their template. Uploading the same creator again updates their row instead of making a duplicate, so it's safe to re-import an enriched list.