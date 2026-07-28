import { initDb, run, query } from './db.js';

const firstNames = [
  'Lavkush', 'Rahul', 'Amit'
];

const lastNames = [
  'Sharma', 'Verma', 'Singh'
];

export const DEPARTMENTS = [
  'Fin Press',
  'Expander',
  'Punching',
  'Hairpin'
];

const seedData = async () => {
  console.log('Starting enterprise seed process with 4 standard departments (Fin Press, Expander, Punching, Hairpin)...');

  // 1. Generate Workers
  const generatedWorkers = [];
  
  generatedWorkers.push({ name: 'Lavkush', code: 'WRK-1001', department: 'Hairpin', shift: 'A' });
  generatedWorkers.push({ name: 'Rahul Sharma', code: 'WRK-1002', department: 'Fin Press', shift: 'A' });
  generatedWorkers.push({ name: 'Amit Verma', code: 'WRK-1003', department: 'Expander', shift: 'B' });
  generatedWorkers.push({ name: 'Priya Singh', code: 'WRK-1004', department: 'Punching', shift: 'B' });

  for (const w of generatedWorkers) {
    await run(
      `INSERT OR IGNORE INTO workers (name, code, department, shift, role, status) VALUES (?, ?, ?, ?, 'worker', 'active')`,
      [w.name, w.code, w.department, w.shift]
    );
  }

  // 2. Seed Machines
  const machines = [
    { name: 'M/C 392', code: 'MC-392', line: 'Hairpin Line A' },
    { name: 'M/C 393', code: 'MC-393', line: 'Fin Press Line B' },
    { name: 'M/C 401', code: 'MC-401', line: 'Expander Line C' },
    { name: 'M/C 405', code: 'MC-405', line: 'Punching Line D' }
  ];

  for (const m of machines) {
    await run(`INSERT OR IGNORE INTO machines (name, code, line) VALUES (?, ?, ?)`, [m.name, m.code, m.line]);
  }

  // 3. Seed Part Numbers
  const parts = [
    { part_number: 'CCW2410', description: 'Hairpin Copper Tube 2410', tube_spec: '9.52mm x 0.35mm', default_hourly_target: 840 },
    { part_number: 'CCW2411', description: 'Hairpin Copper Tube 2411', tube_spec: '7.00mm x 0.28mm', default_hourly_target: 900 },
    { part_number: 'MTR1050', description: 'Motor Shaft Assembly 105', tube_spec: '12.0mm Steel', default_hourly_target: 500 }
  ];

  for (const p of parts) {
    await run(
      `INSERT OR IGNORE INTO part_numbers (part_number, description, tube_spec, default_hourly_target) VALUES (?, ?, ?, ?)`,
      [p.part_number, p.description, p.tube_spec, p.default_hourly_target]
    );
  }

  // 4. Seed Today's Target Assignments
  const today = new Date().toISOString().split('T')[0];
  const activeAssignments = [
    { worker: 'Lavkush', part: 'CCW2410', mc: 'M/C 392', planned: 840, spec: '9.52mm x 0.35mm', job: 'JOB-8842', shift: 'A' },
    { worker: 'Rahul Sharma', part: 'CCW2411', mc: 'M/C 393', planned: 900, spec: '7.00mm x 0.28mm', job: 'JOB-8843', shift: 'A' },
    { worker: 'Amit Verma', part: 'MTR1050', mc: 'M/C 401', planned: 500, spec: '12.0mm Steel', job: 'JOB-8844', shift: 'B' }
  ];

  for (const a of activeAssignments) {
    await run(
      `INSERT OR IGNORE INTO assignments (date, shift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec, job_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, a.shift, a.worker, a.part, a.mc, a.planned, a.spec, a.job]
    );
  }

  const shiftASlots = [
    '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
    '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
    '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00'
  ];

  const shiftBSlots = [
    '19:00-20:00', '20:00-21:00', '21:00-22:00', '22:00-23:00',
    '23:00-00:00', '00:00-01:00', '01:00-02:00', '02:00-03:00',
    '03:00-04:00', '04:00-05:00', '05:00-06:00', '06:00-07:00'
  ];

  // Seed sample logs for today
  for (const a of activeAssignments) {
    const slots = a.shift === 'B' ? shiftBSlots : shiftASlots;
    for (let i = 0; i < 6; i++) {
      const planned = a.planned;
      const produced = Math.round(planned * (0.85 + Math.random() * 0.2));
      let remark = '';
      if (i === 2) remark = 'Cleaning & Roll change';
      if (i === 3) remark = 'Setup Problem 15 minute break';

      const d = new Date(today);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      const firstJan = new Date(yr, 0, 1);
      const wk = Math.ceil((((d - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);

      await run(
        `INSERT OR IGNORE INTO hourly_logs 
         (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks, supervisor_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [today, yr, mo, wk, a.shift, slots[i], a.part, a.mc, a.worker, planned, produced, remark, i < 4 ? 1 : 0]
      );
    }
  }

  console.log('4 Department seed completed successfully!');
};

seedData().catch(err => {
  console.error('Error seeding data:', err);
});
