import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, query, run, get } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// Broadcast function to notify all connected WebSocket clients in real-time
const broadcast = (data) => {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected to real-time WebSocket');
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Realtime production stream connected' }));
});

// Initialize DB schema on start
await initDb();

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. Get Workers
app.get('/api/workers', async (req, res) => {
  try {
    const { search, department, status, limit } = req.query;
    let sql = `SELECT * FROM workers WHERE 1=1`;
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

// Create New Worker
app.post('/api/workers', async (req, res) => {
  try {
    const { name, code, department, shift } = req.body;
    const workerCode = code || `WRK-${Math.floor(1000 + Math.random() * 9000)}`;
    const result = await run(
      `INSERT INTO workers (name, code, department, shift, role, status) VALUES (?, ?, ?, ?, 'worker', 'active')`,
      [name, workerCode, department || 'Production Line', shift || 'A']
    );
    res.json({ id: result.id, name, code: workerCode, department, shift, status: 'active' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Worker Status
app.put('/api/workers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, department, shift } = req.body;
    await run(`UPDATE workers SET status = COALESCE(?, status), department = COALESCE(?, department), shift = COALESCE(?, shift) WHERE id = ?`, [status, department, shift, id]);
    const updated = await get(`SELECT * FROM workers WHERE id = ?`, [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Part Numbers
app.get('/api/parts', async (req, res) => {
  try {
    const parts = await query(`SELECT * FROM part_numbers ORDER BY part_number ASC`);
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Part Number
app.post('/api/parts', async (req, res) => {
  try {
    const { part_number, description, tube_spec, default_hourly_target } = req.body;
    const result = await run(
      `INSERT INTO part_numbers (part_number, description, tube_spec, default_hourly_target) VALUES (?, ?, ?, ?)`,
      [part_number, description || '', tube_spec || '', default_hourly_target || 840]
    );
    res.json({ id: result.id, part_number, description, tube_spec, default_hourly_target });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Get Machines
app.get('/api/machines', async (req, res) => {
  try {
    const machines = await query(`SELECT * FROM machines ORDER BY name ASC`);
    res.json(machines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Assignments (Admin Targets)
app.get('/api/assignments', async (req, res) => {
  try {
    const { date, shift } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
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

// Create or Update Target Assignment (Admin action)
app.post('/api/assignments', async (req, res) => {
  try {
    const { date, shift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec, job_number } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetShift = shift || 'A';

    await run(
      `INSERT OR REPLACE INTO assignments (date, shift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec, job_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetDate, targetShift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec || '', job_number || '']
    );

    const slots = [
      '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
      '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
      '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00'
    ];

    const d = new Date(targetDate);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const firstJan = new Date(yr, 0, 1);
    const wk = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

    for (const slot of slots) {
      await run(
        `INSERT INTO hourly_logs (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')
         ON CONFLICT(date, shift, time_slot, machine_name, part_number) 
         DO UPDATE SET planned_qty = ?, worker_name = ?`,
        [targetDate, yr, mo, wk, targetShift, slot, part_number, machine_name, worker_name, planned_hourly_qty, planned_hourly_qty, worker_name]
      );
    }

    const payload = {
      type: 'TARGET_UPDATED',
      data: { date: targetDate, shift: targetShift, worker_name, part_number, machine_name, planned_hourly_qty }
    };
    broadcast(payload);

    res.json({ message: 'Target assigned successfully', data: payload.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Get Hourly Logs
app.get('/api/hourly-logs', async (req, res) => {
  try {
    const { date, part_number, machine_name, worker_name, shift } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let sql = `SELECT * FROM hourly_logs WHERE date = ?`;
    let params = [targetDate];

    if (part_number) {
      sql += ` AND part_number = ?`;
      params.push(part_number);
    }
    if (machine_name) {
      sql += ` AND machine_name = ?`;
      params.push(machine_name);
    }
    if (worker_name) {
      sql += ` AND worker_name = ?`;
      params.push(worker_name);
    }
    if (shift) {
      sql += ` AND shift = ?`;
      params.push(shift);
    }

    sql += ` ORDER BY time_slot ASC`;
    const logs = await query(sql, params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post / Update Hourly Entry (Worker action)
app.post('/api/hourly-logs', async (req, res) => {
  try {
    const { date, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks } = req.body;
    const logDate = date || new Date().toISOString().split('T')[0];
    const logShift = shift || 'A';

    const d = new Date(logDate);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const firstJan = new Date(yr, 0, 1);
    const wk = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

    await run(
      `INSERT INTO hourly_logs 
       (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(date, shift, time_slot, machine_name, part_number)
       DO UPDATE SET 
         produced_qty = ?,
         remarks = ?,
         worker_name = ?,
         planned_qty = COALESCE(NULLIF(?, 0), planned_qty),
         updated_at = CURRENT_TIMESTAMP`,
      [logDate, yr, mo, wk, logShift, time_slot, part_number, machine_name, worker_name, planned_qty || 0, produced_qty || 0, remarks || '', produced_qty || 0, remarks || '', worker_name, planned_qty || 0]
    );

    const updatedLog = await get(
      `SELECT * FROM hourly_logs WHERE date = ? AND shift = ? AND time_slot = ? AND machine_name = ? AND part_number = ?`,
      [logDate, logShift, time_slot, machine_name, part_number]
    );

    broadcast({
      type: 'HOURLY_LOG_UPDATED',
      data: updatedLog
    });

    res.json(updatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle Supervisor Signoff
app.post('/api/hourly-logs/approve', async (req, res) => {
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

// Historical Analytics Endpoint
app.get('/api/analytics/historical', async (req, res) => {
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
      selectGroup = 'year || "-" || PRINTF("%02d", month) AS label, year, month';
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
// PRODUCTION STATIC FILE SERVING FOR CLOUD DEPLOYMENT
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
  console.log(`Production Management Server running on port ${PORT}`);
});
