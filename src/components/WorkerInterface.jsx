import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Save, User, Cpu, ShieldCheck, FileSpreadsheet, Lock, Unlock, AlertTriangle, Calendar } from 'lucide-react';

export default function WorkerInterface({ currentUser, workers, parts, machines, lastWsMessage, authFetch }) {
  const [selectedWorker, setSelectedWorker] = useState(currentUser?.name || (workers.length > 0 ? workers[0].name : 'Lavkush'));
  const [selectedMachine, setSelectedMachine] = useState(machines.length > 0 ? machines[0].name : 'M/C 392');
  const [selectedPart, setSelectedPart] = useState(parts.length > 0 ? parts[0].part_number : 'CCW2410');
  const [shift, setShift] = useState('A');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [assignmentInfo, setAssignmentInfo] = useState(null);

  // Time Lock Simulation for Admin test mode
  const [simulatedTime, setSimulatedTime] = useState('');
  const [bypassTimeLock, setBypassTimeLock] = useState(false);

  // Hourly logs state for the 12 time slots
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingSlot, setSavingSlot] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const defaultSlots = [
    '07:00-08:00', '08:00-09:00', '09:00-10:00', '10:00-11:00',
    '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00',
    '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00'
  ];

  const apiFetch = authFetch || fetch;

  // Compute yesterday string
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toISOString().split('T')[0];

  // Check client-side slot time status (+15 minutes grace period)
  const getSlotTimeStatus = (timeSlotStr, logDateStr) => {
    if (currentUser?.role === 'admin' && bypassTimeLock) {
      return { editable: true, reason: 'Admin Bypass Active' };
    }

    if (logDateStr !== todayStr && currentUser?.role !== 'admin') {
      return { editable: false, reason: 'Date Locked (Viewing past date)' };
    }

    let currentMins;
    if (simulatedTime && currentUser?.role === 'admin') {
      const [sh, sm] = simulatedTime.split(':').map(Number);
      currentMins = sh * 60 + sm;
    } else {
      const now = new Date();
      currentMins = now.getHours() * 60 + now.getMinutes();
    }

    const [startStr, endStr] = timeSlotStr.split('-');
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const slotStartMins = startH * 60 + startM;
    const slotEndMins = endH * 60 + endM;
    const graceEndMins = slotEndMins + 15;

    if (currentMins < slotStartMins) {
      return { editable: false, reason: `Locked (Starts at ${startStr})` };
    }
    if (currentMins > graceEndMins) {
      const graceTimeStr = `${Math.floor(graceEndMins / 60).toString().padStart(2, '0')}:${(graceEndMins % 60).toString().padStart(2, '0')}`;
      return { editable: false, reason: `Expired (Closed at ${graceTimeStr})` };
    }

    const minsLeft = graceEndMins - currentMins;
    return { editable: true, reason: `Editable (${minsLeft}m left)` };
  };

  // Fetch assignment & logs when worker/machine/part/date changes
  const fetchLogsAndAssignment = async () => {
    setLoading(true);
    try {
      const assignRes = await apiFetch(`/api/assignments?date=${date}&shift=${shift}`);
      if (assignRes.ok) {
        const assignments = await assignRes.json();
        const currentAssign = assignments.find(
          a => a.machine_name === selectedMachine || a.worker_name === selectedWorker
        );
        if (currentAssign) {
          setAssignmentInfo(currentAssign);
          setSelectedPart(currentAssign.part_number);
        }
      }

      const logsRes = await apiFetch(
        `/api/hourly-logs?date=${date}&shift=${shift}&machine_name=${selectedMachine}&part_number=${selectedPart}`
      );
      if (logsRes.ok) {
        const existingLogs = await logsRes.json();

        const mergedSlots = defaultSlots.map(slot => {
          const found = existingLogs.find(l => l.time_slot === slot);
          const plannedFromAssign = assignmentInfo ? assignmentInfo.planned_hourly_qty : 840;
          
          return found ? { ...found } : {
            time_slot: slot,
            planned_qty: plannedFromAssign,
            produced_qty: 0,
            remarks: '',
            supervisor_approved: 0,
            date,
            shift,
            machine_name: selectedMachine,
            part_number: selectedPart,
            worker_name: selectedWorker
          };
        });

        setLogs(mergedSlots);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogsAndAssignment();
  }, [date, shift, selectedMachine, selectedPart, selectedWorker]);

  useEffect(() => {
    if (lastWsMessage) {
      if (lastWsMessage.type === 'TARGET_UPDATED' || lastWsMessage.type === 'HOURLY_LOG_UPDATED') {
        fetchLogsAndAssignment();
      }
    }
  }, [lastWsMessage]);

  const handleInputChange = (slotIndex, field, value) => {
    const updated = [...logs];
    updated[slotIndex][field] = value;
    setLogs(updated);
  };

  const handleSaveSlot = async (slotIndex) => {
    const slotData = logs[slotIndex];
    const status = getSlotTimeStatus(slotData.time_slot, date);

    if (!status.editable) {
      setErrorMsg(`Cannot save entry: ${status.reason}`);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    setSavingSlot(slotIndex);
    setSaveSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/hourly-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slotData,
          planned_qty: parseInt(slotData.planned_qty) || 0,
          produced_qty: Math.max(0, parseInt(slotData.produced_qty) || 0),
          date,
          shift,
          machine_name: selectedMachine,
          part_number: selectedPart,
          worker_name: selectedWorker
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to save entry');
      }

      setSaveSuccessMsg(`Entry for ${slotData.time_slot} saved & authenticated!`);
      setTimeout(() => setSaveSuccessMsg(''), 2500);
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setSavingSlot(null);
    }
  };

  const totalPlanned = logs.reduce((sum, l) => sum + (parseInt(l.planned_qty) || 0), 0);
  const totalProduced = logs.reduce((sum, l) => sum + (parseInt(l.produced_qty) || 0), 0);
  const overallFulfillment = totalPlanned > 0 ? ((totalProduced / totalPlanned) * 100).toFixed(1) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Card */}
      <div className="glass-panel" style={{ borderLeft: '4px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <FileSpreadsheet color="var(--accent-cyan)" size={22} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Hourly Production Verification Sheet</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Server Authenticated Entry: Edits allowed only during slot + 15 min grace period
            </p>
          </div>

          {/* Admin Debug Simulation Controls */}
          {currentUser?.role === 'admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.25)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
              <Clock size={14} color="var(--accent-yellow)" />
              <span>Admin Debug Clock:</span>
              <input 
                type="time" 
                className="table-input font-mono" 
                style={{ width: '100px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                value={simulatedTime} 
                onChange={(e) => setSimulatedTime(e.target.value)}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={bypassTimeLock} 
                  onChange={(e) => setBypassTimeLock(e.target.checked)} 
                />
                <span style={{ color: 'var(--text-muted)' }}>Bypass</span>
              </label>
            </div>
          )}
        </div>

        {/* Form Selection Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.2rem', borderRadius: '10px' }}>
          <div className="form-group">
            <label className="form-label"><User size={13} style={{ marginRight: '4px' }} /> Worker Name</label>
            <select className="form-control" value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              {workers.map(w => (
                <option key={w.id || w.code} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label"><Cpu size={13} style={{ marginRight: '4px' }} /> Machine Name</label>
            <select className="form-control" value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)}>
              {machines.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.line})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Part Number</label>
            <select className="form-control" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)}>
              {parts.map(p => (
                <option key={p.id} value={p.part_number}>{p.part_number} - {p.description}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label"><Calendar size={13} style={{ marginRight: '4px' }} /> Date & Shift</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <input type="date" className="form-control" style={{ flex: 1, minWidth: '130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
              <button 
                type="button" 
                onClick={() => setDate(date === todayStr ? yesterdayStr : todayStr)} 
                className="btn btn-secondary btn-sm"
                title={date === todayStr ? "Switch to Yesterday" : "Switch to Today"}
              >
                {date === todayStr ? 'Yesterday' : 'Today'}
              </button>
              <select className="form-control" style={{ width: '80px' }} value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
              </select>
            </div>
          </div>
        </div>

        {/* Metadata info ribbon */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
          <div><strong style={{ color: 'var(--text-muted)' }}>Viewing Date:</strong> <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{date} {date === todayStr ? '(Today)' : '(Past Date)'}</span></div>
          <div><strong style={{ color: 'var(--text-muted)' }}>Tube Spec:</strong> {assignmentInfo?.tube_spec || 'Standard Spec'}</div>
          <div><strong style={{ color: 'var(--text-muted)' }}>Job Number:</strong> {assignmentInfo?.job_number || 'JOB-001'}</div>
          <div><strong style={{ color: 'var(--text-muted)' }}>Target Rate:</strong> <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{logs[0]?.planned_qty || 840} Pcs/Hr</span></div>
        </div>
      </div>

      {/* Success & Error Banners */}
      {saveSuccessMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.85rem 1.2rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
          <CheckCircle size={20} />
          {saveSuccessMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.85rem 1.2rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
          <AlertTriangle size={20} />
          {errorMsg}
        </div>
      )}

      {/* Summary Scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shift Planned Target</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.2rem' }}>
            {totalPlanned.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Produced Qty</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
            {totalProduced.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Fulfillment Rate</div>
          <div className="font-mono" style={{ 
            fontSize: '1.8rem', 
            fontWeight: 800, 
            color: overallFulfillment >= 100 ? 'var(--accent-green)' : overallFulfillment >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)',
            marginTop: '0.2rem' 
          }}>
            {overallFulfillment}%
          </div>
        </div>
      </div>

      {/* Main Hourly Verification Sheet Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--accent-cyan)" /> Hourly Production Log Entries
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Server Enforcement: Slot Time + 15 mins
          </span>
        </div>

        <div className="prod-table-container" style={{ border: 'none' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Time Slot</th>
                <th style={{ width: '140px' }}>Status / Time Lock</th>
                <th style={{ width: '120px' }}>Planned Qty</th>
                <th style={{ width: '140px' }}>Produced Qty</th>
                <th style={{ width: '130px' }}>Target %</th>
                <th>Downtime / Reason / Remarks</th>
                <th style={{ width: '120px' }}>Supervisor</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => {
                const planned = parseInt(log.planned_qty) || 0;
                const produced = parseInt(log.produced_qty) || 0;
                const pct = planned > 0 ? Math.round((produced / planned) * 100) : 0;
                const timeStatus = getSlotTimeStatus(log.time_slot, date);

                let badgeClass = 'badge-red';
                if (pct >= 100) badgeClass = 'badge-green';
                else if (pct >= 85) badgeClass = 'badge-yellow';

                return (
                  <tr key={index} style={{
                    backgroundColor: !timeStatus.editable ? 'rgba(0,0,0,0.25)' : produced > 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    opacity: !timeStatus.editable ? 0.75 : 1
                  }}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {log.time_slot}
                    </td>

                    <td>
                      {timeStatus.editable ? (
                        <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                          <Unlock size={11} /> {timeStatus.reason}
                        </span>
                      ) : (
                        <span className="badge badge-red" style={{ fontSize: '0.7rem' }} title={timeStatus.reason}>
                          <Lock size={11} /> {timeStatus.reason}
                        </span>
                      )}
                    </td>

                    <td>
                      <input 
                        type="number"
                        className="table-input font-mono"
                        value={log.planned_qty}
                        onChange={(e) => handleInputChange(index, 'planned_qty', e.target.value)}
                        disabled={!timeStatus.editable}
                        style={{ color: 'var(--text-muted)', cursor: !timeStatus.editable ? 'not-allowed' : 'text' }}
                      />
                    </td>

                    <td>
                      <input 
                        type="number"
                        className="table-input font-mono"
                        value={log.produced_qty}
                        onChange={(e) => handleInputChange(index, 'produced_qty', e.target.value)}
                        placeholder="0"
                        min="0"
                        disabled={!timeStatus.editable}
                        style={{ 
                          borderColor: produced > 0 ? 'var(--accent-green)' : 'var(--border-color)',
                          cursor: !timeStatus.editable ? 'not-allowed' : 'text',
                          backgroundColor: !timeStatus.editable ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'
                        }}
                      />
                    </td>

                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {pct}% {pct >= 100 ? '✓' : ''}
                      </span>
                    </td>

                    <td>
                      <input 
                        type="text"
                        className="table-input"
                        value={log.remarks || ''}
                        onChange={(e) => handleInputChange(index, 'remarks', e.target.value)}
                        placeholder={timeStatus.editable ? "e.g. Setup problem, 15 min break..." : "Time Window Closed"}
                        disabled={!timeStatus.editable}
                        style={{ cursor: !timeStatus.editable ? 'not-allowed' : 'text' }}
                      />
                    </td>

                    <td>
                      {log.supervisor_approved ? (
                        <span className="badge badge-blue">
                          <ShieldCheck size={12} /> Approved
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pending</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => handleSaveSlot(index)} 
                        className={`btn ${timeStatus.editable ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        disabled={!timeStatus.editable || savingSlot === index}
                        style={{ opacity: !timeStatus.editable ? 0.5 : 1, cursor: !timeStatus.editable ? 'not-allowed' : 'pointer' }}
                        title={!timeStatus.editable ? timeStatus.reason : 'Save Entry'}
                      >
                        {timeStatus.editable ? <Save size={13} /> : <Lock size={13} />}
                        {savingSlot === index ? 'Saving...' : timeStatus.editable ? 'Save' : 'Locked'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
