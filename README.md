# BarPro POS
## Bar & Restaurant SaaS Management Platform

Cloud-based billing and business management platform for bars and restaurants across India. Multi-tenant SaaS with counter billing, table management, KOT, inventory, and subscription management.

---

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python Flask + SQLAlchemy |
| Database | PostgreSQL 15 |
| Auth | JWT + Role-based access control |
| Cache | Redis |
| Payments | Razorpay |
| Deployment | Docker + Nginx |
| Charts | Recharts |
| Receipt | 80mm thermal printer (ESC/POS) |

## Project Structure

```
barpro/
├── backend/                # Flask API
│   ├── app/
│   │   ├── models/         # SQLAlchemy models
│   │   ├── auth/           # Authentication
│   │   ├── billing/        # POS billing
│   │   ├── products/       # Product management
│   │   ├── inventory/      # Stock management
│   │   ├── orders/         # Table orders
│   │   ├── kot/            # Kitchen order tickets
│   │   ├── purchases/      # Supplier purchases
│   │   ├── expenses/       # Expense tracking
│   │   ├── reports/        # Analytics
│   │   ├── admin/          # Super Admin API
│   │   ├── subscriptions/  # SaaS billing
│   │   └── support/        # Support tickets
│   └── requirements.txt
├── frontend/               # React app
│   └── src/
│       ├── pages/
│       │   ├── customer/   # Bar owner portal
│       │   └── admin/      # Super Admin portal
│       ├── layouts/
│       ├── store/          # Zustand state
│       └── api/            # API client
├── deployment/             # Nginx + setup scripts
├── docker-compose.yml
└── .env.example
```

## Quick Start

### With Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your credentials

bash deployment/setup.sh
# OR on Windows:
docker-compose up -d
docker-compose run --rm backend flask init-db
docker-compose run --rm backend flask seed-plans
docker-compose run --rm backend flask create-superadmin
```

Open http://localhost:3000

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
cp ../.env.example ../.env
# Set DATABASE_URL in .env to your local PostgreSQL

flask db init
flask db migrate -m "initial"
flask db upgrade
flask seed-plans
flask create-superadmin
flask run

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Default Credentials

| Portal | URL | Email | Password |
|--------|-----|-------|----------|
| Super Admin | /login | admin@barpro.in | Admin@123 |
| Customer | /register | (create new) | — |

**Change the default password immediately in production.**

## API Overview

| Prefix | Purpose |
|--------|---------|
| `/api/auth/` | Login, refresh, logout |
| `/api/tenants/` | Business registration |
| `/api/outlets/` | Outlet and table management |
| `/api/dashboard/` | Dashboard statistics |
| `/api/billing/` | POS invoices |
| `/api/orders/` | Table orders |
| `/api/kot/` | Kitchen order tickets |
| `/api/products/` | Product catalog |
| `/api/inventory/` | Stock management |
| `/api/purchases/` | Supplier purchases |
| `/api/expenses/` | Expense tracking |
| `/api/reports/` | Business reports |
| `/api/subscriptions/` | SaaS plan management |
| `/api/admin/` | Super Admin operations |
| `/api/support/` | Support tickets |

## Subscription Plans

| Plan | Price/month | Outlets | Users |
|------|-------------|---------|-------|
| Basic | ₹1,499 | 1 | 3 |
| Standard | ₹2,499 | 3 | 10 |
| Professional | ₹4,999 | 5 | 25 |

## Security Notes

- Every API endpoint is tenant-isolated. One customer cannot access another's data.
- Bills use idempotency keys to prevent duplicate transactions.
- Completed invoices are never deleted; cancellations create reversal records.
- JWT tokens expire after 8 hours.
- Failed login attempts lock the account for 30 minutes after 5 failures.

## Indian Compliance

Before onboarding real customers, configure:
- State-specific excise rules (AP, Telangana, etc.)
- Applicable GST rates per product type
- FSSAI and excise license fields per outlet
- Invoice number format per statutory requirements

Tax rules differ by state. Review with a CA before production rollout.

## Development Phases

- [x] Phase 1: SaaS foundation, auth, tenant isolation
- [x] Phase 2: POS billing, products, inventory
- [x] Phase 3: Table billing, orders, KOT
- [ ] Phase 4: Shift management, advanced reports
- [ ] Phase 5: Razorpay subscription flow
- [ ] Phase 6: Thermal printing, export, monitoring
