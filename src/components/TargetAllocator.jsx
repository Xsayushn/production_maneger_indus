import React, { useState, useMemo } from 'react';
import { X, Check, Search, ShieldAlert, Cpu } from 'lucide-react';

export default function TargetAllocator({ workers, parts, machines, date, shift, onClose, onSuccess, authFetch }) {
  const [workerName, setWorkerName] = useState(workers.length > 0 ? workers[0].name : '');
  const [partNumber, setPartNumber] = useState(parts.length > 0 ? parts[0].part_number : '');
  const [machineName, setMachineName] = useState(machines.length > 0 ? machines[0].name : '');
  const [plannedHourlyQty, setPlannedHourlyQty] = useState(840);
  const [tubeSpec, setTubeSpec] = useState('0.35mm x 7.0mm');
  const [jobNumber, setJobNumber] = useState('JOB-1092');

  const [searchWorker, setSearchWorker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiFetch = authFetch || fetch;

  const filteredWorkers = useMemo(() => {
    if (!searchWorker.trim()) return workers.slice(0, 10);
    const q = searchWorker.toLowerCase();
    return workers.filter(w => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q)).slice(0, 15);
  }, [searchWorker, workers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          shift,
          worker_name: workerName,
          part_number: partNumber,
          machine_name: machineName,
          planned_hourly_qty: parseInt(plannedHourlyQty) || 840,
          tube_spec: tubeSpec,
          job_number: jobNumber
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to assign target');
      }

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Assign Target Rate to Worker</h3>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Worker Search & Select */}
          <div className="form-group">
            <label className="form-label">Worker Name</label>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '32px', fontSize: '0.85rem' }} 
                placeholder="Filter 100+ workers by code or name..."
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
              />
            </div>

            <select 
              className="form-control" 
              value={workerName} 
              onChange={(e) => setWorkerName(e.target.value)} 
              required
            >
              {filteredWorkers.map(w => (
                <option key={w.id || w.code} value={w.name}>{w.name} ({w.code} - {w.department})</option>
              ))}
            </select>
          </div>

          {/* Machine Select */}
          <div className="form-group">
            <label className="form-label">Machine Name</label>
            <select className="form-control" value={machineName} onChange={(e) => setMachineName(e.target.value)} required>
              {machines.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.line})</option>
              ))}
            </select>
          </div>

          {/* Part Number Select */}
          <div className="form-group">
            <label className="form-label">Part Number</label>
            <select className="form-control" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required>
              {parts.map(p => (
                <option key={p.id} value={p.part_number}>{p.part_number} - {p.description}</option>
              ))}
            </select>
          </div>

          {/* Planned Hourly Quantity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Planned Hourly Target (Pcs/Hr)</label>
              <input 
                type="number" 
                className="form-control font-mono" 
                value={plannedHourlyQty} 
                onChange={(e) => setPlannedHourlyQty(e.target.value)} 
                required 
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Job Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={jobNumber} 
                onChange={(e) => setJobNumber(e.target.value)} 
              />
            </div>
          </div>

          {/* Tube Spec */}
          <div className="form-group">
            <label className="form-label">Tube Spec</label>
            <input 
              type="text" 
              className="form-control font-mono" 
              value={tubeSpec} 
              onChange={(e) => setTubeSpec(e.target.value)}
              placeholder="e.g. 0.35mm x 7.0mm"
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Check size={16} /> {loading ? 'Assigning...' : 'Assign Target'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
