import React, { useState, useMemo } from 'react';
import { Users, Search, Plus, Filter, UserCheck, Shield, Building2, BadgeCheck } from 'lucide-react';

export const STANDARD_DEPARTMENTS = [
  'Fin Press',
  'Expander',
  'Punching',
  'Hairpin'
];

export default function WorkerManager({ workers, onWorkerAdded, authFetch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Worker Form state
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDept, setNewDept] = useState('Fin Press');
  const [newShift, setNewShift] = useState('A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiFetch = authFetch || fetch;

  // Department list (incorporates standard departments + any existing from workers)
  const departments = useMemo(() => {
    const depts = new Set([...STANDARD_DEPARTMENTS, ...workers.map(w => w.department || 'Fin Press')]);
    return Array.from(depts);
  }, [workers]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchSearch = !searchQuery.trim() || 
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        w.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchDept = !selectedDept || w.department === selectedDept;

      return matchSearch && matchDept;
    });
  }, [workers, searchQuery, selectedDept]);

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          code: newCode || `WRK-${Math.floor(1000 + Math.random() * 9000)}`,
          department: newDept,
          shift: newShift
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create worker');

      onWorkerAdded(data);
      setShowAddModal(false);
      setNewName('');
      setNewCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Roster Header */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users color="var(--accent-cyan)" size={22} /> Enterprise Worker Roster & Directory
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Manage registered shop-floor operators across Fin Press, Expander, Punching, and Hairpin departments
            </p>
          </div>

          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Register New Worker
          </button>
        </div>

        {/* Search and Department Filter */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px' }}>
          
          <div className="form-group">
            <label className="form-label">Instant Worker Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-control" 
                style={{ paddingLeft: '36px' }}
                placeholder="Search by Employee Code or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Department Filter</label>
            <select className="form-control" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              <option value="">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Roster Summary KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Registered Workers</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem' }}>
            {workers.length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Operators</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shift A Active Workers</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
            {workers.filter(w => w.shift === 'A' || !w.shift).length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Day Shift</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shift B Active Workers</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.2rem' }}>
            {workers.filter(w => w.shift === 'B').length} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Night Shift</span>
          </div>
        </div>
      </div>

      {/* Workers Directory Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={18} color="var(--accent-cyan)" /> Plant Worker Directory
          </h3>
          <span className="badge badge-blue">{filteredWorkers.length} Workers Match</span>
        </div>

        <div className="prod-table-container" style={{ border: 'none' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Employee Code</th>
                <th>Worker Name</th>
                <th>Plant Department</th>
                <th>Assigned Shift</th>
                <th>System Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No workers found matching "{searchQuery}" in {selectedDept || 'all departments'}.
                  </td>
                </tr>
              ) : (
                filteredWorkers.map((w, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {w.code}
                    </td>
                    <td>
                      <strong>{w.name}</strong>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building2 size={13} color="var(--text-muted)" />
                        {w.department || 'Fin Press'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${w.shift === 'B' ? 'badge-blue' : 'badge-green'}`}>
                        Shift {w.shift || 'A'}
                      </span>
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{w.role || 'worker'}</span>
                    </td>
                    <td>
                      <span className={`badge ${w.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                        <BadgeCheck size={11} /> {w.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
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
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.8rem' }}>
              Register New Plant Worker
            </h3>

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateWorker} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee Code (Optional)</label>
                <input 
                  type="text" 
                  className="form-control font-mono" 
                  value={newCode} 
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Auto-generated if left blank (e.g. WRK-1121)" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Plant Department</label>
                <select className="form-control" value={newDept} onChange={(e) => setNewDept(e.target.value)}>
                  {STANDARD_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Shift</label>
                <select className="form-control" value={newShift} onChange={(e) => setNewShift(e.target.value)}>
                  <option value="A">Shift A (07:00 - 19:00)</option>
                  <option value="B">Shift B (19:00 - 07:00)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Register Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
