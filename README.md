# KaamKaaj

Small web app for a **Work Tracker** and **Reading List**, with email/password authentication.

## Stack

| Layer    | Tech                          |
| -------- | ----------------------------- |
| Frontend | Next.js, TypeScript, Tailwind |
| Backend  | Node.js, Express, TypeScript  |
| Database | SQLite                        |

## Email validation

1. **Format** — RFC-style pattern (local `@` domain with valid labels).
2. **Domain structure** — TLD length, label rules, no invalid hostnames.
3. **Domain DNS** (server) — MX record lookup, then A/AAAA fallback.

Invalid email shows: **"Please enter a valid email address."**

## Run locally

**Recommended — one command (API + frontend together):**

```bash
npm install          # once, at project root
cp frontend/.env.local.example frontend/.env.local   # once
npm run dev
```

Keep that terminal open. App: [http://localhost:3000](http://localhost:3000) · API: [http://localhost:4000](http://localhost:4000)

**Or two terminals:**

```bash
cd backend && npm run dev    # Terminal 1
cd frontend && npm run dev   # Terminal 2
```

If you see **"Failed to fetch"**, the backend is not running.

### Why dev servers stop

`npm run dev` is **not a background service** — it dies when the terminal closes, the machine sleeps, you reboot, or the process is killed. KaamKaaj needs **both** frontend and backend running; starting only one looks like “the app is down.”

## Project layout

```
frontend/     Next.js app (login, work tracker, reading list)
backend/      Express API + auth routes
database/     schema.sql + SQLite file (created on first run)
```

## Reading list (AI)

Paste an article URL; the backend fetches page metadata and generates a **1–3 word category** and **short summary**. Set `OPENAI_API_KEY` in `backend/.env` for best results (optional — falls back to page metadata heuristics).
