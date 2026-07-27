# Industrial Production Management System

A full-stack, real-time industrial production tracking and hourly verification system built with **Node.js, Express, SQLite, WebSockets**, and **React + Vite**.

---

## 🌐 Dedicated URL Routing

- **Worker Shop-Floor Terminal**: `http://site/` (or `http://localhost:3000/`)
  - Dedicated exclusively for workers on the shop floor.
  - Zero Admin visibility or links. Search worker code/name to access hourly verification sheet.
- **Admin Command Center**: `http://site/admin` (or `http://localhost:3000/admin`)
  - Executive management portal. Secure login (`admin` / `admin123`).
  - Target allocation, live deployment matrix, multi-period historical analytics (yearly, monthly, weekly, daily, hourly), and 120+ worker directory.

---

## 🚀 Quick Local Run Instructions

### Prerequisites
- **Node.js** (v18.0.0 or higher) - [Download Node.js](https://nodejs.org/)
- **Git** - [Download Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/Xsayushn/production_maneger_indus.git
cd production_maneger_indus
```

---

### Step 2: Install Project Dependencies
```bash
npm install
```

---

### Step 3: Seed the Database with Sample Data
```bash
npm run seed
```

---

### Step 4: Start the Development Server
```bash
npm run dev
```
- Open Worker Terminal: 👉 **`http://localhost:3000/`**
- Open Admin Portal: 👉 **`http://localhost:3000/admin`**

---

## ☁️ Persistent Data on Render Deployment

Render's free web services use ephemeral disk containers by default (which spin down after 15 mins of inactivity). To ensure custom registered workers and hourly logs **never disappear**, attach a persistent disk on Render:

### Steps for Persistent Data on Render:
1. Open your Web Service on [Render.com](https://render.com/).
2. Go to the **Disks** tab and click **Add Disk**:
   - **Name**: `production-db-disk`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB`
3. Go to **Environment** tab and add an Environment Variable:
   - **Key**: `DATA_DIR`
   - **Value**: `/var/data`

Once saved, SQLite stores `production.db` directly on the persistent disk, keeping all added workers, targets, and logs permanently across restarts, sleep cycles, and redeploys!

---

## 🔑 Login Credentials

### 1. Admin Command Center (`/admin`)
- **Username**: `admin`
- **Password**: `admin123`

### 2. Worker Terminal (`/`)
- **Worker Search**: Type any worker name/code (e.g. `Lavkush`, `Rahul Sharma`, `WRK-1001`, `WRK-1025`)
