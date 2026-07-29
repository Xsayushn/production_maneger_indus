// Using native Node 18+ fetch

const BASE_URL = 'http://localhost:5000';

const getISTDateString = (d = new Date()) => {
  const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
  const istDate = new Date(utcMs + (330 * 60000));
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function runSecurityTests() {
  console.log('--------------------------------------------------');
  console.log('🔒 RUNNING AUTOMATED SECURITY SUITE & AUDIT VERIFICATION');
  console.log('--------------------------------------------------');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, details = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  };

  try {
    // Test 1: Unauthenticated request to /api/hourly-logs
    const unauthRes = await fetch(`${BASE_URL}/api/hourly-logs`);
    assert(unauthRes.status === 401, 'Test 1: Reject unauthenticated API access with 401');

    // Test 2: Invalid admin login credentials
    const badAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'admin', password: 'wrongpassword' })
    });
    assert(badAdminRes.status === 401, 'Test 2: Reject invalid admin credentials with 401');

    // Test 3: Valid admin login
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', username: 'admin', password: 'admin123' })
    });
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminData.token, 'Test 3: Issue valid JWT token for authenticated Admin');

    const adminToken = adminData.token;

    // Test 4a: Worker login with invalid PIN
    const badWorkerRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'worker', workerCode: 'WRK-1001', pin: '9999' })
    });
    assert(badWorkerRes.status === 401, 'Test 4a: Reject invalid worker PIN with 401');

    // Test 4b: Worker login with valid PIN (default 1234)
    const workerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'worker', workerCode: 'WRK-1001', pin: '1234' })
    });
    const workerData = await workerLoginRes.json();
    assert(workerLoginRes.status === 200 && workerData.token, 'Test 4b: Issue valid JWT token for authenticated Worker with PIN');

    const workerToken = workerData.token;

    // Test 5: Worker attempting supervisor sign-off (Admin-only action)
    const workerApproveRes = await fetch(`${BASE_URL}/api/hourly-logs/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({ id: 1, supervisor_approved: 1 })
    });
    assert(workerApproveRes.status === 403, 'Test 5: Block worker from performing Admin supervisor sign-off with 403 Forbidden');

    // Clean up any test unlock record first
    const today = getISTDateString();
    await fetch(`${BASE_URL}/api/hourly-logs/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        date: today,
        shift: 'A',
        time_slot: '14:00-15:00',
        part_number: 'CCW2410',
        machine_name: 'M/C 392',
        worker_name: 'Lavkush',
        unlocked: false
      })
    });

    // Test 6: Worker attempting out-of-window time slot edit without Admin unlock
    const outOfWindowRes = await fetch(`${BASE_URL}/api/hourly-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        date: today,
        shift: 'A',
        time_slot: '14:00-15:00', // Time slot past
        part_number: 'CCW2410',
        machine_name: 'M/C 392',
        worker_name: 'Lavkush',
        produced_qty: 500
      })
    });
    assert(outOfWindowRes.status === 403, 'Test 6: Server enforces +15 min time-lock and rejects out-of-window worker edit with 403 Forbidden');

    // Test 7: Admin granting slot unlock access to worker
    const unlockRes = await fetch(`${BASE_URL}/api/hourly-logs/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        date: today,
        shift: 'A',
        time_slot: '14:00-15:00',
        part_number: 'CCW2410',
        machine_name: 'M/C 392',
        worker_name: 'Lavkush',
        unlocked: true
      })
    });
    assert(unlockRes.status === 200, 'Test 7: Allow Admin to grant slot unlock edit access for worker');

    // Test 8: Worker editing slot after Admin granted unlock access
    const unlockedWorkerPostRes = await fetch(`${BASE_URL}/api/hourly-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        date: today,
        shift: 'A',
        time_slot: '14:00-15:00',
        part_number: 'CCW2410',
        machine_name: 'M/C 392',
        worker_name: 'Lavkush',
        produced_qty: 850
      })
    });
    assert(unlockedWorkerPostRes.status === 200, 'Test 8: Accept worker entry for locked slot when Admin granted unlock access');

    // Test 9: Authenticated admin performing supervisor approval
    const adminApproveRes = await fetch(`${BASE_URL}/api/hourly-logs/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ id: 1, supervisor_approved: 1 })
    });
    assert(adminApproveRes.status === 200, 'Test 9: Allow authenticated Admin to perform supervisor sign-off');

    console.log('--------------------------------------------------');
    console.log(`SECURITY SUITE COMPLETED: ${passed} Passed, ${failed} Failed`);
    console.log('--------------------------------------------------');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Error running security test suite:', err);
    process.exit(1);
  }
}

runSecurityTests();
