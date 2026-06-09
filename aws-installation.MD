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

```bash
git clone <your-repo-url>
cd kaamkaaj
```

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

## 5) Create production Docker Compose file

Create `docker-compose.prod.yml` in the `kaamkaaj` directory:

```yaml
services:
  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      PORT: 4000
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@database:5432/${DB_NAME}
      FRONTEND_ORIGIN: https://app.yourdomain.com
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL}
      NODE_ENV: production
    depends_on:
      - database
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://app.yourdomain.com
    environment:
      NEXT_PUBLIC_API_URL: https://app.yourdomain.com
      NODE_ENV: production
    depends_on:
      - backend
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  pg_data:
  caddy_data:
  caddy_config:
```

Important:
- Replace `app.yourdomain.com` with your actual domain.
- This file intentionally does not expose backend port `4000`.
- This file intentionally does not expose database port `5432`.
- Do not add `ports:` under `backend` or `database`.

## 6) Create Caddy config

Use this in two phases so there is no confusion.

### Phase A: Before DNS is pointed (temporary HTTP test)

Create `Caddyfile` in the `kaamkaaj` directory with:

```caddy
:80 {
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

With this, you can test from browser using:

- `http://<lightsail_static_ip>`
- `http://<lightsail_static_ip>/health`

For this temporary phase, set frontend API URL to static IP in
`docker-compose.prod.yml` before first build:

- `NEXT_PUBLIC_API_URL: http://<lightsail_static_ip>`

After DNS is ready, change it back to your domain (next section) and rebuild.

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
