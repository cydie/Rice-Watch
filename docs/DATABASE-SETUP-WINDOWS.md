# PostgreSQL on Windows (RiceWatch)

## Option A — Docker Desktop (recommended if already installed)

The error `dockerDesktopLinuxEngine ... cannot find the file` means **Docker Desktop is not running**.

1. Open **Docker Desktop** from the Start menu (wait until the whale icon says **Running**).
2. In PowerShell, from the project folder:

```powershell
npm run db:up
npm run db:setup
```

RiceWatch uses host port **5435** (not 5432) so it does not clash with another PostgreSQL already installed on Windows.

If the service stays stopped, run PowerShell **as Administrator** once:

```powershell
Start-Service com.docker.service
```

Then open Docker Desktop again.

---

## Option B — PostgreSQL without Docker

### 1. Install PostgreSQL

- Download: https://www.postgresql.org/download/windows/
- During setup, note your **postgres user password** and keep port **5432**.

Or with winget (if available):

```powershell
winget install PostgreSQL.PostgreSQL.16
```

### 2. Create database and user

Open **SQL Shell (psql)** or pgAdmin and run:

```sql
CREATE USER ricewatch WITH PASSWORD 'ricewatch_secret';
CREATE DATABASE ricewatch OWNER ricewatch;
GRANT ALL PRIVILEGES ON DATABASE ricewatch TO ricewatch;
```

### 3. Point the API at local Postgres

Edit `server\.env`:

```env
DATABASE_URL="postgresql://ricewatch:ricewatch_secret@localhost:5432/ricewatch?schema=public"
PORT=4001
JWT_SECRET=ricewatch-dev-jwt-secret-change-in-production
CORS_ORIGIN=http://localhost:5173
```

If you use only the default `postgres` superuser:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ricewatch?schema=public"
```

(Create the `ricewatch` database first: `CREATE DATABASE ricewatch;`)

### 4. Initialize schema and seed data

```powershell
cd server
npm run db:generate
npm run db:push
npm run db:seed
cd ..
```

Or from the project root:

```powershell
npm run db:setup
```

(Skip `npm run db:up` — that command is only for Docker.)

### 5. Run the app

```powershell
npm run dev:all
```

---

## Verify database connection

```powershell
cd server
npx prisma db execute --stdin <<< "SELECT 1"
```

Or open http://localhost:4001/api/health after `npm run dev:api`.
