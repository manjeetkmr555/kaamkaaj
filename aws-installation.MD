# AWS Lightsail Installation Guide (Single Instance)

This guide deploys KaamKaaj on a single AWS Lightsail Ubuntu instance with:

- Frontend (Next.js)
- Backend (Express)
- Database (PostgreSQL, local container)
- HTTPS reverse proxy (Caddy)

This setup is optimized for low traffic and low cost.

## Architecture

- One Lightsail instance runs all containers.
- Caddy terminates TLS and routes:
  - `https://app.yourdomain.com/api/*` -> backend
  - `https://app.yourdomain.com/*` -> frontend
- Backend and PostgreSQL are private containers (no public host ports).
- Only Caddy is reachable from the internet on `80/443`.

## Backend privacy model (what is hidden)

You asked to avoid exposing backend directly to end users. In this setup:

- End users can access only the public domain (`app.yourdomain.com`).
- Backend port `4000` is **not** published on the host.
- Database port `5432` is **not** published on the host.
- Caddy forwards `/api/*` internally to `backend:4000` over Docker network.

Important: browser clients will still call API URLs like `/api/auth/login` on your
public domain, but they cannot directly reach `backend:4000` or your database.

## Prerequisites

- AWS Lightsail account
- Domain name you control
- Git repository URL for this project
- SSH access to the instance

## 1) Create Lightsail instance

1. Create a Linux/Unix instance (Ubuntu 22.04).
2. Choose at least **2 GB RAM / 1 vCPU** for smoother Next.js builds.
3. Attach a **Static IP** to the instance.
4. In Lightsail networking, allow only:
   - `22` (SSH)
   - `80` (HTTP)
   - `443` (HTTPS)

Do not open `5432` (PostgreSQL) publicly.

## 2) Connect and install Docker

Run on the Lightsail server:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 3) Clone project

This repo is **private** — you must authenticate before cloning.

**Option A: SSH (recommended for the server)**

Generate a key on the Lightsail instance, add the public key to GitHub
(**Settings → SSH and GPG keys** or as a **deploy key** on the repo), then:

```bash
git clone git@github.com:manjeetkmr555/kaamkaaj.git
cd kaamkaaj
```

**Option B: HTTPS with a Personal Access Token**

Create a [GitHub Personal Access Token](https://github.com/settings/tokens) with
`repo` scope. Clone with:

```bash
git clone https://github.com/manjeetkmr555/kaamkaaj.git
cd kaamkaaj
```

When prompted, use your GitHub username and the token as the password.

**Do not use your GitHub account password** — GitHub no longer accepts it for Git
over HTTPS.

## 4) Create production environment file

Create `.env.prod` in the `kaamkaaj` directory:

```env
ADMIN_EMAIL=youremail@example.com
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

DB_NAME=kaamkaaj
DB_USER=kaamkaaj
DB_PASSWORD=replace_with_a_long_random_password
```

Notes:
- Keep `ADMIN_EMAIL` as the first admin account email.
- Leave `ANTHROPIC_API_KEY` empty if you do not want AI summary/category generation.

## 5) Production Docker Compose file

`docker-compose.prod.yml` is already in the repo. Add these to `.env.prod` (replace
placeholders with your values):

```env
FRONTEND_ORIGIN=http://<lightsail_static_ip>
NEXT_PUBLIC_API_URL=http://<lightsail_static_ip>
```

After DNS is ready, change both to `https://app.yourdomain.com` and rebuild the
frontend (see Phase B below).

Important:
- This file intentionally does not expose backend port `4000`.
- This file intentionally does not expose database port `5432`.
- Do not add `ports:` under `backend` or `database`.

## 6) Create Caddy config

Use this in two phases so there is no confusion.

### Phase A: Before DNS is pointed (temporary HTTP test)

`Caddyfile` is already in the repo (listens on `:80`). **Do not paste its contents
into the terminal** — bash will try to run `handle`, `reverse_proxy`, etc. as
commands. The file is used by the Caddy container via `docker-compose.prod.yml`.

With this, you can test from browser using:

- `http://<lightsail_static_ip>`
- `http://<lightsail_static_ip>/health`

For this temporary phase, set `NEXT_PUBLIC_API_URL` and `FRONTEND_ORIGIN` in
`.env.prod` to `http://<lightsail_static_ip>` before the first build.

After DNS is ready, change both to your domain (next section) and rebuild.

### Phase B: After GoDaddy DNS record is added (domain + HTTPS)

After `app.yourdomain.com` points to your Lightsail static IP, replace the
`Caddyfile` with:

```caddy
app.yourdomain.com {
  encode gzip

  handle /api/* {
    reverse_proxy backend:4000
  }

  handle /health {
    reverse_proxy backend:4000
  }

  handle {
    reverse_proxy frontend:3000
  }
}
```

Then reload with:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d caddy
```

If you used static IP for `NEXT_PUBLIC_API_URL` in Phase A, change it to
`https://app.yourdomain.com` and run a rebuild:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build frontend
```

Replace `app.yourdomain.com` with your real domain. Caddy will automatically
issue and renew HTTPS certificates once DNS is propagated.

## 7) Point DNS to Lightsail static IP

At your DNS provider, create:

- `A` record: `app.yourdomain.com` -> `<lightsail_static_ip>`

Wait for DNS propagation.

### GoDaddy DNS quick setup

If your domain is on GoDaddy:

1. Open **My Products** -> your domain -> **DNS** -> **Manage DNS**.
2. Add an `A` record:
   - **Type:** `A`
   - **Name:** `app` (for `app.yourdomain.com`)
   - **Value:** `<lightsail_static_ip>`
   - **TTL:** `1 hour` (or default)
3. Save and wait for propagation (usually a few minutes, can take longer).

Notes:
- For a Lightsail instance static IP, use an `A` record (not `CNAME` to IP).
- If you want root domain (`yourdomain.com`), add:
  - `A` record with **Name:** `@` and **Value:** `<lightsail_static_ip>`
- If you want both root and `www`:
  - Add `A` record for `@`
  - Add `CNAME` record: **Name:** `www` -> **Value:** `@` (or `yourdomain.com`)

## 8) Build and start containers

From `kaamkaaj` directory:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## 9) Verify deployment

Check running services:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see host port mappings only for `caddy` (`80->80`, `443->443`).
`backend` and `database` should have no published host ports.

Check logs:

```bash
docker compose -f docker-compose.prod.yml logs backend --tail 100
docker compose -f docker-compose.prod.yml logs frontend --tail 100
docker compose -f docker-compose.prod.yml logs caddy --tail 100
```

Test in browser:

- `https://app.yourdomain.com`
- `https://app.yourdomain.com/health`

## 10) Useful operations

Restart:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
```

Stop:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Rebuild after code changes:

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## Troubleshooting

- `Invalid username or token` / `Password authentication is not supported`:
  - GitHub no longer accepts account passwords for `git clone`/`git pull`.
  - This repo is private — use SSH or a Personal Access Token with `repo` scope.
- `:80: command not found` / `handle: command not found`:
  - You pasted `Caddyfile` contents into the shell. Edit the file instead:
    `nano Caddyfile` (or `git pull` — the file is in the repo).
- Frontend loads but API fails:
  - Verify `NEXT_PUBLIC_API_URL` is `https://app.yourdomain.com`
  - Verify Caddy route for `/api/*`
- CORS errors:
  - Ensure backend `FRONTEND_ORIGIN` equals your frontend domain exactly
- HTTPS not issuing:
  - Confirm DNS `A` record points to the correct static IP
  - Ensure ports `80` and `443` are open in Lightsail networking
- Backend crashes on startup:
  - Check `DATABASE_URL` and DB credentials in `.env.prod`

## Security notes (minimal)

- Use a strong `DB_PASSWORD`.
- Keep `.env.prod` private and never commit it to Git.
- Keep backend private (do not expose port `4000`).
- Keep PostgreSQL private (do not expose port `5432`).

---

This is a low-cost setup intended for small traffic workloads on a single host.
