# Deployment Guide

This project deploys with **Vercel** (frontend) and **Fly.io** (backend).

## Architecture

```
[Browser] → [Vercel CDN / Frontend] → /api/* rewrite → [Fly.io / Backend] → [SQLite on Volume]
```

---

## Backend: Fly.io

### Prerequisites

- [Fly CLI](https://fly.io/docs/flyctl/install/) installed
- Fly.io account (`fly auth login`)

### Initial Setup

```bash
cd backend

# Create the app (only once)
fly apps create vermieter-manager-api

# Create a persistent volume for SQLite data
fly volumes create data --region fra --size 1

# Set secrets
fly secrets set JWT_SECRET="your-secure-secret-here"
```

### Deploy

```bash
cd backend
fly deploy
```

### Useful Commands

```bash
# View logs
fly logs

# SSH into the machine
fly ssh console

# Check app status
fly status

# Scale (if needed)
fly scale count 1
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `DATABASE_PATH` | SQLite file path | `/data/app.db` |
| `PORT` | Server port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `JWT_SECRET` | JWT signing secret | **Must set via `fly secrets`** |
| `UPLOAD_PATH` | File upload directory | `/app/uploads` |

> **Important:** Always set `JWT_SECRET` via `fly secrets set` — never commit it to config files.

---

## Frontend: Vercel

### Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed (optional, can deploy via GitHub)
- Vercel account

### Setup via GitHub (Recommended)

1. Push your repo to GitHub
2. Import the project in [Vercel Dashboard](https://vercel.com/new)
3. Set the **Root Directory** to `frontend`
4. Framework Preset: **Vite**
5. Build Command: `npm run build` (auto-detected)
6. Output Directory: `dist` (auto-detected)

### Setup via CLI

```bash
cd frontend
vercel
```

### Configuration

The `frontend/vercel.json` handles:

1. **API proxy** — Rewrites `/api/*` requests to the Fly.io backend
2. **SPA routing** — All other routes serve `index.html` for React Router

### Update API URL

After deploying the backend, update the rewrite destination in `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://YOUR-APP-NAME.fly.dev/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Replace `YOUR-APP-NAME` with your actual Fly.io app name.

---

## Post-Deployment Checklist

- [ ] Backend is running: `curl https://vermieter-manager-api.fly.dev/health`
- [ ] JWT_SECRET is set via `fly secrets`
- [ ] Frontend API rewrite points to correct Fly.io URL
- [ ] CORS is configured if needed (currently the proxy handles same-origin)
- [ ] Volume is attached for SQLite persistence

---

## Local Development (Docker)

For local development with Docker:

```bash
docker-compose up --build
```

This starts both frontend (port 8080) and backend (port 3000) locally.

---

## Troubleshooting

### Backend won't start
- Check logs: `fly logs`
- Verify volume is mounted: `fly volumes list`
- Ensure DATABASE_PATH matches the mount path

### API calls failing from frontend
- Verify the rewrite URL in `vercel.json` matches your Fly.io app URL
- Check CORS settings if not using the Vercel proxy approach
- Test backend directly: `curl https://your-app.fly.dev/api/v1/auth/login`

### Database issues
- SSH in and check: `fly ssh console` then `ls -la /data/`
- SQLite file should be at `/data/app.db`
