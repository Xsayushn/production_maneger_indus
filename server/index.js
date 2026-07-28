import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { initDb, query, run, get } from './db.js';
import { generateToken, verifyToken, authenticateToken, requireAdmin } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// 1. Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. Restricted CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'production') {
        return callback(null, true);
      }
      return callback(new Error('CORS policy violation: Origin not allowed.'));
    },
    credentials: true
  })
);

app.use(express.json());

// ----------------------------------------------------
// TIMEZONE PRECISION HELPERS (IST - UTC+5:30)
// Guarantees server date/time matches shop-floor wall clock
// ----------------------------------------------------
export const getISTDateString = (d = new Date()) => {
  const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utcMs + (330 * 60000));
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getISTMinutes = (d = new Date()) => {
  const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utcMs + (330 * 60000));
  return istDate.getHours() * 60 + istDate.getMinutes();
};

// Broadcast function to notify connected, authenticated WebSocket clients
const broadcast = (data) => {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// WebSocket Authentication on Handshake
wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url.split('?')[1]);
  const token = urlParams.get('token');

  if (!token) {
    ws.close(4001, 'Unauthorized: Token required');
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    ws.close(4002, 'Unauthorized: Invalid token');
    return;
  }

  ws.user = user;
  ws.send(JSON.stringify({ type: 'CONNECTED', message: `Authenticated connection active for ${user.name}` }));
});

// Initialize DB schema on start
await initDb();

// Shift Slots Definition (Shift A: 07:00-19:00, Shift B: 19:00-07:00)
const SHIFT_A_SLOTS = [
  '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
  '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
  '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00'
];

const SHIFT_B_SLOTS = [
  '19:00-20:00', '20:00-21:00', '21:00-22:00', '22:00-23:00',
  '23:00-00:00', '00:00-01:00', '01:00-02:00', '02:00-03:00',
  '03:00-04:00', '04:00-05:00', '05:00-06:00', '06:00-07:00'
];

// ----------------------------------------------------
// PUBLIC AUTHENTICATION & LOGIN ENDPOINTS
// ----------------------------------------------------

// Public Worker Roster for Login Dropdown / Auto-Complete
app.get('/api/auth/public-workers', async (req, res) => {
  try {
    const workers = await query(`SELECT id, name, code, department FROM workers WHERE status = 'active' ORDER BY name ASC`);
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server-side Authentication (Admin & Worker Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { role, username, password, workerCode, workerName } = req.body;

    if (role === 'admin') {
      const admin = await get(`SELECT * FROM admins WHERE username = ?`, [username || 'admin']);
      if (!admin) {
        return res.status(401).json({ error: 'Invalid admin username or password.' });
      }

      const isMatch = await bcrypt.compare(password || '', admin.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid admin username or password.' });
      }

      const token = generateToken({
        id: admin.id,
        name: 'System Admin',
        code: 'ADM-001',
        role: 'admin'
      });

      return res.json({
        token,
        user: { id: admin.id, name: 'System Admin', code: 'ADM-001', role: 'admin' }
      });
    } else {
      let worker;
      if (workerCode) {
        worker = await get(`SELECT * FROM workers WHERE code = ? AND status = 'active'`, [workerCode]);
      }
      if (!worker && workerName) {
        worker = await get(`SELECT * FROM workers WHERE name = ? AND status = 'active'`, [workerName]);
      }
      if (!worker && workerName) {
        worker = await get(`SELECT * FROM workers WHERE name LIKE ? AND status = 'active'`, [`%${workerName}%`]);
      }

      if (!worker) {
        return res.status(401).json({ error: 'Worker not found or inactive. Please check your Employee Code.' });
      }

      const token = generateToken({
        id: worker.id,
        name: worker.name,
        code: worker.code,
        role: 'worker',
        department: worker.department,
        shift: worker.shift
      });

      return res.json({
        token,
        user: { id: worker.id, name: worker.name, code: worker.code, role: 'worker', department: worker.department, shift: worker.shift }
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Current User Profile (Token Check)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ----------------------------------------------------
// PROTECTED API ENDPOINTS
// ----------------------------------------------------

// 1. Get Workers (Protected by Auth)
app.get('/api/workers', authenticateToken, async (req, res) => {
  try {
    const { search, department, status, limit } = req.query;
    let sql = `SELECT id, name, code, department, shift, role, status FROM workers WHERE 1=1`;
    let params = [];

    if (search) {
      sql += ` AND (name LIKE ? OR code LIKE ? OR department LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (department) {
      sql += ` AND department = ?`;
      params.push(department);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY name ASC`;
    if (limit) {
      sql += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const workers = await query(sql, params);
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Worker (Protected by Admin Role)
app.post('/api/workers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      code: z.string().min(2).optional(),
      department: z.string().optional(),
      shift: z.string().optional()
    });

    const parsed = schema.parse(req.body);
    const workerCode = parsed.code || `WRK-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await run(
      `INSERT INTO workers (name, code, department, shift, role, status) VALUES (?, ?, ?, ?, 'worker', 'active')`,
      [parsed.name, workerCode, parsed.department || 'Production Line', parsed.shift || 'A']
    );
    res.json({ id: result.id, name: parsed.name, code: workerCode, department: parsed.department, shift: parsed.shift, status: 'active' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Worker Status / Dept / Shift (Protected by Admin Role)
app.put('/api/workers/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, department, shift } = req.body;
    await run(`UPDATE workers SET status = COALESCE(?, status), department = COALESCE(?, department), shift = COALESCE(?, shift) WHERE id = ?`, [status, department, shift, id]);
    const updated = await get(`SELECT id, name, code, department, shift, role, status FROM workers WHERE id = ?`, [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Part Numbers (Protected by Auth)
app.get('/api/parts', authenticateToken, async (req, res) => {
  try {
    const parts = await query(`SELECT * FROM part_numbers ORDER BY part_number ASC`);
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Part Number (Protected by Admin Role)
app.post('/api/parts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { part_number, description, tube_spec, default_hourly_target } = req.body;
    const result = await run(
      `INSERT INTO part_numbers (part_number, description, tube_spec, default_hourly_target) VALUES (?, ?, ?, ?)`,
      [part_number, description || '', tube_spec || '', Math.max(1, parseInt(default_hourly_target) || 840)]
    );
    res.json({ id: result.id, part_number, description, tube_spec, default_hourly_target });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Get Machines (Protected by Auth)
app.get('/api/machines', authenticateToken, async (req, res) => {
  try {
    const machines = await query(`SELECT * FROM machines ORDER BY name ASC`);
    res.json(machines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Assignments (Protected by Auth)
app.get('/api/assignments', authenticateToken, async (req, res) => {
  try {
    const { date, shift } = req.query;
    const targetDate = date || getISTDateString();
    
    let sql = `SELECT * FROM assignments WHERE date = ?`;
    let params = [targetDate];

    if (shift) {
      sql += ` AND shift = ?`;
      params.push(shift);
    }
    
    const assignments = await query(sql, params);
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create or Update Target Assignment (Protected by Admin Role)
app.post('/api/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      date: z.string(),
      shift: z.string(),
      worker_name: z.string(),
      part_number: z.string(),
      machine_name: z.string(),
      planned_hourly_qty: z.number().min(1),
      tube_spec: z.string().optional(),
      job_number: z.string().optional()
    });

    const body = schema.parse(req.body);
    const targetDate = body.date || getISTDateString();
    const targetShift = body.shift || 'A';

    await run(
      `INSERT INTO assignments (date, shift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec, job_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (date, shift, worker_name, part_number, machine_name)
       DO UPDATE SET planned_hourly_qty = EXCLUDED.planned_hourly_qty, tube_spec = EXCLUDED.tube_spec, job_number = EXCLUDED.job_number`,
      [targetDate, targetShift, body.worker_name, body.part_number, body.machine_name, body.planned_hourly_qty, body.tube_spec || '', body.job_number || '']
    );

    const slots = targetShift === 'B' ? SHIFT_B_SLOTS : SHIFT_A_SLOTS;

    const d = new Date(targetDate);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const firstJan = new Date(yr, 0, 1);
    const wk = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

    for (const slot of slots) {
      await run(
        `INSERT INTO hourly_logs (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
         ON CONFLICT (date, shift, time_slot, machine_name, part_number)
         DO UPDATE SET planned_qty = EXCLUDED.planned_qty, worker_name = EXCLUDED.worker_name`,
        [targetDate, yr, mo, wk, targetShift, slot, body.part_number, body.machine_name, body.worker_name, body.planned_hourly_qty]
      );
    }

    const payload = {
      type: 'TARGET_UPDATED',
      data: { date: targetDate, shift: targetShift, worker_name: body.worker_name, part_number: body.part_number, machine_name: body.machine_name, planned_hourly_qty: body.planned_hourly_qty }
    };
    broadcast(payload);

    res.json({ message: 'Target assigned successfully', data: payload.data });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Get Hourly Logs (Protected by Auth, joined with Admin Slot Unlocks)
app.get('/api/hourly-logs', authenticateToken, async (req, res) => {
  try {
    const { date, part_number, machine_name, worker_name, shift } = req.query;
    const targetDate = date || getISTDateString();

    let sql = `
      SELECT h.*, 
        CASE WHEN u.id IS NOT NULL THEN 1 ELSE 0 END AS admin_unlocked
      FROM hourly_logs h
      LEFT JOIN slot_unlocks u 
        ON h.date = u.date 
        AND h.shift = u.shift 
        AND h.time_slot = u.time_slot 
        AND h.machine_name = u.machine_name 
        AND h.part_number = u.part_number
      WHERE h.date = ?
    `;
    let params = [targetDate];

    if (part_number) {
      sql += ` AND h.part_number = ?`;
      params.push(part_number);
    }
    if (machine_name) {
      sql += ` AND h.machine_name = ?`;
      params.push(machine_name);
    }
    if (worker_name) {
      sql += ` AND h.worker_name = ?`;
      params.push(worker_name);
    }
    if (shift) {
      sql += ` AND h.shift = ?`;
      params.push(shift);
    }

    sql += ` ORDER BY h.time_slot ASC`;
    const logs = await query(sql, params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN OVERRIDE SLOT UNLOCK ENDPOINT (Protected by Admin Role)
app.post('/api/hourly-logs/unlock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date, shift, time_slot, machine_name, part_number, worker_name, unlocked } = req.body;
    const targetDate = date || getISTDateString();
    const targetShift = shift || 'A';

    if (unlocked) {
      await run(
        `INSERT INTO slot_unlocks (date, shift, time_slot, machine_name, part_number, worker_name, unlocked_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (date, shift, time_slot, machine_name, part_number)
         DO UPDATE SET worker_name = EXCLUDED.worker_name, unlocked_by = EXCLUDED.unlocked_by`,
        [targetDate, targetShift, time_slot, machine_name, part_number, worker_name || '', req.user.name || 'Admin']
      );
    } else {
      await run(
        `DELETE FROM slot_unlocks WHERE date = ? AND shift = ? AND time_slot = ? AND machine_name = ? AND part_number = ?`,
        [targetDate, targetShift, time_slot, machine_name, part_number]
      );
    }

    const payload = {
      type: 'SLOT_UNLOCKED',
      data: { date: targetDate, shift: targetShift, time_slot, machine_name, part_number, worker_name, unlocked: !!unlocked }
    };
    broadcast(payload);

    res.json({ message: unlocked ? 'Slot unlocked for worker edit' : 'Slot locked', data: payload.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SERVER-SIDE TIME LOCK ENFORCEMENT & ENTRY SAVING (Protected by Auth & IST Timezone)
app.post('/api/hourly-logs', authenticateToken, async (req, res) => {
  try {
    const schema = z.object({
      date: z.string(),
      shift: z.string().optional(),
      time_slot: z.string(),
      part_number: z.string(),
      machine_name: z.string(),
      worker_name: z.string(),
      planned_qty: z.number().nonnegative().optional(),
      produced_qty: z.number().nonnegative(),
      remarks: z.string().optional()
    });

    const body = schema.parse(req.body);
    const logDate = body.date || getISTDateString();
    const logShift = body.shift || 'A';

    // SERVER-SIDE TIME-LOCK VALIDATION (+15 Minutes Grace Period Rule or Admin Unlock Override)
    if (req.user.role !== 'admin') {
      const adminUnlockRecord = await get(
        `SELECT id FROM slot_unlocks WHERE date = ? AND shift = ? AND time_slot = ? AND machine_name = ? AND part_number = ?`,
        [logDate, logShift, body.time_slot, body.machine_name, body.part_number]
      );

      if (!adminUnlockRecord) {
        // Evaluate today's date in Indian Standard Time (IST)
        const todayStr = getISTDateString();
        if (logDate !== todayStr) {
          return res.status(403).json({ error: 'Security Violation: Production records can only be updated for today.' });
        }

        // Evaluate current minutes in Indian Standard Time (IST)
        let currentMins = getISTMinutes();

        const [startStr, endStr] = body.time_slot.split('-');
        let [startH, startM] = startStr.split(':').map(Number);
        let [endH, endM] = endStr.split(':').map(Number);

        if (endH === 0 && startH === 23) endH = 24;

        let slotStartMins = startH * 60 + startM;
        let slotEndMins = endH * 60 + endM;

        if (logShift === 'B' && startH < 7) {
          slotStartMins += 24 * 60;
          slotEndMins += 24 * 60;
          if (currentMins < 7 * 60) {
            currentMins += 24 * 60;
          }
        }

        const graceEndMins = slotEndMins + 15;

        if (currentMins < slotStartMins) {
          return res.status(403).json({ error: `Security Lock: Time slot ${body.time_slot} has not started yet. Ask Admin to grant edit access.` });
        }
        if (currentMins > graceEndMins) {
          return res.status(403).json({ error: `Security Lock: Time slot ${body.time_slot} is closed. Ask Admin to grant edit access.` });
        }
      }
    }

    const d = new Date(logDate);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const firstJan = new Date(yr, 0, 1);
    const wk = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

    await run(
      `INSERT INTO hourly_logs 
       (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (date, shift, time_slot, machine_name, part_number)
       DO UPDATE SET 
         produced_qty = EXCLUDED.produced_qty,
         remarks = EXCLUDED.remarks,
         worker_name = EXCLUDED.worker_name,
         planned_qty = COALESCE(NULLIF(EXCLUDED.planned_qty, 0), hourly_logs.planned_qty),
         updated_at = CURRENT_TIMESTAMP`,
      [logDate, yr, mo, wk, logShift, body.time_slot, body.part_number, body.machine_name, body.worker_name, body.planned_qty || 0, body.produced_qty, body.remarks || '']
    );

    const updatedLog = await get(
      `SELECT * FROM hourly_logs WHERE date = ? AND shift = ? AND time_slot = ? AND machine_name = ? AND part_number = ?`,
      [logDate, logShift, body.time_slot, body.machine_name, body.part_number]
    );

    broadcast({
      type: 'HOURLY_LOG_UPDATED',
      data: updatedLog
    });

    res.json(updatedLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Toggle Supervisor Signoff (Protected by Admin Role)
app.post('/api/hourly-logs/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id, supervisor_approved } = req.body;
    await run(`UPDATE hourly_logs SET supervisor_approved = ? WHERE id = ?`, [supervisor_approved ? 1 : 0, id]);
    
    const updated = await get(`SELECT * FROM hourly_logs WHERE id = ?`, [id]);
    broadcast({ type: 'HOURLY_LOG_UPDATED', data: updated });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historical Analytics Endpoint (Protected by Auth & Admin Role)
app.get('/api/analytics/historical', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period, year, month, week, startDate, endDate, worker, part, machine } = req.query;

    let whereClauses = [];
    let params = [];

    if (year) {
      whereClauses.push('year = ?');
      params.push(parseInt(year));
    }
    if (month) {
      whereClauses.push('month = ?');
      params.push(parseInt(month));
    }
    if (week) {
      whereClauses.push('week_number = ?');
      params.push(parseInt(week));
    }
    if (startDate && endDate) {
      whereClauses.push('date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    if (worker) {
      whereClauses.push('worker_name = ?');
      params.push(worker);
    }
    if (part) {
      whereClauses.push('part_number = ?');
      params.push(part);
    }
    if (machine) {
      whereClauses.push('machine_name = ?');
      params.push(machine);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let groupBy = 'date';
    let selectGroup = 'date AS label, date';

    if (period === 'yearly') {
      groupBy = 'year';
      selectGroup = 'CAST(year AS TEXT) AS label, year';
    } else if (period === 'monthly') {
      groupBy = 'year, month';
      selectGroup = `year || '-' || CASE WHEN month < 10 THEN '0' || CAST(month AS TEXT) ELSE CAST(month AS TEXT) END AS label, year, month`;
    } else if (period === 'weekly') {
      groupBy = 'year, week_number';
      selectGroup = '"W" || week_number || " (" || year || ")" AS label, year, week_number';
    } else if (period === 'hourly') {
      groupBy = 'time_slot';
      selectGroup = 'time_slot AS label, time_slot';
    }

    const trendSql = `
      SELECT 
        ${selectGroup},
        SUM(planned_qty) as total_planned,
        SUM(produced_qty) as total_produced,
        ROUND(CASE WHEN SUM(planned_qty) > 0 THEN (CAST(SUM(produced_qty) AS FLOAT) / SUM(planned_qty)) * 100 ELSE 0 END, 1) as efficiency_percent,
        COUNT(DISTINCT date) as active_days,
        COUNT(id) as total_hours_recorded
      FROM hourly_logs
      ${whereString}
      GROUP BY ${groupBy}
      ORDER BY ${groupBy} ASC
    `;

    const trendData = await query(trendSql, params);

    const summarySql = `
      SELECT 
        SUM(planned_qty) as grand_planned,
        SUM(produced_qty) as grand_produced,
        ROUND(CASE WHEN SUM(planned_qty) > 0 THEN (CAST(SUM(produced_qty) AS FLOAT) / SUM(planned_qty)) * 100 ELSE 0 END, 1) as grand_efficiency,
        COUNT(DISTINCT date) as total_days_worked,
        COUNT(DISTINCT worker_name) as total_workers_active,
        COUNT(DISTINCT part_number) as total_parts_produced
      FROM hourly_logs
      ${whereString}
    `;

    const summary = await get(summarySql, params);

    const remarksSql = `
      SELECT date, time_slot, worker_name, part_number, machine_name, planned_qty, produced_qty, remarks
      FROM hourly_logs
      ${whereString ? whereString + ' AND' : 'WHERE'} remarks != '' AND remarks IS NOT NULL
      ORDER BY date DESC, time_slot DESC
      LIMIT 50
    `;
    const downtimeLogs = await query(remarksSql, params);

    res.json({
      summary,
      trendData,
      downtimeLogs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PRODUCTION STATIC FILE SERVING
// ----------------------------------------------------
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`Serving static production build from ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Production Management Server running on port ${PORT} (IST Timezone Active)`);
});
