# 🏘️ Downriver Community Hub

A community-driven web application serving the **Downriver Southeast Michigan** region — a free interconnected hub for neighbors, caregivers, and public resources to connect, share, and support one another.

## ✨ Features

### 🆓 Free Resources Directory
- Curated, categorized list of **25+ pre-seeded** local resources (food banks, housing, medical, mental health, legal aid, utilities, childcare, transportation, employment, clothing)
- Specific to downriver SE Michigan: Wyandotte, Trenton, Southgate, Lincoln Park, Riverview, Woodhaven, Taylor, and more
- Search and filter by category, city, or keyword
- Auto-flags resources as "needs review" if not verified in 90 days
- Role-based add/edit: admins/moderators can manage all; public resources manage their own; individuals can suggest

### 📋 Agora Bulletin Board
- Post types: **ISO** (in search of), **Job Listing**, **Event**, **Resource Announcement**
- Moderation queue for community posts (auto-approved for staff)
- Staff can **pin** important posts and **archive** stale ones
- Filter by type, category, or search
- Expiry dates on events with auto-archival

### 💬 Direct Messaging
- Role-constrained messaging channels:
  - Individual ↔ Caregiver
  - Individual ↔ Public Resource
  - Caregiver ↔ Public Resource
  - Admins/Moderators ↔ anyone
- **Real-time** delivery via Socket.io
- Unread badge counters + typing indicators
- Report abusive messages for admin review

### 🛒 Community Bazaar
- List items for sale (title, description, photos, category, price)
- Browse/search/filter listings
- In-app wallet system — no external payment processors
- **2% platform fee** per transaction (e.g. $10 → seller gets $9.80, platform keeps $0.20)
- Buyer/seller dashboards: purchases, sales history, earnings summary

### 👥 User Roles
| Role | Key Permissions |
|---|---|
| **Admin** | Full access, manage users and roles |
| **Moderator** | Approve/reject posts, verify resources, view reports |
| **Public Resource** | Manage own resource listings, post to board |
| **Caregiver** | Message individuals and resources, post, buy/sell |
| **Individual** | Message caregivers and resources, suggest resources, post, buy/sell |

### ⚙️ Admin Dashboard
- User management (role changes, activate/suspend)
- Moderation queue for pending board posts
- Resources flagged for review
- Reported messages review

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
cd community-hub
npm install
```

### Configuration (optional)

Create a `.env` file in `community-hub/`:

```env
PORT=3737
JWT_SECRET=your-secret-key-change-this-in-production
DB_PATH=./data/community.db
CORS_ORIGIN=*
```

> **Important:** Always set a strong `JWT_SECRET` in production.

### Running

```bash
# Development (with auto-restart on file changes)
npm run dev

# Production
npm start
```

The app will be available at: **http://localhost:3737**

On first startup, the database is automatically created and seeded with 25+ downriver SE Michigan community resources.

---

## 🏗️ Architecture

```
community-hub/
├── server/
│   ├── index.js              # Express entry point + HTTP server
│   ├── db.js                 # SQLite schema + seed data
│   ├── socket.js             # Socket.io real-time messaging
│   ├── routes/
│   │   ├── auth.js           # Register, login, profile, user management
│   │   ├── resources.js      # Free resources CRUD
│   │   ├── board.js          # Bulletin board posts
│   │   ├── messages.js       # Direct messages REST API
│   │   └── bazaar.js         # Listings, wallet, transactions
│   └── middleware/
│       ├── auth.js           # JWT verification middleware
│       └── roles.js          # Role-based access control + messaging rules
├── client/
│   ├── index.html            # SPA shell
│   ├── styles/
│   │   └── main.css          # All styles (dark/light mode)
│   └── js/
│       ├── api.js            # Fetch wrapper
│       ├── app.js            # SPA router + home page + utilities
│       ├── auth.js           # Login/register/profile UI
│       ├── resources.js      # Resources page
│       ├── board.js          # Board page
│       ├── messages.js       # Messaging UI + Socket.io client
│       ├── bazaar.js         # Bazaar marketplace UI
│       └── admin.js          # Admin dashboard
└── data/
    └── community.db          # SQLite database (auto-created)
```

### Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite via `better-sqlite3` (portable, no external DB)
- **Auth**: JWT (`jsonwebtoken`) + bcrypt password hashing (`bcryptjs`)
- **Real-time**: Socket.io
- **Frontend**: Vanilla HTML/CSS/JS (SPA, no framework needed)
- **Payments**: In-app wallet (no external payment processors)

---

## 🔌 API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Sign in, receive JWT |
| GET | `/api/auth/me` | ✅ | Get current user + wallet |
| PATCH | `/api/auth/profile` | ✅ | Update profile |
| PATCH | `/api/auth/password` | ✅ | Change password |
| GET | `/api/auth/users` | Admin | List all users |
| PATCH | `/api/auth/users/:id/role` | Admin | Change user role |
| PATCH | `/api/auth/users/:id/status` | Admin | Activate/suspend user |

### Resources
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/resources` | — | List resources (filter: category, city, status, search) |
| GET | `/api/resources/:id` | — | Get single resource |
| POST | `/api/resources` | ✅ | Add (staff) or suggest (others) |
| PATCH | `/api/resources/:id` | ✅ | Edit resource |
| DELETE | `/api/resources/:id` | Staff | Archive resource |
| POST | `/api/resources/review-stale` | Staff | Flag 90+ day stale resources |

### Board
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/board` | — | List approved posts |
| GET | `/api/board/:id` | — | Get single post |
| POST | `/api/board` | ✅ | Create post |
| PATCH | `/api/board/:id` | ✅ | Edit/moderate post |
| DELETE | `/api/board/:id` | ✅ | Archive post |
| GET | `/api/board/queue/pending` | Staff | Moderation queue |

### Messages
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/messages/conversations` | ✅ | List conversation threads |
| GET | `/api/messages/:partnerId` | ✅ | Get message thread |
| POST | `/api/messages/:partnerId` | ✅ | Send message |
| POST | `/api/messages/:id/report` | ✅ | Report message |
| GET | `/api/messages/unread/count` | ✅ | Unread count |
| GET | `/api/messages/admin/reported` | Staff | View reported messages |

### Bazaar
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/bazaar` | — | Browse listings |
| GET | `/api/bazaar/:id` | — | Single listing |
| POST | `/api/bazaar` | ✅ | Create listing |
| PATCH | `/api/bazaar/:id` | ✅ | Edit listing |
| DELETE | `/api/bazaar/:id` | ✅ | Remove listing |
| POST | `/api/bazaar/:id/buy` | ✅ | Purchase (2% fee) |
| GET | `/api/bazaar/my/listings` | ✅ | Seller's listings |
| GET | `/api/bazaar/my/purchases` | ✅ | Buyer's purchases |
| GET | `/api/bazaar/my/sales` | ✅ | Seller's sales |
| GET | `/api/bazaar/wallet/balance` | ✅ | Wallet balance |
| POST | `/api/bazaar/wallet/deposit` | ✅ | Add wallet funds |

---

## 🔐 Security Notes

- JWT tokens expire after 7 days
- Passwords hashed with bcrypt (10 rounds)
- Role-based middleware on all protected routes
- Messaging restricted by role-pair rules (no arbitrary DMs)
- All transactions are internal — no external payment routing
- Input escaping on all frontend output

---

## 🌍 Downriver Communities Served

Wyandotte · Trenton · Southgate · Lincoln Park · Riverview · Woodhaven · Taylor · Flat Rock · Gibraltar · Rockwood · Allen Park · Melvindale · Ecorse · River Rouge

---

*Part of the TL OS Hub project — portable, community-focused computing.*
