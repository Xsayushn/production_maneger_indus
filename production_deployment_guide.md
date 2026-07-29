# Enterprise Production Deployment Guide

This guide details the step-by-step launch configuration to host the **Indus Industrial Production Management System** in a live manufacturing plant with 24/7 zero-downtime uptime, high security, and persistent data storage.

---

## 1. Managed Cloud PostgreSQL Setup (Persistent Data Storage)

> **Do NOT use SQLite in Render production deployments.** Render free/starter web containers use ephemeral filesystems. Any local `.db` file will be wiped clean upon server restarts or code redeployments.

### Instructions:
1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **PostgreSQL**.
3. Set Database Name: `indus-production-db`.
4. Region: Choose the closest region to your plant (e.g. `Singapore` or `Frankfurt`).
5. Click **Create Database**.
6. Once provisioned, copy the **Internal Database URL** (or External Connection String).

---

## 2. Render Web Service Environment Configuration

In your Render Web Service dashboard under **Environment**:

| Environment Variable | Recommended Value / Format | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations & security guards |
| `PORT` | `10000` | Port expected by Render proxy |
| `DATABASE_URL` | `postgres://user:pass@host:5432/dbname?sslmode=require` | Connects server to managed PostgreSQL |
| `JWT_SECRET` | *(Generate 64-char random hex string)* | Encrypts worker & admin session tokens |
| `ADMIN_PASSWORD` | *(Set strong executive password, e.g. `IndusAdmin2026!Plant#1`)* | Overrides default admin password |
| `ALLOWED_ORIGINS` | `https://production-maneger-indus.onrender.com` | Strict CORS whitelist blocking unauthorized domains |

### Generating a Secure 64-character JWT Secret:
In PowerShell or Terminal, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Eliminating Shop-Floor Cold Starts (Instance Upgrade)

Render free instances sleep after 15 minutes of inactivity, taking 30–50 seconds to wake up when a worker hits the terminal.

### Production Solution:
1. In Render Dashboard, open your Web Service `production-maneger-indus`.
2. Click **Settings** → **Instance Type**.
3. Select **Starter ($7/mo)** or **Standard**.
4. This keeps your server running **24/7 without sleeping**, guaranteeing instant response times for shop-floor workers across all shifts.

---

## 4. Security & Shop-Floor Access Control Summary

- **Worker Authentication**: All shop-floor workers require a **4-Digit Security PIN** (default: `1234`). Admin can customize PINs in the Worker Roster.
- **Role-Based Guards**: Admin routes (`/api/workers`, `/api/hourly-logs/approve`, `/api/hourly-logs/unlock`, `/api/analytics`) require `Authorization: Bearer <ADMIN_JWT>`.
- **IST Wall-Clock Lock**: Production logs enforce IST (+5:30 UTC) slot time boundaries (+15 minute grace period) unless explicitly unlocked by Admin.
- **Inventory Protection**: Part allocations automatically verify and decrement stock.
- **Rate Limiting & CORS**: Restricted to plant domain with strict rate limiters against brute-force attacks.
