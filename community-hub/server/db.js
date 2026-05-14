'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'community.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'individual'
                        CHECK(role IN ('admin','moderator','public_resource','individual','caregiver')),
    display_name TEXT,
    bio         TEXT,
    phone       TEXT,
    organization TEXT,
    avatar_url  TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance     REAL    NOT NULL DEFAULT 0.00,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS resources (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT,
    category     TEXT    NOT NULL
                         CHECK(category IN ('food','housing','medical','mental_health','legal','utilities','childcare','transportation','employment','clothing','other')),
    address      TEXT,
    city         TEXT,
    phone        TEXT,
    website      TEXT,
    hours        TEXT,
    is_free      INTEGER NOT NULL DEFAULT 1,
    status       TEXT    NOT NULL DEFAULT 'active'
                         CHECK(status IN ('active','needs_review','archived')),
    submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    last_verified TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT    NOT NULL
                         CHECK(type IN ('iso','job','event','resource_announce')),
    title        TEXT    NOT NULL,
    body         TEXT    NOT NULL,
    category     TEXT,
    tags         TEXT,
    is_pinned    INTEGER NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','approved','rejected','archived')),
    expires_at   TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body         TEXT    NOT NULL,
    is_read      INTEGER NOT NULL DEFAULT 0,
    is_reported  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    description  TEXT,
    category     TEXT,
    price        REAL    NOT NULL CHECK(price >= 0),
    image_url    TEXT,
    status       TEXT    NOT NULL DEFAULT 'available'
                         CHECK(status IN ('available','sold','removed')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id   INTEGER NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    buyer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount       REAL    NOT NULL,
    fee          REAL    NOT NULL,
    seller_payout REAL   NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'completed'
                         CHECK(status IN ('completed','refunded')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Indexes ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_resources_category   ON resources(category);
  CREATE INDEX IF NOT EXISTS idx_resources_city        ON resources(city);
  CREATE INDEX IF NOT EXISTS idx_resources_status      ON resources(status);
  CREATE INDEX IF NOT EXISTS idx_posts_type            ON posts(type);
  CREATE INDEX IF NOT EXISTS idx_posts_status          ON posts(status);
  CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_recipient    ON messages(recipient_id);
  CREATE INDEX IF NOT EXISTS idx_listings_seller       ON listings(seller_id);
  CREATE INDEX IF NOT EXISTS idx_listings_status       ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_buyer    ON transactions(buyer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_seller   ON transactions(seller_id);
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const seedResources = [
  // Food
  { title: 'Downriver Community Conference Food Pantry', description: 'Emergency food assistance for families in need. Serves multiple downriver communities.', category: 'food', address: '15145 Reaume Pkwy', city: 'Southgate', phone: '734-285-8091', website: 'https://downrivercommunityconference.org', hours: 'Mon-Fri 9am-4pm', is_free: 1 },
  { title: 'Holy Trinity Food Pantry', description: 'Free groceries for residents of Lincoln Park, Melvindale and Allen Park.', category: 'food', address: '1421 Dix-Toledo Hwy', city: 'Lincoln Park', phone: '313-382-7144', hours: 'Tue & Thu 10am-12pm', is_free: 1 },
  { title: 'Trenton Food Bank', description: 'Food distribution for Trenton and Grosse Ile residents. Bring proof of residency.', category: 'food', address: '2725 West Rd', city: 'Trenton', phone: '734-676-9777', hours: 'Mon & Wed 10am-1pm', is_free: 1 },
  { title: 'Wyandotte Community Center Meals', description: 'Hot meals served Tuesday and Thursday evenings, no questions asked.', category: 'food', address: '3131 Biddle Ave', city: 'Wyandotte', phone: '734-324-7200', hours: 'Tue & Thu 5pm-7pm', is_free: 1 },
  { title: 'Riverview Community Food Closet', description: 'Supplemental groceries for Riverview residents. One visit per month per household.', category: 'food', address: '14100 Civic Park Dr', city: 'Riverview', phone: '734-479-2277', hours: 'First Sat 9am-12pm', is_free: 1 },

  // Housing
  { title: 'Wayne Metro Community Action Agency – Housing', description: 'Rental assistance, eviction prevention, and utility help for Wayne County residents.', category: 'housing', address: '2121 Michigan Ave', city: 'Detroit', phone: '313-388-9799', website: 'https://waynemetro.org', hours: 'Mon-Fri 8:30am-4:30pm', is_free: 1 },
  { title: 'SOS Community Services', description: 'Emergency shelter, transitional housing, and rapid rehousing services.', category: 'housing', address: '10 N Washington St', city: 'Ypsilanti', phone: '734-485-8730', website: 'https://soscs.org', hours: 'Mon-Fri 8am-5pm', is_free: 1 },
  { title: 'Downriver Guidance Center – Emergency Housing', description: 'Crisis housing referrals and homelessness prevention for downriver residents.', category: 'housing', address: '2200 Biddle Ave', city: 'Wyandotte', phone: '734-285-8941', hours: 'Mon-Fri 9am-5pm', is_free: 1 },

  // Medical
  { title: 'Oakwood Heritage Hospital – Free Clinic', description: 'Free primary care clinic for uninsured and underinsured downriver patients.', category: 'medical', address: '10000 Telegraph Rd', city: 'Taylor', phone: '313-295-5000', hours: 'Wed 5pm-8pm', is_free: 1 },
  { title: 'Downriver Health Department', description: 'Immunizations, STI testing, TB testing, and family planning at low or no cost.', category: 'medical', address: '29200 Hall Rd', city: 'Woodhaven', phone: '734-379-8990', hours: 'Mon-Fri 8am-4:30pm', is_free: 1 },
  { title: 'Greater Detroit Dental – Community Clinic', description: 'Sliding scale dental care including extractions, cleanings, and fillings.', category: 'medical', address: '3850 Second Ave', city: 'Detroit', phone: '313-494-6630', hours: 'Mon-Fri 8am-5pm', is_free: 0 },

  // Mental Health
  { title: 'Downriver Guidance Center – Mental Health', description: 'Outpatient counseling, psychiatric services, and crisis intervention. Sliding scale fees.', category: 'mental_health', address: '2200 Biddle Ave', city: 'Wyandotte', phone: '734-285-8941', website: 'https://downriverguidance.org', hours: 'Mon-Fri 8am-8pm', is_free: 0 },
  { title: 'Crisis Line – COPES (Wayne County)', description: '24/7 mental health crisis line for Wayne County residents. Free, confidential.', category: 'mental_health', phone: '800-241-4949', hours: '24/7', is_free: 1 },
  { title: 'NAMI Southeast Michigan', description: 'Free peer support groups, family education, and mental health advocacy.', category: 'mental_health', phone: '248-928-9330', website: 'https://namisem.org', hours: 'Varies by program', is_free: 1 },

  // Legal
  { title: 'Legal Aid & Defender Association', description: 'Free civil legal assistance for low-income Wayne County residents. Covers housing, family, benefits.', category: 'legal', address: '613 Abbott St', city: 'Detroit', phone: '313-964-4130', website: 'https://ladadetroit.org', hours: 'Mon-Fri 9am-5pm', is_free: 1 },
  { title: 'Michigan Legal Help', description: 'Online self-help legal resources and forms for Michigan residents at no cost.', category: 'legal', website: 'https://michiganlegalhelp.org', hours: 'Online 24/7', is_free: 1 },

  // Utilities
  { title: 'LIHEAP – Heat & Electric Assistance', description: 'Low Income Home Energy Assistance Program. Apply through Wayne Metro.', category: 'utilities', address: '2121 Michigan Ave', city: 'Detroit', phone: '313-388-9799', website: 'https://waynemetro.org', hours: 'Mon-Fri 8:30am-4:30pm', is_free: 1 },
  { title: 'SEMCO Energy Assistance Program', description: 'Gas utility assistance for qualifying low-income households in SE Michigan.', category: 'utilities', phone: '800-624-2019', website: 'https://semcoenergy.com', hours: 'Mon-Fri 8am-5pm', is_free: 1 },

  // Childcare
  { title: 'Great Start to Quality – Child Care Subsidy', description: 'State-subsidized childcare for low-income working families in Wayne County.', category: 'childcare', phone: '877-614-7328', website: 'https://greatstarttoquality.org', hours: 'Mon-Fri 8am-5pm', is_free: 0 },
  { title: 'Downriver Head Start', description: 'Free early childhood education and family support services for income-qualifying families.', category: 'childcare', address: '2121 Biddle Ave', city: 'Wyandotte', phone: '734-285-0900', hours: 'Mon-Fri 7:30am-3:30pm', is_free: 1 },

  // Transportation
  { title: 'SMART Bus – Downriver Routes', description: 'Suburban Mobility Authority for Regional Transportation. Reduced fares for seniors and disabled.', category: 'transportation', phone: '866-962-5515', website: 'https://smartbus.org', hours: 'Varies by route', is_free: 0 },
  { title: 'Downriver Transportation Services', description: 'Door-to-door medical transport for seniors and disabled individuals. Income-based pricing.', category: 'transportation', city: 'Wyandotte', phone: '734-284-3140', hours: 'Mon-Fri 8am-5pm', is_free: 0 },

  // Employment
  { title: 'Michigan Works! – Southeast Region', description: 'Free job search, résumé help, skills training, and employer matching services.', category: 'employment', address: '21 S Huron St', city: 'Ypsilanti', phone: '734-544-3030', website: 'https://michiganworks.org', hours: 'Mon-Fri 8am-5pm', is_free: 1 },
  { title: 'Goodwill Industries – Job Training', description: 'Workforce training programs, job placement, and career counseling.', category: 'employment', address: '1330 E Michigan Ave', city: 'Ypsilanti', phone: '734-484-9691', website: 'https://goodwillnorthernmichigan.org', hours: 'Mon-Fri 9am-5pm', is_free: 1 },

  // Clothing
  { title: 'Salvation Army Downriver', description: 'Free clothing vouchers for those in crisis; low-cost thrift store otherwise.', category: 'clothing', address: '18700 Eureka Rd', city: 'Southgate', phone: '734-285-3980', hours: 'Mon-Sat 9am-5pm', is_free: 0 },
  { title: 'St. Vincent de Paul – Wyandotte', description: 'Free clothing, household goods, and emergency assistance for families in need.', category: 'clothing', address: '3175 Biddle Ave', city: 'Wyandotte', phone: '734-282-0020', hours: 'Tue & Fri 10am-1pm', is_free: 1 },
];

const resourceCount = db.prepare('SELECT COUNT(*) as cnt FROM resources').get();
if (resourceCount.cnt === 0) {
  const insertResource = db.prepare(`
    INSERT INTO resources (title, description, category, address, city, phone, website, hours, is_free, status, last_verified)
    VALUES (@title, @description, @category, @address, @city, @phone, @website, @hours, @is_free, 'active', datetime('now'))
  `);
  const seedAll = db.transaction(() => {
    for (const r of seedResources) {
      insertResource.run({
        title: r.title,
        description: r.description || null,
        category: r.category,
        address: r.address || null,
        city: r.city || null,
        phone: r.phone || null,
        website: r.website || null,
        hours: r.hours || null,
        is_free: r.is_free,
      });
    }
  });
  seedAll();
}

module.exports = db;
