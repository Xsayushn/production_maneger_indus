import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Support persistent disk mount on Render (/var/data or /data) or local ./data
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'production.db');

sqlite3.verbose();
const db = new sqlite3.Database(dbPath);

// Helper function to query with Promises
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const initDb = async () => {
  await run(`PRAGMA foreign_keys = ON;`);

  // Admin users table
  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Workers table
  await run(`
    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      department TEXT DEFAULT 'Production Line',
      shift TEXT DEFAULT 'A',
      role TEXT DEFAULT 'worker',
      status TEXT DEFAULT 'active'
    )
  `);

  // Migrations for existing database
  try { await run(`ALTER TABLE workers ADD COLUMN password_hash TEXT`); } catch (e) {}
  try { await run(`ALTER TABLE workers ADD COLUMN department TEXT DEFAULT 'Production Line'`); } catch (e) {}
  try { await run(`ALTER TABLE workers ADD COLUMN shift TEXT DEFAULT 'A'`); } catch (e) {}

  // Machines table
  await run(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      line TEXT DEFAULT 'Main Assembly'
    )
  `);

  // Part numbers table
  await run(`
    CREATE TABLE IF NOT EXISTS part_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT UNIQUE NOT NULL,
      description TEXT,
      tube_spec TEXT,
      default_hourly_target INTEGER DEFAULT 840
    )
  `);

  // Daily/Shift Target Allocations
  await run(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      part_number TEXT NOT NULL,
      machine_name TEXT NOT NULL,
      planned_hourly_qty INTEGER NOT NULL DEFAULT 840,
      tube_spec TEXT,
      job_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, shift, worker_name, part_number, machine_name) ON CONFLICT REPLACE
    )
  `);

  // Hourly production logs
  await run(`
    CREATE TABLE IF NOT EXISTS hourly_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      shift TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      part_number TEXT NOT NULL,
      machine_name TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      planned_qty INTEGER NOT NULL DEFAULT 0,
      produced_qty INTEGER NOT NULL DEFAULT 0,
      remarks TEXT DEFAULT '',
      supervisor_approved INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, shift, time_slot, machine_name, part_number) ON CONFLICT REPLACE
    )
  `);

  // High performance indexes
  await run(`CREATE INDEX IF NOT EXISTS idx_workers_search ON workers(code, name, department);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_logs_date ON hourly_logs(date);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_logs_eval ON hourly_logs(year, month, week_number, date);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_logs_worker ON hourly_logs(worker_name);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_logs_part ON hourly_logs(part_number);`);

  // Seed default admin account securely if none exists
  const existingAdmin = await get(`SELECT id FROM admins WHERE username = 'admin'`);
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPassword, 10);
    await run(`INSERT INTO admins (username, password_hash, role) VALUES ('admin', ?, 'admin')`, [hash]);
    console.log('Default admin account initialized securely.');
  }

  // Auto-seed initial worker roster if empty
  const workerCount = await get(`SELECT COUNT(*) as count FROM workers`);
  if (!workerCount || workerCount.count === 0) {
    console.log('Workers table is empty. Auto-seeding initial worker roster...');
    await import('./seed.js');
  }

  console.log(`Database initialized successfully at ${dbPath}`);
};

export default db;
