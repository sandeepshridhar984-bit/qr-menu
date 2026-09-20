# TableServe — QR Restaurant Ordering Platform

Multi-restaurant QR menu & ordering system. Customers scan a table QR code,
browse the menu, and order — no app download, no login required for them.
Each restaurant signs up with its own email/password account and manages its
own menu, offers, video-feedback campaign, tables, and orders from its own
dashboard.

Runs entirely on local SQLite — no external database or API keys needed to
try every flow. See `technical-spec.md` for the full architecture and the
production-scale roadmap (Postgres, real payment gateway, n8n, live AI, etc).

## 1. Run it locally

Requires Node.js 18+.

```bash
npm install
npm run seed      # creates data/app.db + a demo restaurant + demo login
npm run dev        # http://localhost:3000
```

## 2. Log in

Open `http://localhost:3000` — this is the login gateway, not a marketing
page. Two options:

- **Log in** with the seeded demo account:
  - email: `demo@spicegarden.test`
  - password: `demo1234`
- **Set up your restaurant** — a real signup form: restaurant/hotel name,
  a cover photo/logo upload, email, and password. Creates a brand-new
  restaurant with its own menu (empty, ready for you to build), tables,
  and dashboard.

Passwords are hashed (bcrypt) and sessions are stored server-side with an
httpOnly cookie — this is real authentication, not a placeholder.

## 3. What you can do from the dashboard

- **Menu** — create categories, add/edit/delete menu items with photo
  upload, price + discounted price, veg/non-veg, spice level, tags,
  allergens, prep time, popular/recommended badges, and live
  available/unavailable toggling.
- **Offers** — create/pause/delete percentage or flat-amount offers with a
  minimum order value. At checkout, customers see every offer they qualify
  for and pick which one to apply — the discount only applies if they
  select it, not automatically.
- **Taxes** — add as many named taxes/charges as you like (GST, service
  charge, etc). Each active one shows as its own line on the customer's
  bill and in your order records. Turn any of them off without deleting it.
- **Campaigns** — create a video-feedback campaign ("share a video, get
  20% off"). The customer completes it at checkout (terms → rating/feedback
  → video upload) and the discount applies **immediately to that order**
  — not a code for next time. Mutually exclusive with offers (pick one).
  Submissions (rating, text, video) land in the Submissions list below it.
- **Notifications** — add/remove the email addresses of whoever should
  know about a new order (chef, kitchen staff, etc). New orders email
  automatically to this list, and you can manually send any specific order
  from the Orders tab too. Actually sending requires SMTP configured in
  `.env` (see §9) — without it, you'll see a clear "not configured"
  message rather than a silent failure.
- **Tables & QR** — add tables, preview each table's live customer view,
  download/print its QR code, activate/deactivate.
- **Orders** — updates appear **instantly** (real-time push, not polling —
  see §9) with a toast for new orders. Only two statuses: Pending and
  Completed, matching what the customer sees. Mark cash or UPI orders as
  paid, send an order to a notification email on demand, or delete it.
- **Payment settings** — upload your PhonePe/UPI QR code image for
  customers to scan at checkout.
- **Billing** — view your subscription plan/cycle, and your (the platform
  owner's) phone + QR so you can pay your subscription anytime.
- **"👁️ View customer menu"** in the header — opens exactly what your
  customers see, using your first real table (not a hardcoded one).

## 4. The customer flow

`http://localhost:3000/r/spice-garden/table/1` (or `table/2`–`table/6`).

Welcome screen → search/filter menu → "🤖 Help me choose" → item detail with
notes/quantity → cart → checkout (cash or UPI-QR) → order placed → live
status → if the restaurant has an active campaign, an invite to submit
video feedback for a discount code on their next visit.

## 5. Uploaded images/videos

Stored locally under `public/uploads/` (restaurant cover photos, menu item
photos, PhonePe QR images, campaign video submissions). This is fine for
local testing; move to real object storage (S3/Supabase Storage) before
deploying anywhere persistent — see `technical-spec.md` §11.

## 6. Super admin

`http://localhost:3000/super-admin` — separate login from restaurant
clients (`/super-admin/login`). Default credentials for local testing:

- email: `admin@tableserve.local`
- password: `changeme123`

Set your own `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env` before
this is ever reachable outside your own machine.

From here you can:
- See every client at a glance — total count, how many are on free trial,
  payment requested, active, or suspended.
- Set **your phone number and PhonePe QR code** once — this is what shows
  up on a client's dashboard when you request payment from them.
- Change the default onboarding/monthly/per-order rates for future
  signups, or edit any individual client's monthly fee / due date directly.
- Run the billing workflow per client (see below).
- **Platform fee balance** — see exactly how much every restaurant owes
  you from the per-order fee baked into their customers' bills (it's your
  money, not theirs — see §9), and mark it "collected" once you've
  actually received it via bank transfer or UPI.
- **Permanently delete a client** — removes their restaurant, menu,
  orders, offers, campaigns, taxes, and login access entirely. Use this
  when someone doesn't renew. Cannot be undone.

### The trial → payment → active workflow

1. **New signup = free trial.** Nothing is charged, nothing pops up on
   their dashboard, service works normally.
2. **You decide when to ask for payment.** On that client's row in Super
   Admin, click **"Request subscription payment."** This immediately shows
   a popup on their dashboard with the amount due, your phone number, and
   your PhonePe QR code — plus a smaller banner that stays until they've
   paid. Their service keeps running during this stage; nothing is cut off
   automatically.
3. **They pay you directly** (call/WhatsApp/scan the QR) — same
   trust-based, no-gateway pattern as customer UPI payments.
4. **You confirm and activate.** Once you've verified the payment came
   through, click **"Mark as paid & activate"** on their row. This sets
   their subscription to active with a real 30-day cycle starting today.
5. If a client stops paying, use **Suspend** to actually cut off their
   customer-facing menu (it shows a "temporarily unavailable" page instead)
   — that part was already enforced before this workflow was added.

An automated version of steps 2–5 (reminders, grace periods, auto-suspend
on a schedule) is specified in `technical-spec.md` §5 but intentionally
not built — you're doing this by hand and by choice for now.

## 7. Project structure

```
app/
  page.js                          Login/signup gateway (the site's front door)
  login/, signup/                  Real email+password auth pages
  r/[restaurant]/table/[tableId]/  Customer ordering flow
  dashboard/[restaurant]/          Restaurant admin (auth-protected)
  super-admin/                     Platform-wide rate control & restaurant list
  api/
    auth/                          signup, login, logout
    uploads/                       Generic image/video upload (base64 → public/uploads)
    menu/[restaurant]/             Public menu data
    orders/                        Create + look up orders
    ai/recommend/                  Rule-based recommender (real Claude API is a later swap)
    campaigns/submit/              Customer video-feedback + consent submission
    admin/[restaurant]/            Categories, menu items, offers, campaigns, orders,
                                    tables/QR, payment settings — all full CRUD
    super-admin/                   Platform rates, restaurant status
lib/
  db.js                            SQLite schema + connection
  auth.js                          Password hashing, sessions, restaurant-access checks
  uploads.js                       Save base64 file data to public/uploads
  ids.js                           UUIDs + order number generation
scripts/seed.js                    Demo restaurant "Spice Garden" + demo login
technical-spec.md                  Full architecture, schema, and scale-up roadmap
```

## 8. Real-time updates & email setup

Orders appear on the dashboard and the customer's status screen **instantly**
— no polling, no manual refresh. This uses Server-Sent Events (SSE) with an
in-memory pub/sub (`lib/eventBus.js`): the moment an order is created or its
status changes, every open dashboard/confirmation-screen connection gets
pushed the update directly. This works because the app runs as one
persistent process on your machine; if you ever scale to multiple server
instances behind a load balancer, swap the event bus for a real one (Redis
pub/sub) — the subscribe/publish shape stays the same.

To actually send order emails (not just manage the recipient list), add SMTP
credentials to `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=an app password, not your normal password
SMTP_FROM=you@gmail.com
```

Without these set, the "Notifications" tab and the per-order "Send to
email" button still work, but you'll see a clear "email isn't configured
yet" message instead of a silent failure.

## 9. What's still a placeholder

- **n8n notifications** — the webhook call exists and silently no-ops if
  `N8N_WEBHOOK_URL` isn't set in `.env`. (Email itself is real — see §8.)
- **AI recommendations** — rule-based, reads only real/available menu
  items; swapping in the live Claude API is a one-function change (see
  comments in `app/api/ai/recommend/route.js`).
- **Automated billing scheduler** — reminders / grace period / auto-suspend
  on non-payment is fully specified in `technical-spec.md` §5 but not yet
  running as a cron job; use the manual suspend toggle in Super Admin.
- **Online payment** is a manual PhonePe-QR-scan-and-confirm flow, not a
  gateway — money goes straight to the restaurant, so there's no automatic
  verification (see `technical-spec.md` §6 for why, and the trade-off). The
  per-order platform fee is disclosed on the bill and tracked as a balance
  the restaurant owes you (Super Admin → Platform fee balance) — collected
  by you separately via bank/UPI, not split automatically at payment time.

## 10. Moving to production

- Swap `lib/db.js` for a Postgres client (Supabase recommended).
- Move `public/uploads/` to real object storage.
- Add Row-Level Security policies per `technical-spec.md` §3.
- Swap the in-memory event bus (§8) for Redis pub/sub if you run more than
  one server instance.
- Set `N8N_WEBHOOK_URL`, `AI_API_KEY`, SMTP credentials, and a real payment
  gateway for your own subscription billing per `.env.example`.
