// lib/db.js
//
// Stage 1 uses local SQLite (via better-sqlite3) so the whole project runs
// with zero external setup. The schema mirrors the Postgres design in
// technical-spec.md. To move to production, swap this file for a Postgres
// client (e.g. Supabase or `pg`) that speaks the same query shape — the
// rest of the app calls the exported functions below, not SQL directly,
// so the migration is contained to this one file.

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");
const isNew = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_emoji TEXT DEFAULT '🍽️',
  logo_image_url TEXT DEFAULT '',
  cover_image_url TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  currency TEXT DEFAULT 'INR',
  tax_percent REAL DEFAULT 5,
  welcome_animation_enabled INTEGER DEFAULT 1,
  welcome_sound_enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active | grace_period | suspended | trial
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_payment_settings (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  phonepe_qr_image_url TEXT DEFAULT '',
  upi_id TEXT DEFAULT '',
  cash_enabled INTEGER DEFAULT 1,
  online_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  onboarding_fee REAL NOT NULL,
  monthly_fee REAL NOT NULL,
  order_fee REAL NOT NULL,
  grace_period_days INTEGER NOT NULL,
  effective_from TEXT DEFAULT (datetime('now')),
  updated_by TEXT DEFAULT 'system'
);

-- Lets the super admin type their Gmail (or any SMTP provider) address and
-- App Password straight into the app's Email Settings screen instead of
-- having to edit .env / restart the server with a text editor.
CREATE TABLE IF NOT EXISTS smtp_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  from_email TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_contact (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  phone TEXT DEFAULT '',
  phonepe_qr_image_url TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT UNIQUE REFERENCES restaurants(id),
  plan_name TEXT DEFAULT 'Standard',
  onboarding_fee REAL,
  onboarding_paid INTEGER DEFAULT 0,
  monthly_fee REAL,
  order_fee_override REAL,
  platform_fee_enabled INTEGER DEFAULT 1,
  billing_cycle_start TEXT,
  billing_cycle_end TEXT,
  status TEXT DEFAULT 'active',
  grace_period_days INTEGER DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_taxes (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  name TEXT NOT NULL,
  percent REAL NOT NULL,
  type TEXT DEFAULT 'percent', -- 'percent' or 'fixed' (when fixed, the percent column holds the flat rupee amount)
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  category_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  discounted_price REAL,
  image_emoji TEXT DEFAULT '🍲',
  image_url TEXT DEFAULT '',
  is_veg INTEGER DEFAULT 1,
  spice_level TEXT DEFAULT 'none', -- none | mild | medium | hot
  tags TEXT DEFAULT '[]',
  ingredients TEXT DEFAULT '[]',
  allergens TEXT DEFAULT '[]',
  prep_time_minutes INTEGER DEFAULT 15,
  available INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  is_recommended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  table_number TEXT NOT NULL,
  table_name TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT DEFAULT 'percent', -- percent | flat
  discount_value REAL DEFAULT 0,
  min_order_value REAL DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  restaurant_id TEXT REFERENCES restaurants(id),
  table_id TEXT REFERENCES tables(id),
  status TEXT DEFAULT 'pending', -- pending|confirmed|preparing|ready|completed|cancelled
  subtotal REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  tax_breakdown TEXT DEFAULT '[]',
  platform_fee REAL DEFAULT 0,
  total REAL NOT NULL,
  payment_method TEXT, -- cash | online_upi -- NULL until the bill is finalized, after the food is served
  payment_status TEXT DEFAULT 'unpaid', -- unpaid|pending_confirmation|paid|failed
  customer_note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  menu_item_id TEXT REFERENCES menu_items(id),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  addons TEXT DEFAULT '[]',
  item_note TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '',
  reset_token TEXT,
  reset_token_expires TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS super_admin_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  secret_code_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_proofs (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  image_url TEXT NOT NULL,
  amount_claimed REAL,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- pending | acknowledged
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS restaurant_users (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  restaurant_id TEXT REFERENCES restaurants(id),
  role TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  discount_type TEXT DEFAULT 'percent',
  discount_value REAL DEFAULT 0,
  requires_video INTEGER DEFAULT 1,
  allow_instagram_repost INTEGER DEFAULT 0,
  terms_text TEXT DEFAULT '',
  terms_version TEXT DEFAULT 'v1',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id),
  order_id TEXT REFERENCES orders(id),
  session_id TEXT,
  consent_timestamp TEXT DEFAULT (datetime('now')),
  terms_version TEXT,
  agreed_to_submit_content INTEGER DEFAULT 0,
  agreed_to_instagram_use INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  order_id TEXT REFERENCES orders(id),
  campaign_id TEXT REFERENCES campaigns(id),
  rating INTEGER,
  text_feedback TEXT DEFAULT '',
  video_url TEXT DEFAULT '',
  discount_code TEXT DEFAULT '',
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform_fees (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  order_id TEXT REFERENCES orders(id),
  fee_amount REAL NOT NULL,
  settled INTEGER DEFAULT 0,
  settled_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS restaurant_notification_emails (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  email TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT REFERENCES restaurants(id),
  event_type TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Safe migration: if an older data/app.db already exists without the new
// columns, add them without wiping existing data. Ignored if already present.
function tryAddColumn(table, columnDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (e) {
    // column already exists — fine
  }
}
tryAddColumn("restaurants", "logo_image_url TEXT DEFAULT ''");
tryAddColumn("restaurants", "cover_image_url TEXT DEFAULT ''");
tryAddColumn("menu_items", "image_url TEXT DEFAULT ''");
tryAddColumn("orders", "tax_breakdown TEXT DEFAULT '[]'");
tryAddColumn("restaurants", "notes TEXT DEFAULT ''");
tryAddColumn("users", "reset_token TEXT");
tryAddColumn("users", "reset_token_expires TEXT");
tryAddColumn("restaurant_notification_emails", "label TEXT DEFAULT ''");
tryAddColumn("payment_proofs", "type TEXT DEFAULT 'subscription'");
tryAddColumn("subscriptions", "last_payment_confirmed_at TEXT");
tryAddColumn("restaurant_taxes", "type TEXT DEFAULT 'percent'");
tryAddColumn("subscriptions", "platform_fee_enabled INTEGER DEFAULT 1");
tryAddColumn("super_admin_account", "reset_token TEXT");
tryAddColumn("super_admin_account", "reset_token_expires TEXT");
tryAddColumn("restaurants", "instagram_url TEXT DEFAULT ''");
tryAddColumn("restaurants", "banner_messages TEXT DEFAULT '[]'");
tryAddColumn("campaigns", "media_type TEXT DEFAULT 'video'"); // 'video' | 'audio'

// One-time structural migration: older installs created the orders table
// with `payment_method TEXT NOT NULL`, back when payment was chosen at
// order time. Now an order exists for a while with no payment method at
// all (it's decided later, after the food is served), so that NOT NULL
// rule has to go. SQLite can't just ALTER a column's constraint, so this
// rebuilds the table the standard safe way: new table with the right
// shape, copy every row across untouched, swap the names. Runs only once
// -- it checks first and does nothing on a database that's already fixed
// (including on a brand new install using the CREATE TABLE above).
function migrateOrdersPaymentMethodNullable() {
  const col = db
    .prepare("SELECT \"notnull\" FROM pragma_table_info('orders') WHERE name = 'payment_method'")
    .get();
  if (!col || col.notnull === 0) return; // already fine, or table doesn't exist yet

  db.pragma("foreign_keys = OFF");
  db.exec("DROP TABLE IF EXISTS orders_new"); // in case a previous attempt was interrupted
  const rebuild = db.transaction(() => {
    db.exec(`
      CREATE TABLE orders_new (
        id TEXT PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        restaurant_id TEXT REFERENCES restaurants(id),
        table_id TEXT REFERENCES tables(id),
        status TEXT DEFAULT 'pending',
        subtotal REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        tax_breakdown TEXT DEFAULT '[]',
        platform_fee REAL DEFAULT 0,
        total REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'unpaid',
        customer_note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO orders_new SELECT * FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;
    `);
  });
  rebuild();
  db.pragma("foreign_keys = ON");
}
migrateOrdersPaymentMethodNullable();

// Seed a single default platform_settings row if none exists yet.
const settingsRow = db.prepare("SELECT * FROM platform_settings ORDER BY id DESC LIMIT 1").get();
if (!settingsRow) {
  db.prepare(
    `INSERT INTO platform_settings (onboarding_fee, monthly_fee, order_fee, grace_period_days, updated_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(10000, 7000, 3, 3, "system-seed");
}

const contactRow = db.prepare("SELECT * FROM platform_contact WHERE id = 1").get();
if (!contactRow) {
  db.prepare(`INSERT INTO platform_contact (id, phone, phonepe_qr_image_url) VALUES (1, '', '')`).run();
}

module.exports = { db, isNew };
