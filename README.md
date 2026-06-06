# KaamKaaj

KaamKaaj is a personal productivity web app with email/password authentication. It combines a **Work Tracker** (daily tasks with status columns) and a **Reading List** (saved articles with auto-generated categories and summaries), plus optional sharing between users.

## Features

- **Authentication** — Register and sign in with a verified email and password (minimum 8 characters).
- **Registration allowlist** — Only emails on the allowlist can create an account. Admins manage the list from the admin UI.
- **Work Tracker** — Create tasks, move them between *To do*, *In progress*, and *Done*, and reorder within each column.
- **Reading List** — Paste a URL; the backend fetches page metadata and generates a short category and summary (OpenAI optional).
- **Sharing** — Share your work tracker or reading list with another registered user by email.
- **Admin panel** — Admin users can add or remove emails from the registration allowlist.

## Stack

| Layer    | Technology                    |
| -------- | ----------------------------- |
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| Backend  | Node.js, Express 5, TypeScript |
| Database | PostgreSQL 16                 |
| Deploy   | Docker, Docker Compose        |

## Project structure

```
kaamkaaj/
├── frontend/          Next.js app (auth, dashboard, work tracker, reading list, admin)
├── backend/           Express API
├── database/
│   └── schema.sql     PostgreSQL schema (applied on DB init and backend startup)
├── docker-compose.yml Local full-stack orchestration
└── package.json       Root scripts to run frontend + backend together
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (for PostgreSQL locally, or to run the full stack in containers)
- npm

## Quick start (local development)

### 1. Install dependencies

```bash
npm install              # root (concurrently)
npm install --prefix backend
npm install --prefix frontend
```

Or from the project root after the first `npm install`:

```bash
npm install --prefix backend && npm install --prefix frontend
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at least:

- `DATABASE_URL` — PostgreSQL connection string
- `ADMIN_EMAIL` — Your email; this user becomes admin and is auto-added to the allowlist after they register

### 3. Start PostgreSQL

```bash
docker compose up database -d
```

The schema in `database/schema.sql` is applied automatically on first database start.

### 4. Run the app

**Both services in one terminal (recommended):**

```bash
npm run dev
```

**Or in separate terminals:**

```bash
npm run dev:backend    # API on http://localhost:4000
npm run dev:frontend   # App on http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000).

> Both frontend and backend must be running. If you see a network error on login, check that the API is up at [http://localhost:4000/health](http://localhost:4000/health).

## Docker (full stack)

Run database, backend, and frontend together:

```bash
docker compose up --build
```

| Service   | URL |
| --------- | --- |
| Frontend  | [http://localhost:3002](http://localhost:3002) |
| Backend   | [http://localhost:4000](http://localhost:4000) |
| Postgres  | `localhost:5432` |

The frontend is mapped to port **3002** by default so it does not conflict with a local `npm run dev` on 3000. Override with:

```bash
FRONTEND_PORT=3000 docker compose up --build
```

Pass secrets via environment or a `.env` file in the project root:

```bash
ADMIN_EMAIL=you@example.com OPENAI_API_KEY=sk-... docker compose up --build
```

## Environment variables

### Backend (`backend/.env`)

| Variable          | Required | Description |
| ----------------- | -------- | ----------- |
| `DATABASE_URL`    | Yes      | PostgreSQL connection string |
| `PORT`            | No       | API port (default `4000`) |
| `FRONTEND_ORIGIN` | Prod     | Comma-separated allowed CORS origins (e.g. `https://app.example.com`) |
| `ADMIN_EMAIL`     | Yes*     | Email granted admin role and allowlist entry after registration |
| `OPENAI_API_KEY`  | No       | Enables AI category/summary for reading items |
| `OPENAI_MODEL`    | No       | OpenAI model (default `gpt-4o-mini`) |
| `NODE_ENV`        | Prod     | Set to `production` in production |

\* Required for the first admin user. Without it, no one can manage the allowlist until an admin is set manually in the database.

### Frontend

| Variable               | Required | Description |
| ---------------------- | -------- | ----------- |
| `NEXT_PUBLIC_API_URL`  | Prod     | Backend URL (default `http://localhost:4000` in dev) |

For Docker builds, `NEXT_PUBLIC_API_URL` is passed as a build argument in `docker-compose.yml`.

## Production deployment

1. **Build the backend** — compiles TypeScript to `dist/`:

   ```bash
   cd backend && npm ci && npm run build
   ```

2. **Start the backend** with compiled output (not `tsx`):

   ```bash
   NODE_ENV=production node dist/index.js
   ```

   Or use the Docker image from `backend/Dockerfile`.

3. **Build the frontend**:

   ```bash
   cd frontend && npm ci && NEXT_PUBLIC_API_URL=https://api.your-domain.com npm run build && npm start
   ```

   Or use the Docker image from `frontend/Dockerfile`.

4. **Set production env vars**:

   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://...
   FRONTEND_ORIGIN=https://your-frontend-domain.com
   ADMIN_EMAIL=admin@your-domain.com
   NEXT_PUBLIC_API_URL=https://api.your-domain.com
   ```

5. **Use a managed PostgreSQL** instance. Do not expose default Docker Compose credentials in production.

## Admin setup

1. Set `ADMIN_EMAIL` in `backend/.env` to your email address.
2. Start the backend and register with that email (it must be on the allowlist — the admin email is added automatically on startup).
3. Sign in and open **Admin** from the dashboard to manage the registration allowlist.

Only users with `is_admin = true` in the database can access `/admin` and the admin API routes.

## Email validation

Registration validates email in three steps:

1. **Format** — RFC-style pattern check.
2. **Domain structure** — Valid hostname labels and TLD rules.
3. **DNS** (server-side) — MX record lookup, with A/AAAA fallback.

Invalid emails return: *"Please enter a valid email address."*

Emails not on the allowlist return: *"This email is not authorized to create an account. Contact your administrator."*

## Reading list (AI)

When adding a reading item by URL, the backend:

1. Fetches the page and extracts title/description metadata.
2. Generates a **1–3 word category** and **short summary** using OpenAI if `OPENAI_API_KEY` is set.
3. Falls back to metadata-based heuristics when OpenAI is not configured.

## API overview

| Route prefix        | Purpose |
| ------------------- | ------- |
| `GET /health`       | Health check |
| `/api/auth/*`       | Email validation, register, login |
| `/api/admin/*`      | Allowlist management (admin only) |
| `/api/work/*`       | Work tasks and work-tracker sharing |
| `/api/reading/*`    | Reading items and reading-list sharing |

## Scripts

| Command | Location | Description |
| ------- | -------- | ----------- |
| `npm run dev` | root | Run backend + frontend concurrently |
| `npm run dev:backend` | root | Backend only |
| `npm run dev:frontend` | root | Frontend only |
| `npm run dev` | backend | API with hot reload (`tsx watch`) |
| `npm run build` | backend | Compile TypeScript |
| `npm run start:prod` | backend | Run compiled API |
| `npm run dev` | frontend | Next.js dev server |
| `npm run build` | frontend | Production build |
| `npm start` | frontend | Serve production build |

## License

Private project — all rights reserved unless otherwise specified.
