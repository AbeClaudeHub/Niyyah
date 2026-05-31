# Push Setup — turning on Sahib's daily nudge

Everything for web push is already wired in code:

- **Client** (`app.js`): permission + `pushManager.subscribe()` → stores the
  subscription on the user doc (`settings.pushSubscription`). The Settings
  toggle appears automatically once `PUSH_VAPID_PUBLIC` is set.
- **Service worker** (`sw.js`): `push` handler renders the notification;
  `notificationclick` routes back into the app.
- **Server** (`functions/dailyNudge.js`): a daily scheduled function that
  reads each user's commitment + state via `decideNudge()` and sends one
  push. It leads with **Sahib's active focus** — *"☽ Sahib — Today's focus:
  hard stops only."* — falling back to post-loss / streak-at-risk / Friday.
- `web-push` is already in `functions/package.json`.

Only four steps remain — all require your Firebase account/secrets, which is
why they aren't in the repo. Nothing changes for users until you finish them.

> Requirements: the Firebase project must be on the **Blaze** plan and have
> the **Cloud Scheduler** + **Pub/Sub** APIs enabled (a scheduled function
> needs them). Stripe functions already imply Blaze, so you're likely set.

## 1. Generate a VAPID key pair (once)

```bash
cd functions
npm install            # pulls web-push (now in package.json)
npx web-push generate-vapid-keys --json
```

You'll get `{ "publicKey": "...", "privateKey": "..." }`. The **public** key
is safe to ship; the **private** key is a secret — never commit it.

## 2. Store the keys in Firebase config (server, secret)

```bash
firebase functions:config:set \
  push.vapid_public="<publicKey>" \
  push.vapid_private="<privateKey>" \
  push.vapid_subject="mailto:support@niyyahtrader.com"
```

## 3. Paste the PUBLIC key into the client

In `app.js`, set:

```js
var PUSH_VAPID_PUBLIC = '<publicKey>';   // same public key as step 1
```

This must match the server's `vapid_public` exactly, or subscriptions are
rejected. Bump the service-worker cache (`CACHE` in `sw.js`) so returning
users get the new client.

## 4. Enable + deploy the scheduled function

In `functions/index.js`, uncomment:

```js
exports.sendDailyNudge = require('./dailyNudge').sendDailyNudge;
```

Then deploy:

```bash
firebase deploy --only functions:sendDailyNudge
```

The function runs daily at **17:00 UTC** (`dailyNudge.js` → `.schedule(...)`
/ `.timeZone(...)` — adjust to your audience). It de-dupes to one push per
user per UTC day via `lastNudgeAt`, and auto-clears dead subscriptions
(HTTP 410/404).

## Verify

1. Open the app → **Settings → Reminders** → the "Sahib's daily nudge"
   toggle now shows (instead of "rolling out"). Enable it and accept the
   browser permission prompt.
2. Confirm `settings.pushSubscription` is written on your user doc in
   Firestore.
3. Force a run: temporarily change the schedule to a near time, or invoke
   from the Cloud Scheduler console, and confirm a notification arrives and
   tapping it opens the app. Then revert the schedule.

## Notes

- Until step 3 is done, the Settings UI honestly shows "rolling out" and
  no one can subscribe — so deploying the function early is harmless (it
  finds zero subscriptions and sends nothing).
- iOS only delivers web push to **installed** PWAs (Add to Home Screen),
  iOS 16.4+. This is the strongest reason to keep nudging install — and to
  ship the optional-email channel as the fallback for everyone else.
