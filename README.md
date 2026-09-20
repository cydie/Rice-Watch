# RiceWatch — Full-Stack Agriculture Monitoring System

Rice-Based Area Monitoring & Analysis System for the Department of Agriculture (Rizal, Palawan). Includes a **responsive web app**, **REST API**, **PostgreSQL database**, and **Electron desktop** client.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + MUI (green DA theme preserved) |
| API | **REST** — Express 5 + JWT auth + Zod validation |
| Database | **PostgreSQL 16** + Prisma ORM |
| Desktop | Electron (wraps the same web UI) |

## Quick start

### 1. Prerequisites

- Node.js 20+
- **PostgreSQL** via [Docker Desktop](#3-start-postgresql-docker) **or** [native install on Windows](docs/DATABASE-SETUP-WINDOWS.md)

### 2. Install dependencies

```bash
npm install
cd server && npm install && cd ..
cd desktop && npm install && cd ..
```

### 3. Start PostgreSQL (Docker)

**Docker Desktop must be running** (Start menu → Docker Desktop → wait until status is *Running*).

```bash
npm run db:up
```

If you see `dockerDesktopLinuxEngine ... cannot find the file`, Docker is installed but not started — see [docs/DATABASE-SETUP-WINDOWS.md](docs/DATABASE-SETUP-WINDOWS.md).

**Without Docker:** install PostgreSQL locally, then skip `db:up` and follow Option B in that doc.

Docker maps Postgres to host port **5435** (avoids conflict if you already have PostgreSQL on 5432/5433).

Copy environment files if needed:

```bash
copy .env.example .env
copy server\.env.example server\.env
```

### 4. Initialize database

```bash
npm run db:setup
```

### 5. Run web + API

```bash
npm run dev
```

This starts **both** Vite (port 5173) and the API (port 4001). If you only run `npm run dev:web`, login will fail with proxy `ECONNREFUSED` errors.

- Web: http://localhost:5173  
- API: http://localhost:4001/api/health  

### 6. Desktop app (optional)

With web and API running:

```bash
npm run dev:desktop
```

## Demo accounts

| Email | Password | Role |
|-------|----------|------|
| admin@da.gov.ph | admin123 | Department Head (Admin) |
| encoder@municipality.gov.ph | encoder123 | Municipal Encoder |
| tech.iraan@da.gov.ph | tech123 | Technician (Iraan) |
| tech.bunog@da.gov.ph | tech123 | Technician (Bunog) |
| tech.canipaan@da.gov.ph | tech123 | Technician (Canipaan) |

Other barangay technicians use `tech.<barangay>@da.gov.ph` / `tech123` (e.g. `tech.culasian@da.gov.ph`, `tech.punta.baja@da.gov.ph`).

### Official DS 2026 papers & technician uploads

Official municipal papers live in `data/official/`. Blank templates live in `data/templates/`. Official-aligned filled starters (per barangay) are built under `data/templates/filled/`.

```bash
cd server
npm run db:import-official   # load official planting/harvest/standing papers
npm run templates:build      # blank + official-aligned filled masterlists
```

In the app, open **Paper Reports**:
1. Technician opens the **Technician input guide** (official DS 2026 targets for their barangay)
2. Download **official-aligned fill** (or blank template) → adjust if needed → upload
3. System updates that barangay’s reports only
4. Department Head uses **Generate municipal paper** to rebuild the DA-style cumulative Excel

Password reset demo OTP: **123456**

## Features (all wired to API)

- Login, forgot password (JWT + PostgreSQL); admin-only technician account creation
- Dashboard with live charts from database
- Planting / harvest / standing crop CRUD
- User management & barangay/sitio management (admin)
- Paper Reports (technician masterlists → municipal DA Excel)
- Municipal Rice Map (Leaflet choropleth by planted/harvested/standing)
- Yield Forecast with MAE/MAPE model card (transparent municipal estimator)
- Early Warning Center (standing-crop risk scores + admin notifications)
- Analytics with real period yield trends, research metrics, and NRS Research Pack export (admin)
- Farmers Data (FIMS import/view/CSV)
- Notifications panel (mark all read)
- Responsive layout (mobile drawer, tablet, desktop)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Web + API (use this) |
| `npm run dev:web` | Web only (Vite) |
| `npm run dev:api` | API only |
| `npm run dev:desktop` | Web + API + Electron |
| `npm run build` | Production web build |
| `npm run db:setup` | Prisma push + seed |

## Project structure

```
Rice-Watch/
├── src/                 # React frontend
├── server/              # Express REST API + Prisma
├── desktop/             # Electron app
├── docker-compose.yml   # PostgreSQL
└── dist/                # Web build (for desktop packaging)
```

## API endpoints (sample)

- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET|POST|PUT|DELETE /api/planting-reports`
- `GET /api/export/:type` — CSV download

Original UI design: [Figma — Agriculture Management System](https://www.figma.com/design/Rk2WK4lGrDumAj0VeA2J8E/Agriculture-Management-System).
