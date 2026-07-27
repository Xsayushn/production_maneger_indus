# Industrial Production Management System

A full-stack, real-time industrial production tracking and hourly verification system built with **Node.js, Express, SQLite, WebSockets**, and **React + Vite**.

---

## 🚀 Quick Local Run Instructions

### Prerequisites
Before running the application, ensure you have the following installed on your machine:
- **Node.js** (v18.0.0 or higher) - [Download Node.js](https://nodejs.org/)
- **Git** - [Download Git](https://git-scm.com/)

---

### Step 1: Clone the Repository
Open your terminal or Command Prompt and run:
```bash
git clone https://github.com/Xsayushn/production_maneger_indus.git
cd production_maneger_indus
```

---

### Step 2: Install Project Dependencies
Run the following command to install all backend and frontend dependencies:
```bash
npm install
```

---

### Step 3: Seed the Database with Sample Data
Populate the SQLite database with sample machines, part numbers, and a 120-worker roster:
```bash
npm run seed
```

---

### Step 4: Start the Development Server
Launch both the Express API backend and Vite React frontend concurrently:
```bash
npm run dev
```

Once started, open your web browser and navigate to:
👉 **`http://localhost:3000/`**

---

## ☁️ Deployment Guide (Render / Railway / Heroku / Cloud)

This repository is configured for **Single-Port Cloud Deployment** where Node.js/Express automatically builds the React frontend, serves the static bundle, and manages WebSocket connections on a single port.

### Deploying on Render (Free Hosting)
1. Sign up on [Render.com](https://render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository: `https://github.com/Xsayushn/production_maneger_indus`.
4. Configure service settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Create Web Service**. Your live production app URL will be generated automatically!

---

## 🔑 Login Credentials & Demo Usage

### 1. Admin Portal
- **Role**: Admin Command Center
- **Username**: `admin`
- **Password**: `admin123`
- **Features**: Assign target rates to workers, view active deployment matrix, inspect real-time hourly fulfillment, view downtime remarks, and evaluate yearly/monthly/weekly/daily performance trends.

### 2. Worker Terminal
- **Role**: Worker Shop-Floor Verification Sheet
- **Login Search**: Search or type any worker name/code (e.g., `Lavkush`, `Rahul Sharma`, `WRK-1001`, `WRK-1025`)
- **Features**: Enter hourly produced quantities, log downtime remarks, and view shift target completion.
- **Time Lock Rule**: Workers can edit produced quantities for a time slot during the slot itself AND up to +15 minutes after it ends.

---

## 🛠️ Project Architecture & Tech Stack

- **Frontend**: React, Vite, Lucide Icons, Recharts, CSS Glassmorphism
- **Backend**: Node.js, Express, WebSockets (`ws`)
- **Database**: SQLite3 (`server/db.js`)
- **Real-Time Layer**: WebSocket server on `/ws`

---

## 📦 Exporting Reports
In the **Admin Portal -> Historical Analytics** tab, click **Export Evaluation Report (CSV)** to download complete historical performance data as a `.csv` file.
