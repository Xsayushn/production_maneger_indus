import { initDb, run, query } from './db.js';

const firstNames = [
  'Lavkush', 'Rahul', 'Amit'
];

const lastNames = [
  'Sharma', 'Verma', 'Singh'
];

const departments = [
  'Hairpin Bending Line A',
  'Hairpin Bending Line B',
  'Fin Press Assembly',
  'Tube Mill & Stamping',
  'Quality Verification',
  'Coil Assembly Section'
];

const seedData = async () => {
  console.log('Starting enterprise seed process with 120+ workers...');

  // 1. Generate 120 Workers
  const generatedWorkers = [];

  // Explicit core workers first
  generatedWorkers.push({ name: 'Lavkush', code: 'WRK-1001', department: 'Hairpin Bending Line A', shift: 'A' });
  generatedWorkers.push({ name: 'Rahul Sharma', code: 'WRK-1002', department: 'Hairpin Bending Line A', shift: 'A' });
  generatedWorkers.push({ name: 'Amit Verma', code: 'WRK-1003', department: 'Fin Press Assembly', shift: 'B' });
  generatedWorkers.push({ name: 'Priya Singh', code: 'WRK-1004', department: 'Quality Verification', shift: 'A' });
  generatedWorkers.push({ name: 'Vikram Patel', code: 'WRK-1005', department: 'Tube Mill & Stamping', shift: 'A' });

  let idCounter = 1006;
  for (let i = 0; i < 115; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const fullName = `${fn} ${ln}`;
    const code = `WRK-${idCounter++}`;
    const dept = departments[i % departments.length];
    const shift = i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C';

    generatedWorkers.push({ name: fullName, code, department: dept, shift });
  }

  // Use INSERT OR IGNORE so custom registered workers are NEVER overwritten or lost
  for (const w of generatedWorkers) {
    await run(
      `INSERT OR IGNORE INTO workers (name, code, department, shift, role, status) VALUES (?, ?, ?, ?, 'worker', 'active')`,
      [w.name, w.code, w.department, w.shift]
    );
  }

  // 2. Seed Machines
  const machines = [
    { name: 'M/C 392', code: 'MC-392', line: 'Hairpin Line A' },
    { name: 'M/C 393', code: 'MC-393', line: 'Hairpin Line A' },
    { name: 'M/C 401', code: 'MC-401', line: 'Fin Press Line B' },
    { name: 'M/C 405', code: 'MC-405', line: 'Tube Mill Line C' },
    { name: 'M/C 410', code: 'MC-410', line: 'Coil Assembly Line D' },
    { name: 'M/C 415', code: 'MC-415', line: 'Quality Inspection' }
  ];

  for (const m of machines) {
    await run(`INSERT OR IGNORE INTO machines (name, code, line) VALUES (?, ?, ?)`, [m.name, m.code, m.line]);
  }

  // 3. Seed Part Numbers
  const parts = [
    { part_number: 'CCW2410', description: 'Hairpin Copper Tube 2410', tube_spec: '9.52mm x 0.35mm', default_hourly_target: 840 },
    { part_number: 'CCW2411', description: 'Hairpin Copper Tube 2411', tube_spec: '7.00mm x 0.28mm', default_hourly_target: 900 },
    { part_number: 'MTR1050', description: 'Motor Shaft Assembly 105', tube_spec: '12.0mm Steel', default_hourly_target: 500 },
    { part_number: 'ALU8820', description: 'Aluminum Fin Pack 8820', tube_spec: 'Alu 0.11mm', default_hourly_target: 1200 },
    { part_number: 'COP9915', description: 'Header Pipe Assembly 9915', tube_spec: '15.88mm x 0.5mm', default_hourly_target: 650 }
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
    { worker: 'Lavkush', part: 'CCW2410', mc: 'M/C 392', planned: 840, spec: '9.52mm x 0.35mm', job: 'JOB-8842' },
    { worker: 'Rahul Sharma', part: 'CCW2411', mc: 'M/C 393', planned: 900, spec: '7.00mm x 0.28mm', job: 'JOB-8843' },
    { worker: 'Amit Verma', part: 'MTR1050', mc: 'M/C 401', planned: 500, spec: '12.0mm Steel', job: 'JOB-8844' },
    { worker: 'Priya Singh', part: 'ALU8820', mc: 'M/C 405', planned: 1200, spec: 'Alu 0.11mm', job: 'JOB-8845' }
  ];

  for (const a of activeAssignments) {
    await run(
      `INSERT OR IGNORE INTO assignments (date, shift, worker_name, part_number, machine_name, planned_hourly_qty, tube_spec, job_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [today, 'A', a.worker, a.part, a.mc, a.planned, a.spec, a.job]
    );
  }

  // Time slots (12 hours)
  const slots = [
    '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
    '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
    '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00'
  ];

  // Seed sample logs for today
  for (const a of activeAssignments) {
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
        [today, yr, mo, wk, 'A', slots[i], a.part, a.mc, a.worker, planned, produced, remark, i < 4 ? 1 : 0]
      );
    }
  }

  // 5. Seed Historical Logs across past 45 days for multiple workers
  console.log('Generating historical logs across 120 worker roster...');
  const currDate = new Date();

  for (let dayOffset = 1; dayOffset <= 45; dayOffset++) {
    const pastDate = new Date(currDate);
    pastDate.setDate(currDate.getDate() - dayOffset);
    if (pastDate.getDay() === 0) continue;

    const dateStr = pastDate.toISOString().split('T')[0];
    const yr = pastDate.getFullYear();
    const mo = pastDate.getMonth() + 1;
    const firstDayOfYear = new Date(yr, 0, 1);
    const wk = Math.ceil((((pastDate - firstDayOfYear) / 86400000) + firstDayOfYear.getDay() + 1) / 7);

    // Pick 5 random workers for each historical day
    for (let wIdx = 0; wIdx < 5; wIdx++) {
      const workerObj = generatedWorkers[(dayOffset * 7 + wIdx) % generatedWorkers.length];
      const machineObj = machines[wIdx % machines.length];
      const partObj = parts[wIdx % parts.length];

      for (let slotIdx = 0; slotIdx < slots.length; slotIdx++) {
        const pQty = partObj.default_hourly_target;
        const variance = (Math.sin(dayOffset + slotIdx + wIdx) * 0.15);
        const prodQty = Math.max(0, Math.round(pQty * (0.88 + variance)));

        await run(
          `INSERT OR IGNORE INTO hourly_logs 
           (date, year, month, week_number, shift, time_slot, part_number, machine_name, worker_name, planned_qty, produced_qty, remarks, supervisor_approved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dateStr, yr, mo, wk, 'A', slots[slotIdx], partObj.part_number, machineObj.name, workerObj.name, pQty, prodQty, '', 1]
        );
      }
    }
  }

  console.log('120+ Worker Enterprise Seed completed successfully!');
};

seedData().catch(err => {
  console.error('Error seeding enterprise data:', err);
});
