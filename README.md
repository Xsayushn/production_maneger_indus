# Industrial Production Management System

A full-stack, real-time industrial production tracking and hourly verification system built with **Node.js, Express, SQLite / PostgreSQL, WebSockets**, and **React + Vite**.

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

## ☁️ 100% Free Persistent Cloud Database (Render Free Postgres)

Render offers a **100% Free PostgreSQL Database** ($0/mo, no credit card required) that stores all added workers, targets, and production numbers **permanently forever** across restarts and sleep cycles.

### 2-Minute Setup for Free Persistent Storage:
1. Log in to [Render.com](https://render.com/).
2. Click **New +** -> **PostgreSQL**.
3. Set a name (e.g. `indus-db`) and click **Create Database** (selecting the $0/mo Free Plan).
4. Copy the **Internal Database URL** provided by Render.
5. Open your Web Service in Render -> **Environment** tab -> Add Variable:
   - **Key**: `DATABASE_URL`
   - **Value**: *(paste the Internal Database URL)*

Once added, the system automatically switches to Cloud PostgreSQL. Every added worker, target, and log will stay saved **100% permanently for free**!

---

## 🔑 Login Credentials

### 1. Admin Command Center (`/admin`)
- **Username**: `admin`
- **Password**: `admin123`

### 2. Worker Terminal (`/`)
- **Worker Search**: Type any worker name/code (e.g. `Lavkush`, `Rahul Sharma`, `WRK-1001`, `WRK-1025`)
