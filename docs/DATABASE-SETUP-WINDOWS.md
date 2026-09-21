# PostgreSQL on Windows (RiceWatch)

RiceWatch uses **Postgres in Docker**. When Docker Desktop is green, the app creates the database for you.

**You do not need pgAdmin**, SQL Shell, or a local PostgreSQL install.

## Every time you run the project

1. Open **Docker Desktop** (Start menu).
2. Wait until the whale icon is **green** / status is **Running**.
3. In PowerShell, from the project folder:

```powershell
npm run dev
```

That command starts the `ricewatch-db` container, waits until it is healthy, creates tables if needed, seeds demo users if the database is empty, then starts the web app and API.

Login: `admin@da.gov.ph` / `admin123`

Postgres is on host port **5435** (not 5432), so it will not clash with another PostgreSQL on Windows.

## First-time setup only (optional)

Same as `npm run dev`, but stops after the database is ready:

```powershell
npm run db:ready
```

To only start/wait for the container (no Prisma):

```powershell
npm run db:up
```

## Docker is installed but not green

The error `dockerDesktopLinuxEngine ... cannot find the file` means **Docker Desktop is not running**.

1. Open **Docker Desktop** and wait until it says **Running**.
2. Run `npm run dev` again.

If the service stays stopped, run PowerShell **as Administrator** once:

```powershell
Start-Service com.docker.service
```

Then open Docker Desktop again.

## You do not need pgAdmin

`docker-compose.yml` already sets:

- user: `ricewatch`
- password: `ricewatch_secret`
- database: `ricewatch`

Prisma (`npm run db:ready` / `npm run dev`) creates the tables and demo accounts. Do not create the database by hand.

`server/.env` must keep the Docker URL:

```env
DATABASE_URL="postgresql://ricewatch:ricewatch_secret@127.0.0.1:5435/ricewatch?schema=public"
```

## Verify

After `npm run dev` is up, open http://localhost:4001/api/health

In Docker Desktop, `ricewatch-db` should show **healthy** (green).

## If you see `Database step failed`

The container may already be running. Prisma then failed while creating tables.

1. Confirm `ricewatch-db` is **healthy** in Docker Desktop.
2. In the project folder:

```powershell
cd server
npm install
cd ..
npm run db:ready
```

3. `server\.env` must use Docker (port **5435**), not pgAdmin (5432):

```env
DATABASE_URL="postgresql://ricewatch:ricewatch_secret@127.0.0.1:5435/ricewatch?schema=public"
```

