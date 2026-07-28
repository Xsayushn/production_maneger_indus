import React, { useState, useEffect } from 'react';
import { 
  Users, Cpu, Layers, CheckCircle2, AlertTriangle, Clock, TrendingUp, 
  BarChart3, Settings, ShieldCheck, UserCheck, Plus, RefreshCw, FileText, Calendar, Filter, Lock, Unlock, AlertCircle
} from 'lucide-react';
import TargetAllocator from './TargetAllocator.jsx';
import HistoricalAnalytics from './HistoricalAnalytics.jsx';
import WorkerManager from './WorkerManager.jsx';

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminDashboard({ workers, parts, machines, lastWsMessage, onWorkerAdded, authFetch }) {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'analytics' | 'workers'
  const [date, setDate] = useState(getLocalDateString());
  const [shift, setShift] = useState('A');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  
  const [assignments, setAssignments] = useState([]);
  const [hourlyLogs, setHourlyLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const apiFetch = authFetch || fetch;

  // Fetch Dashboard Live Data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [assignRes, logsRes] = await Promise.all([
        apiFetch(`/api/assignments?date=${date}&shift=${shift}`),
        apiFetch(`/api/hourly-logs?date=${date}&shift=${shift}`)
      ]);

      if (assignRes.ok) setAssignments(await assignRes.json());
      if (logsRes.ok) setHourlyLogs(await logsRes.json());
    } catch (err) {
      console.error('Error fetching dashboard live data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // REST Polling Fallback every 10s (Guarantees dashboard stays active even if WS drops)
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, [date, shift]);

  // Realtime WS updates trigger re-fetch
  useEffect(() => {
    if (lastWsMessage) {
      if (
        lastWsMessage.type === 'TARGET_UPDATED' || 
        lastWsMessage.type === 'HOURLY_LOG_UPDATED' || 
        lastWsMessage.type === 'SLOT_UNLOCKED'
      ) {
        fetchDashboardData();
      }
    }
  }, [lastWsMessage]);

  // Toggle Supervisor Sign-off
  const handleToggleApprove = async (logId, currentStatus) => {
    try {
      const res = await apiFetch('/api/hourly-logs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: logId, supervisor_approved: !currentStatus })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error('Error approving hourly log:', err);
    }
  };

  // Toggle Admin Slot Unlock Edit Access for Worker
  const handleToggleUnlock = async (log, currentUnlockedStatus) => {
    try {
      const res = await apiFetch('/api/hourly-logs/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: log.date || date,
          shift: log.shift || shift,
          time_slot: log.time_slot,
          machine_name: log.machine_name,
          part_number: log.part_number,
          worker_name: log.worker_name,
          unlocked: !currentUnlockedStatus
        })
      });
      if (res.ok) fetchDashboardData();
    } catch (err) {
      console.error('Error toggling slot unlock:', err);
    }
  };

  // Dashboard Overview Metrics
  const totalPlannedPcs = hourlyLogs.reduce((sum, l) => sum + (parseInt(l.planned_qty) || 0), 0);
  const totalProducedPcs = hourlyLogs.reduce((sum, l) => sum + (parseInt(l.produced_qty) || 0), 0);
  const liveEfficiency = totalPlannedPcs > 0 ? ((totalProducedPcs / totalPlannedPcs) * 100).toFixed(1) : 0;
  
  const activeWorkersCount = new Set(assignments.map(a => a.worker_name)).size;
  const activeMachinesCount = new Set(assignments.map(a => a.machine_name)).size;

  const pendingApprovals = hourlyLogs.filter(l => l.produced_qty > 0 && !l.supervisor_approved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Admin Sub-Tab Navigation */}
      <div className="glass-panel" style={{ padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveTab('live')}
            className={`btn ${activeTab === 'live' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <TrendingUp size={16} /> Live Operations
          </button>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <BarChart3 size={16} /> Historical Analytics
          </button>

          <button 
            onClick={() => setActiveTab('workers')}
            className={`btn ${activeTab === 'workers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
          >
            <Users size={16} /> Worker Roster ({workers.length})
          </button>
        </div>

        {/* Global Date / Shift Filter (Shift A / Shift B Only) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <Calendar size={15} color="var(--accent-cyan)" />
            <input 
              type="date" 
              className="table-input" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={{ width: '135px', padding: '0.35rem 0.6rem' }}
            />
          </div>

          <select 
            className="table-input" 
            value={shift} 
            onChange={(e) => setShift(e.target.value)} 
            style={{ width: '110px', padding: '0.35rem 0.6rem' }}
          >
            <option value="A">Shift A (Day)</option>
            <option value="B">Shift B (Night)</option>
          </select>

          {activeTab === 'live' && (
            <button onClick={() => setShowAllocateModal(true)} className="btn btn-primary btn-sm">
              <Plus size={15} /> Assign Target
            </button>
          )}
        </div>

      </div>

      {/* RENDER TAB CONTENTS */}
      {activeTab === 'analytics' ? (
        <HistoricalAnalytics parts={parts} machines={machines} workers={workers} authFetch={apiFetch} />
      ) : activeTab === 'workers' ? (
        <WorkerManager workers={workers} onWorkerAdded={onWorkerAdded} authFetch={apiFetch} />
      ) : (
        /* LIVE OPERATIONS TAB */
        <>
          {/* Supervisor Pending Approvals Action Banner */}
          {pendingApprovals.length > 0 && (
            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock color="var(--accent-yellow)" size={22} />
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                    {pendingApprovals.length} Hourly Production Entries Pending Supervisor Sign-Off
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Review worker entries below and click "Sign Off" to verify shop-floor output.
                  </p>
                </div>
              </div>
              <span className="badge badge-yellow" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                Action Required
              </span>
            </div>
          )}

          {/* Executive KPI Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Shift Planned Target</span>
                <Layers color="var(--accent-blue)" size={20} />
              </div>
              <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--accent-blue)' }}>
                {totalPlannedPcs.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Shift {shift} Target Across Lines</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Actual Produced Qty</span>
                <CheckCircle2 color="var(--accent-green)" size={20} />
              </div>
              <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--accent-green)' }}>
                {totalProducedPcs.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Real-time shop floor fulfillment</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: `4px solid ${liveEfficiency >= 90 ? 'var(--accent-green)' : liveEfficiency >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Live Efficiency Rate</span>
                <TrendingUp color="var(--accent-cyan)" size={20} />
              </div>
              <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.4rem', color: liveEfficiency >= 90 ? 'var(--accent-green)' : liveEfficiency >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)' }}>
                {liveEfficiency}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Hourly fulfillment index</div>
            </div>

            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Production Matrix</span>
                <Users color="var(--accent-yellow)" size={20} />
              </div>
              <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.4rem' }}>
                {activeWorkersCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Workers / {activeMachinesCount} M/Cs</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Active assigned shop floor lines</div>
            </div>
          </div>

          {/* Active Target Allocation Matrix */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} color="var(--accent-cyan)" /> Daily Worker & Machine Target Allocations
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing Shift {shift} Allocations
              </span>
            </div>

            {assignments.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>No target allocations assigned for Shift {shift} on {date}.</p>
                <button onClick={() => setShowAllocateModal(true)} className="btn btn-primary btn-sm" style={{ marginTop: '0.8rem' }}>
                  <Plus size={14} /> Assign Target to Worker
                </button>
              </div>
            ) : (
              <div className="prod-table-container" style={{ border: 'none' }}>
                <table className="prod-table">
                  <thead>
                    <tr>
                      <th>Worker Name</th>
                      <th>Part Number</th>
                      <th>Machine Name</th>
                      <th>Target Rate (Pcs/Hr)</th>
                      <th>Shift Target</th>
                      <th>Job / Tube Spec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assign, idx) => (
                      <tr key={idx}>
                        <td><strong>{assign.worker_name}</strong></td>
                        <td className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{assign.part_number}</td>
                        <td>{assign.machine_name}</td>
                        <td className="font-mono" style={{ fontWeight: 700 }}>{assign.planned_hourly_qty} Pcs/Hr</td>
                        <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>
                          {(assign.planned_hourly_qty * 12).toLocaleString()} Pcs
                        </td>
                        <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                          {assign.job_number || 'JOB-001'} ({assign.tube_spec || 'Standard'})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Real-time Shop-Floor Downtime Alerts & Log Approvals */}
          <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="var(--accent-yellow)" /> Hourly Log Entry Approvals & Worker Edit Access
              </h3>
              <span className="badge badge-yellow">{hourlyLogs.length} Time Slots Monitored</span>
            </div>

            <div className="prod-table-container" style={{ border: 'none' }}>
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Time Slot</th>
                    <th>Worker</th>
                    <th>Part Number</th>
                    <th>Planned / Produced</th>
                    <th>Downtime Remark</th>
                    <th>Worker Edit Override</th>
                    <th>Approval Status</th>
                    <th style={{ textAlign: 'center' }}>Sign Off</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlyLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No hourly logs recorded yet for Shift {shift} on {date}.
                      </td>
                    </tr>
                  ) : (
                    hourlyLogs.map((log, idx) => {
                      const pct = log.planned_qty > 0 ? Math.round((log.produced_qty / log.planned_qty) * 100) : 0;
                      const isUnlocked = log.admin_unlocked === 1;

                      return (
                        <tr key={idx} style={{ backgroundColor: isUnlocked ? 'rgba(16, 185, 129, 0.06)' : 'transparent' }}>
                          <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{log.time_slot}</td>
                          <td><strong>{log.worker_name}</strong></td>
                          <td className="font-mono">{log.part_number}</td>
                          <td className="font-mono">
                            {log.produced_qty} / {log.planned_qty} ({pct}%)
                          </td>
                          <td style={{ color: log.remarks ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                            {log.remarks || 'Normal operation'}
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleUnlock(log, isUnlocked)}
                              className={`btn ${isUnlocked ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                              style={{ fontSize: '0.75rem', gap: '4px' }}
                              title={isUnlocked ? 'Worker currently has permission to edit this slot. Click to Lock.' : 'Grant Worker permission to edit Produced Qty.'}
                            >
                              {isUnlocked ? <Unlock size={12} color="white" /> : <Lock size={12} />}
                              {isUnlocked ? 'Unlocked (Granting Access)' : 'Unlock Edit Access'}
                            </button>
                          </td>
                          <td>
                            {log.supervisor_approved ? (
                              <span className="badge badge-green"><ShieldCheck size={12} /> Approved</span>
                            ) : (
                              <span className="badge badge-yellow"><Clock size={12} /> Pending</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              onClick={() => handleToggleApprove(log.id, log.supervisor_approved)}
                              className={`btn ${log.supervisor_approved ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                            >
                              {log.supervisor_approved ? 'Unapprove' : 'Sign Off'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Target Allocation Modal */}
      {showAllocateModal && (
        <TargetAllocator 
          workers={workers} 
          parts={parts} 
          machines={machines} 
          date={date} 
          shift={shift} 
          onClose={() => setShowAllocateModal(false)}
          onSuccess={() => {
            setShowAllocateModal(false);
            fetchDashboardData();
          }}
          authFetch={apiFetch}
        />
      )}

    </div>
  );
}
