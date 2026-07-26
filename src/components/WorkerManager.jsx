import React, { useState } from 'react';
import { Search, UserPlus, Users, Filter, CheckCircle2, XCircle, Building2, Save } from 'lucide-react';

export default function WorkerManager({ workers, onWorkerAdded }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newWorker, setNewWorker] = useState({
    name: '',
    code: `WRK-${Math.floor(1000 + Math.random() * 9000)}`,
    department: 'Hairpin Bending Line A',
    shift: 'A'
  });

  const [loading, setLoading] = useState(false);

  // Departments list for filters
  const departments = Array.from(new Set(workers.map(w => w.department || 'Production Line')));

  const filteredWorkers = workers.filter(w => {
    const matchesSearch = 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !departmentFilter || w.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const handleCreateWorker = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker)
      });
      if (res.ok) {
        const created = await res.json();
        onWorkerAdded(created);
        setShowAddModal(false);
        setNewWorker({
          name: '',
          code: `WRK-${Math.floor(1000 + Math.random() * 9000)}`,
          department: 'Hairpin Bending Line A',
          shift: 'A'
        });
      }
    } catch (err) {
      console.error('Error adding worker:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Bar */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Users color="var(--accent-cyan)" size={24} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Worker Roster & Directory ({workers.length} Registered Workers)</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage enterprise plant workers, employee codes, departments, and shifts
          </p>
        </div>

        <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
          <UserPlus size={16} /> Register New Worker
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            className="form-control"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by worker name or employee code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ width: '220px' }}>
          <select className="form-control" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All Departments ({departments.length})</option>
            {departments.map((dept, i) => (
              <option key={i} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Worker List Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="prod-table-container" style={{ border: 'none' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Emp Code</th>
                <th>Worker Name</th>
                <th>Department / Section</th>
                <th>Default Shift</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.slice(0, 100).map((w, idx) => (
                <tr key={idx}>
                  <td className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    {w.code}
                  </td>
                  <td><strong>{w.name}</strong></td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      <Building2 size={13} color="var(--text-muted)" /> {w.department || 'Production Line'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-blue">Shift {w.shift || 'A'}</span>
                  </td>
                  <td>
                    <span className="badge badge-green">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', margin: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1.2rem' }}>Register New Plant Worker</h3>
            
            <form onSubmit={handleCreateWorker} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Worker Full Name</label>
                <input 
                  type="text"
                  className="form-control"
                  value={newWorker.name}
                  onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Employee Code / ID</label>
                <input 
                  type="text"
                  className="form-control font-mono"
                  value={newWorker.code}
                  onChange={(e) => setNewWorker({ ...newWorker, code: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department / Section</label>
                <input 
                  type="text"
                  className="form-control"
                  value={newWorker.department}
                  onChange={(e) => setNewWorker({ ...newWorker, department: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Shift</label>
                <select className="form-control" value={newWorker.shift} onChange={(e) => setNewWorker({ ...newWorker, shift: e.target.value })}>
                  <option value="A">Shift A</option>
                  <option value="B">Shift B</option>
                  <option value="C">Shift C</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Save size={16} /> Save Worker Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
