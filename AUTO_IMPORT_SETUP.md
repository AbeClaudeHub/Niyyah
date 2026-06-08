# Auto-Import — Connect your chart / platform

Let a trader's platform push fills straight into their Niyyah journal — no CSV,
no manual logging. Works with **TradingView** alerts, **Topstep / Tradovate**,
**MetaTrader 4 / 5**, or anything that can POST to a URL.

Every auto-imported trade flows into the same Sahib leak engine + prayer radar
as a hand-logged one, and is stamped with immediate discipline flags (revenge
re-entry, no prayer logged that day, daily loss-limit breach) so the
accountability signal is there the instant it lands.

---

## How it works

```
platform  ──POST fill (JSON + token)──▶  ingestFill (Cloud Function)
                                              │  resolve token → uid (Admin SDK)
                                              │  map payload → trade
                                              │  compute discipline flags
                                              ▼
                                   users/{uid}.trades  ──▶  client picks up on next load
```

- **`manageIngestToken`** (callable) — the signed-in client mints / rotates /
  revokes a personal ingest token. The plaintext token is returned **once**;
  only its SHA-256 hash is stored, in the server-only `ingestTokens` collection.
- **`ingestFill`** (HTTPS) — the platform POSTs fills here with that token.

The user does all of this from **Settings → Auto-Import · Connect your chart**:
click **Connect**, copy the webhook URL + token, paste them into their platform.

---

## Deploy

```bash
# 1. Functions
cd functions && npm install
firebase deploy --only functions:ingestFill,functions:manageIngestToken

# 2. Security rules (locks the ingestTokens collection to the Admin SDK)
firebase deploy --only firestore:rules
```

The webhook URL is:

```
https://us-central1-<your-project>.cloudfunctions.net/ingestFill
```

(`manageIngestToken` returns the exact URL to the client, so users never have
to construct it by hand.)

---

## Payload

POST JSON. The token may go in the body, a query param (`?token=…`), or an
`X-Niyyah-Token` / `Authorization: Bearer` header.

| Field | Aliases accepted | Notes |
|-------|------------------|-------|
| `symbol` | `instrument`, `ticker` | **required** |
| `date` / `time` | `timestamp`, `datetime`, `entrydate` | required; ISO timestamp, `YYYY-MM-DD`, or `MM/DD/YYYY`. Defaults to now if absent. |
| `action` | `direction`, `side` | `long`/`short`/`buy`/`sell` |
| `price` | `entry`, `entryprice`, `fillprice` | |
| `stop` / `target` / `exit` | `stoploss` / `tp` / `closeprice` | |
| `pnl` | `netpnl`, `profit`, `realized` | presence of `pnl` or `exit` marks the trade **closed** |
| `setup` | `strategy`, `tag` | |
| `notes` | `lesson`, `comment` | |
| `id` | `orderid`, `fillid`, `ticket` | used to de-dupe — same `id` never imports twice |

Send a single object, or batch with `{ "fills": [ {...}, {...} ] }`.

Response: `{ "ok": true, "imported": 1, "skipped": 0 }`.

---

## Per-platform setup

### TradingView
Requires a **paid** TradingView plan (webhooks aren't on the free tier). On an
alert, set **Notifications → Webhook URL** to your URL, and paste into the
alert **Message** box:

```json
{
  "token": "YOUR_TOKEN",
  "symbol": "{{ticker}}",
  "action": "{{strategy.order.action}}",
  "price": "{{close}}",
  "time": "{{timenow}}"
}
```

TradingView substitutes the `{{…}}` placeholders at fire time. Note this logs
the **signal**, not a confirmed broker fill — good for journaling intent.

### Topstep / Tradovate
Topstep runs on TopstepX / Tradovate (Rithmic underneath). Point a small
forwarder — or a Tradovate / ProjectX API poller — at your URL and POST each
real fill. Include `exit` and `pnl` on closed trades so P&L imports.

### MetaTrader 4 / 5
Add a `WebRequest()` call inside an Expert Advisor on `OnTradeTransaction`,
POSTing the same JSON shape. Whitelist the URL under **Tools → Options →
Expert Advisors → Allow WebRequest for listed URL**.

### Anything else (curl test)
```bash
curl -X POST "https://us-central1-<your-project>.cloudfunctions.net/ingestFill" \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN","symbol":"ES","action":"long","price":5300,"exit":5312,"pnl":150}'
```

---

## Security notes

- The token is the credential. It's only ever shown once; rotating issues a new
  one and **immediately disables** the old. Disconnect deletes it entirely.
- `ingestTokens` is locked to `read, write: if false` — only the Cloud
  Functions (Admin SDK) can touch it. A client cannot list tokens or mint one
  that points at another user's `uid`.
- Imports are idempotent on `id`, so a platform retrying a webhook won't create
  duplicate trades.
