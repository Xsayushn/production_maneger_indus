import React, { useState, useMemo } from 'react';
import { Target, UserCheck, Cpu, Package, Save, X, Calendar, Search } from 'lucide-react';

export default function TargetAllocator({ workers, parts, machines, onClose, onTargetAssigned }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    shift: 'A',
    worker_name: workers.length > 0 ? workers[0].name : '',
    part_number: parts.length > 0 ? parts[0].part_number : '',
    machine_name: machines.length > 0 ? machines[0].name : '',
    planned_hourly_qty: parts.length > 0 ? parts[0].default_hourly_target : 840,
    tube_spec: parts.length > 0 ? (parts[0].tube_spec || '') : '',
    job_number: `JOB-${Math.floor(1000 + Math.random() * 9000)}`
  });

  const [workerSearch, setWorkerSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filter 100+ worker dropdown based on search
  const filteredWorkerOptions = useMemo(() => {
    if (!workerSearch.trim()) return workers;
    const q = workerSearch.toLowerCase();
    return workers.filter(w => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q));
  }, [workerSearch, workers]);

  const handlePartChange = (e) => {
    const selectedPartNum = e.target.value;
    const partObj = parts.find(p => p.part_number === selectedPartNum);
    setFormData(prev => ({
      ...prev,
      part_number: selectedPartNum,
      planned_hourly_qty: partObj ? partObj.default_hourly_target : prev.planned_hourly_qty,
      tube_spec: partObj ? partObj.tube_spec : prev.tube_spec
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error('Failed to assign target');
      const data = await res.json();
      onTargetAssigned(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', margin: '1rem', position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.2)', padding: '0.6rem', borderRadius: '10px' }}>
              <Target color="var(--accent-cyan)" size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Assign Target to Worker</h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Search from 100+ worker roster and set shift targets</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label"><Calendar size={13} style={{ marginRight: '4px' }} /> Target Date</label>
              <input 
                type="date" 
                className="form-control" 
                value={formData.date} 
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Shift</label>
              <select 
                className="form-control" 
                value={formData.shift} 
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
              >
                <option value="A">Shift A (07:00 - 19:00)</option>
                <option value="B">Shift B (19:00 - 07:00)</option>
                <option value="C">General Shift</option>
              </select>
            </div>
          </div>

          {/* Searchable Worker Selection */}
          <div className="form-group">
            <label className="form-label"><UserCheck size={13} style={{ marginRight: '4px' }} /> Select Worker ({workers.length} Available)</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
                  placeholder="Filter 100+ workers..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                />
              </div>
            </div>
            <select 
              className="form-control" 
              value={formData.worker_name} 
              onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
              required
            >
              {filteredWorkerOptions.map(w => (
                <option key={w.id || w.code} value={w.name}>{w.name} ({w.code} - {w.department || 'Line'})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label"><Cpu size={13} style={{ marginRight: '4px' }} /> Machine Name</label>
              <select 
                className="form-control" 
                value={formData.machine_name} 
                onChange={(e) => setFormData({ ...formData, machine_name: e.target.value })}
                required
              >
                {machines.map(m => (
                  <option key={m.id} value={m.name}>{m.name} ({m.line})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label"><Package size={13} style={{ marginRight: '4px' }} /> Part Number</label>
              <select 
                className="form-control" 
                value={formData.part_number} 
                onChange={handlePartChange}
                required
              >
                {parts.map(p => (
                  <option key={p.id} value={p.part_number}>{p.part_number} - {p.description}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Planned Hourly Target (Pcs/Hr)</label>
              <input 
                type="number" 
                className="form-control font-mono" 
                value={formData.planned_hourly_qty} 
                onChange={(e) => setFormData({ ...formData, planned_hourly_qty: parseInt(e.target.value) || 0 })}
                min="1"
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Job / Lot Number</label>
              <input 
                type="text" 
                className="form-control font-mono" 
                value={formData.job_number} 
                onChange={(e) => setFormData({ ...formData, job_number: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={16} />
              {loading ? 'Assigning...' : 'Assign Target Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
