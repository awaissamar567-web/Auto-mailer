# Creator Mailer

Password-protected outreach tool. Paste a creator list, pick a template, and it sends
personalized emails one at a time from your Gmail, then tracks follow-ups and replies.

## Deploy to Vercel

1. **Get a Gmail App Password.** Turn on 2-Step Verification on your Google account, then
   open https://myaccount.google.com/apppasswords and create one. Copy the 16 characters.
2. **Put the code on Vercel.** Either push this folder to a GitHub repo and import it at
   vercel.com/new, or run `npx vercel` inside this folder.
3. **Add environment variables** in Vercel > Project > Settings > Environment Variables:

   | Name | Value |
   | --- | --- |
   | `APP_USERNAME` | the username you'll log in with |
   | `APP_PASSWORD` | a long password you choose |
   | `AUTH_SECRET` | any long random string |
   | `GMAIL_USER` | your Gmail address |
   | `GMAIL_APP_PASSWORD` | the 16-character App Password |
   | `FROM_NAME` | optional, the sender name creators see |

4. **Redeploy** so the variables take effect, then open the site and log in.
5. In the app, click **Check Gmail login**, then **Send a test to myself**.

## Optional: save your list to the cloud

Without this, your list lives in the browser you use (plus any backup file you download).
To sync across devices: Vercel > Storage > Create > Upstash Redis (free), connect it to
this project, and redeploy. The app picks it up on its own.

## Run locally

```
cp .env.example .env.local   # then fill it in
npm install
npm run dev
```

## Notes

- Change `APP_PASSWORD` in Vercel and redeploy to sign out every device.
- Sent emails show up in your Gmail Sent folder. Replies land in your normal inbox.
- Keep the tab open while a batch is sending. The gaps between emails run in the browser.
- Never commit `.env.local`. It is already in `.gitignore`.
