import React, { useState, useEffect } from 'react';
import { Target, Users, Cpu, AlertCircle, ShieldCheck, Activity, PlusCircle, Layers, BarChart3, UserCheck } from 'lucide-react';
import TargetAllocator from './TargetAllocator.jsx';
import HistoricalAnalytics from './HistoricalAnalytics.jsx';
import WorkerManager from './WorkerManager.jsx';

export default function AdminDashboard({ workers, parts, machines, lastWsMessage, onWorkerAdded }) {
  const [adminNav, setAdminNav] = useState('live'); // 'live' | 'analytics' | 'workers'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('A');
  const [assignments, setAssignments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAllocator, setShowAllocator] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current assignments for the selected day/shift
      const assignRes = await fetch(`/api/assignments?date=${date}&shift=${shift}`);
      const assignData = await assignRes.json();
      setAssignments(assignData);

      // 2. Fetch all hourly logs for the selected day/shift
      const logsRes = await fetch(`/api/hourly-logs?date=${date}&shift=${shift}`);
      const logsData = await logsRes.json();
      setLogs(logsData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [date, shift]);

  // Real-time WebSocket event listener
  useEffect(() => {
    if (lastWsMessage) {
      if (lastWsMessage.type === 'TARGET_UPDATED' || lastWsMessage.type === 'HOURLY_LOG_UPDATED') {
        fetchAdminData();
      }
    }
  }, [lastWsMessage]);

  const handleApprove = async (logId, currentStatus) => {
    try {
      await fetch('/api/hourly-logs/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: logId, supervisor_approved: !currentStatus })
      });
      fetchAdminData();
    } catch (err) {
      console.error('Error approving log:', err);
    }
  };

  // Group logs by worker & machine for live monitor cards
  const workerGroups = assignments.map(a => {
    const workerLogs = logs.filter(l => l.worker_name === a.worker_name && l.machine_name === a.machine_name);
    const plannedSum = workerLogs.reduce((sum, l) => sum + (l.planned_qty || 0), 0);
    const producedSum = workerLogs.reduce((sum, l) => sum + (l.produced_qty || 0), 0);
    const eff = plannedSum > 0 ? Math.round((producedSum / plannedSum) * 100) : 0;

    return {
      assignment: a,
      logs: workerLogs,
      plannedSum,
      producedSum,
      eff
    };
  });

  // Extract recent remarks / downtime alerts
  const downtimeAlerts = logs.filter(l => l.remarks && l.remarks.trim() !== '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Target Allocator Modal */}
      {showAllocator && (
        <TargetAllocator 
          workers={workers} 
          parts={parts} 
          machines={machines} 
          onClose={() => setShowAllocator(false)} 
          onTargetAssigned={() => { fetchAdminData(); }}
        />
      )}

      {/* Admin Top Bar with Sub-Navigation for Analytics & Worker Directory */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Activity color="var(--accent-cyan)" size={24} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Admin Command & Analytics Center</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Plant Management System &bull; {workers.length} Registered Workers in Enterprise Roster
          </p>
        </div>

        {/* Admin Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.35rem', borderRadius: '10px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setAdminNav('live')}
            className={`btn ${adminNav === 'live' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Activity size={15} /> Live Operations
          </button>

          <button
            onClick={() => setAdminNav('analytics')}
            className={`btn ${adminNav === 'analytics' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <BarChart3 size={15} /> Historical Analytics
          </button>

          <button
            onClick={() => setAdminNav('workers')}
            className={`btn ${adminNav === 'workers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            <Users size={15} /> Worker Roster ({workers.length})
          </button>
        </div>

        {adminNav === 'live' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="form-control" style={{ width: '80px' }} value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
              </select>
            </div>

            <button onClick={() => setShowAllocator(true)} className="btn btn-primary">
              <PlusCircle size={16} /> Assign Target
            </button>
          </div>
        )}
      </div>

      {/* View Routing */}
      {adminNav === 'analytics' ? (
        <HistoricalAnalytics workers={workers} parts={parts} machines={machines} />
      ) : adminNav === 'workers' ? (
        <WorkerManager workers={workers} onWorkerAdded={(w) => { onWorkerAdded(w); }} />
      ) : (
        /* Render Live Operations View */
        <>
          {/* Summary Stat Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Assignments</span>
                <Users size={18} color="var(--accent-blue)" />
              </div>
              <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.2rem' }}>
                {assignments.length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Workers Active</span>
              </div>
            </div>

            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Planned Target</span>
                <Target size={18} color="var(--accent-cyan)" />
              </div>
              <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.2rem' }}>
                {workerGroups.reduce((acc, g) => acc + g.plannedSum, 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
              </div>
            </div>

            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Produced Today</span>
                <Layers size={18} color="var(--accent-green)" />
              </div>
              <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
                {workerGroups.reduce((acc, g) => acc + g.producedSum, 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
              </div>
            </div>

            <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Downtime Remarks Logged</span>
                <AlertCircle size={18} color="var(--accent-yellow)" />
              </div>
              <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-yellow)', marginTop: '0.2rem' }}>
                {downtimeAlerts.length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alerts</span>
              </div>
            </div>
          </div>

          {/* Real-time Worker Assignment & Live Progress Matrix */}
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Users color="var(--accent-cyan)" size={20} /> Active Worker Daily Deployments & Hourly Progress
          </h3>

          {workerGroups.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Target size={40} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>No Target Assignments Found for Today</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem', marginBottom: '1.2rem' }}>
                Click below to assign part numbers and targets to workers for Shift {shift}.
              </p>
              <button onClick={() => setShowAllocator(true)} className="btn btn-primary">
                <PlusCircle size={16} /> Assign Target Now
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.2rem' }}>
              {workerGroups.map((group, idx) => {
                const a = group.assignment;
                return (
                  <div key={idx} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{a.worker_name}</h4>
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                          <Cpu size={12} style={{ display: 'inline', marginRight: '4px' }} />
                          {a.machine_name} &bull; Part: <strong style={{ color: 'var(--text-main)' }}>{a.part_number}</strong>
                        </p>
                      </div>
                      <span className={`badge ${group.eff >= 100 ? 'badge-green' : group.eff >= 80 ? 'badge-yellow' : 'badge-red'}`}>
                        {group.eff}% Fulfilled
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Target Rate:</span>{' '}
                        <strong className="font-mono">{a.planned_hourly_qty} Pcs/Hr</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Job #:</span>{' '}
                        <span className="font-mono">{a.job_number || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Produced:</span>{' '}
                        <strong className="font-mono" style={{ color: 'var(--accent-green)' }}>{group.producedSum} Pcs</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Target Total:</span>{' '}
                        <span className="font-mono">{group.plannedSum} Pcs</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                        <span>Target Fulfillment Progress</span>
                        <span className="font-mono">{group.producedSum} / {group.plannedSum}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, group.eff)}%`,
                          height: '100%',
                          background: group.eff >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>

                    {/* Hourly breakdown mini table */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        Hourly Fulfillment Breakdown
                      </div>
                      <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {group.logs.map((l, lIdx) => {
                          const hourPct = l.planned_qty > 0 ? Math.round((l.produced_qty / l.planned_qty) * 100) : 0;
                          return (
                            <div key={lIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: '4px' }}>
                              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>{l.time_slot}</span>
                              <span className="font-mono">
                                <strong>{l.produced_qty}</strong> / {l.planned_qty}
                              </span>
                              <span className={`badge ${hourPct >= 100 ? 'badge-green' : hourPct >= 80 ? 'badge-yellow' : 'badge-red'}`} style={{ fontSize: '0.7rem' }}>
                                {hourPct}%
                              </span>
                              <button 
                                onClick={() => handleApprove(l.id, l.supervisor_approved)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: l.supervisor_approved ? 'var(--accent-green)' : 'var(--text-muted)' }}
                                title={l.supervisor_approved ? 'Supervisor Approved' : 'Click to Approve'}
                              >
                                <ShieldCheck size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Live Downtime Remarks Alert Feed */}
          {downtimeAlerts.length > 0 && (
            <div className="glass-panel">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-yellow)' }}>
                <AlertCircle size={18} /> Production Remarks & Downtime Log Feed
              </h3>

              <div className="prod-table-container">
                <table className="prod-table">
                  <thead>
                    <tr>
                      <th>Time Slot</th>
                      <th>Worker</th>
                      <th>Machine</th>
                      <th>Part Number</th>
                      <th>Produced / Planned</th>
                      <th>Remark / Downtime Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeAlerts.map((alt, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{alt.time_slot}</td>
                        <td><strong>{alt.worker_name}</strong></td>
                        <td>{alt.machine_name}</td>
                        <td><span className="badge badge-blue">{alt.part_number}</span></td>
                        <td className="font-mono">{alt.produced_qty} / {alt.planned_qty}</td>
                        <td style={{ color: 'var(--accent-yellow)', fontWeight: 600 }}>{alt.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
