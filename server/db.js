import sqlite3 from 'sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const usePostgres = !!process.env.DATABASE_URL;
let pgPool = null;
let sqliteDb = null;

if (usePostgres) {
  console.log('Connecting to Cloud PostgreSQL Database via DATABASE_URL...');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });
} else {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'production.db');
  sqlite3.verbose();
  sqliteDb = new sqlite3.Database(dbPath);
  console.log(`Connecting to Local SQLite Database at ${dbPath}`);
}

// Convert ? placeholders to $1, $2 for Postgres
const formatSql = (sql) => {
  if (!usePostgres) return sql;
  let paramIndex = 1;
  let formatted = sql.replace(/\?/g, () => `$${paramIndex++}`);
  formatted = formatted.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  formatted = formatted.replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
  return formatted;
};

// Universal Query Helper
export const query = async (sql, params = []) => {
  if (usePostgres) {
    const res = await pgPool.query(formatSql(sql), params);
    return res.rows;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

export const get = async (sql, params = []) => {
  if (usePostgres) {
    const res = await pgPool.query(formatSql(sql), params);
    return res.rows[0] || null;
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

export const run = async (sql, params = []) => {
  if (usePostgres) {
    let pgSql = formatSql(sql);
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
    try {
      const res = await pgPool.query(pgSql, params);
      return { id: res.rows[0]?.id || 0, changes: res.rowCount };
    } catch (err) {
      if (err.code === '23505') {
        return { id: 0, changes: 0 };
      }
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }
};

export const initDb = async () => {
  if (!usePostgres) {
    await run(`PRAGMA foreign_keys = ON;`);
  }

  // Admin users table
  await run(`
    CREATE TABLE IF NOT EXISTS admins (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Workers table
  await run(`
    CREATE TABLE IF NOT EXISTS workers (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT,
      department VARCHAR(255) DEFAULT 'Fin Press',
      shift VARCHAR(50) DEFAULT 'A',
      role VARCHAR(50) DEFAULT 'worker',
      status VARCHAR(50) DEFAULT 'active'
    )
  `);

  // Machines table
  await run(`
    CREATE TABLE IF NOT EXISTS machines (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(255) UNIQUE NOT NULL,
      line VARCHAR(255) DEFAULT 'Main Assembly'
    )
  `);

  // Part numbers table (with stock_quantity column)
  await run(`
    CREATE TABLE IF NOT EXISTS part_numbers (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      part_number VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      tube_spec VARCHAR(255),
      default_hourly_target INTEGER DEFAULT 840,
      stock_quantity INTEGER DEFAULT 10000
    )
  `);
  try { await run(`ALTER TABLE part_numbers ADD COLUMN stock_quantity INTEGER DEFAULT 10000`); } catch (e) {}

  // Daily/Shift Target Allocations
  await run(`
    CREATE TABLE IF NOT EXISTS assignments (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      date VARCHAR(50) NOT NULL,
      shift VARCHAR(50) NOT NULL,
      worker_name VARCHAR(255) NOT NULL,
      part_number VARCHAR(255) NOT NULL,
      machine_name VARCHAR(255) NOT NULL,
      planned_hourly_qty INTEGER NOT NULL DEFAULT 840,
      tube_spec VARCHAR(255),
      job_number VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unq_assignments UNIQUE(date, shift, worker_name, part_number, machine_name)
    )
  `);

  // Hourly production logs (with compound unique index on date, shift, time_slot, machine_name, part_number)
  await run(`
    CREATE TABLE IF NOT EXISTS hourly_logs (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      date VARCHAR(50) NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      shift VARCHAR(50) NOT NULL,
      time_slot VARCHAR(50) NOT NULL,
      part_number VARCHAR(255) NOT NULL,
      machine_name VARCHAR(255) NOT NULL,
      worker_name VARCHAR(255) NOT NULL,
      planned_qty INTEGER NOT NULL DEFAULT 0,
      produced_qty INTEGER NOT NULL DEFAULT 0,
      remarks TEXT DEFAULT '',
      supervisor_approved INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unq_hourly_logs UNIQUE(date, shift, time_slot, machine_name, part_number)
    )
  `);

  // Admin Override Slot Unlocks table
  await run(`
    CREATE TABLE IF NOT EXISTS slot_unlocks (
      id ${usePostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      date VARCHAR(50) NOT NULL,
      shift VARCHAR(50) NOT NULL,
      time_slot VARCHAR(50) NOT NULL,
      machine_name VARCHAR(255) NOT NULL,
      part_number VARCHAR(255) NOT NULL,
      worker_name VARCHAR(255) NOT NULL,
      unlocked_by VARCHAR(255) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT unq_slot_unlocks UNIQUE(date, shift, time_slot, machine_name, part_number)
    )
  `);

  // High performance indexes
  try {
    await run(`CREATE INDEX IF NOT EXISTS idx_workers_search ON workers(code, name, department);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_logs_date ON hourly_logs(date);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_logs_eval ON hourly_logs(year, month, week_number, date);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_logs_worker ON hourly_logs(worker_name);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_logs_part ON hourly_logs(part_number);`);
    await run(`CREATE INDEX IF NOT EXISTS idx_unlocks_search ON slot_unlocks(date, shift, time_slot, machine_name, part_number);`);
  } catch (e) {}

  // DATA MIGRATION: Normalize legacy department names & remove Shift C from existing records
  try {
    await run(`UPDATE workers SET department = 'Fin Press' WHERE department LIKE '%Fin Press%' OR department LIKE '%Assembly%';`);
    await run(`UPDATE workers SET department = 'Expander' WHERE department LIKE '%Expander%' OR department LIKE '%Bending%';`);
    await run(`UPDATE workers SET department = 'Punching' WHERE department LIKE '%Punching%' OR department LIKE '%Stamp%';`);
    await run(`UPDATE workers SET department = 'Hairpin' WHERE department LIKE '%Hairpin%' OR department LIKE '%Coil%';`);
    await run(`UPDATE workers SET department = 'Fin Press' WHERE department NOT IN ('Fin Press', 'Expander', 'Punching', 'Hairpin');`);
    await run(`UPDATE workers SET shift = 'A' WHERE shift NOT IN ('A', 'B');`);
    await run(`UPDATE assignments SET shift = 'A' WHERE shift NOT IN ('A', 'B');`);
    await run(`UPDATE hourly_logs SET shift = 'A' WHERE shift NOT IN ('A', 'B');`);
  } catch (err) {
    console.warn('Data migration notice:', err.message);
  }

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
  const countNum = parseInt(workerCount?.count || 0);
  if (countNum === 0) {
    console.log('Workers table is empty. Auto-seeding initial worker roster...');
    await import('./seed.js');
  }

  console.log(`Database initialization complete (${usePostgres ? 'Cloud PostgreSQL' : 'Local SQLite'}).`);
};

export default sqliteDb;
