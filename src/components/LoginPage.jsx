import React, { useState, useEffect, useMemo } from 'react';
import { Wrench, Shield, User, ArrowRight, Lock, Search, Building2 } from 'lucide-react';

export default function LoginPage({ workers = [], onLogin }) {
  const [role, setRole] = useState('worker'); // 'admin' | 'worker'
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');
  
  // Local worker list fallback if prop is loading
  const [localWorkers, setLocalWorkers] = useState(workers);
  
  // Searchable worker state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkerObj, setSelectedWorkerObj] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep localWorkers updated when workers prop arrives
  useEffect(() => {
    if (workers && workers.length > 0) {
      setLocalWorkers(workers);
    } else {
      // Fallback direct fetch for public worker list
      fetch('/api/auth/public-workers')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) setLocalWorkers(data);
        })
        .catch(err => console.error('Public worker list fetch error:', err));
    }
  }, [workers]);

  // Filter workers dynamically as user types
  const filteredWorkers = useMemo(() => {
    const list = localWorkers.length > 0 ? localWorkers : workers;
    if (!searchQuery.trim()) return list.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return list.filter(
      w => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q) || (w.department && w.department.toLowerCase().includes(q))
    ).slice(0, 25);
  }, [searchQuery, localWorkers, workers]);

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'admin',
          username: adminUsername,
          password: adminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Admin login failed');

      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const targetWorker = selectedWorkerObj || (filteredWorkers.length > 0 ? filteredWorkers[0] : null);
      if (!targetWorker && !searchQuery.trim()) {
        throw new Error('Please select or enter a valid Worker Name / Employee Code');
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'worker',
          workerCode: targetWorker ? targetWorker.code : searchQuery,
          workerName: targetWorker ? targetWorker.name : searchQuery
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Worker login failed');

      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, #1e293b 0%, #0f172a 100%)',
      padding: '1.5rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem 2rem' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: '0 8px 20px rgba(6, 182, 212, 0.4)'
          }}>
            <Wrench color="white" size={28} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            INDUS PRODUCTION MANAGER
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Secure Server-Authenticated Portal
          </p>
        </div>

        {/* Role Toggle Switcher */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
          background: 'rgba(0,0,0,0.3)',
          padding: '0.35rem',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => { setRole('worker'); setError(''); }}
            className={`btn ${role === 'worker' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'center', border: 'none', padding: '0.55rem' }}
          >
            <User size={16} /> Worker Terminal
          </button>

          <button
            type="button"
            onClick={() => { setRole('admin'); setError(''); }}
            className={`btn ${role === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'center', border: 'none', padding: '0.55rem' }}
          >
            <Shield size={16} /> Admin Portal
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '1.2rem',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Worker Login Form */}
        {role === 'worker' ? (
          <form onSubmit={handleWorkerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="form-group">
              <label className="form-label">Search Worker Name or Employee Code</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: '36px' }}
                  placeholder="e.g. Lavkush, WRK-1001, Rahul..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedWorkerObj(null);
                  }}
                  required={!selectedWorkerObj}
                />
              </div>
            </div>

            {/* Quick Auto-complete Suggestions */}
            <div style={{ maxHeight: '210px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
              {filteredWorkers.length === 0 ? (
                <div style={{ padding: '0.8rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {localWorkers.length === 0 ? 'Loading worker roster...' : 'No matching worker found. Type your employee code.'}
                </div>
              ) : (
                filteredWorkers.map(w => {
                  const isSelected = selectedWorkerObj?.code === w.code;
                  return (
                    <div
                      key={w.id || w.code}
                      onClick={() => {
                        setSelectedWorkerObj(w);
                        setSearchQuery(`${w.name} (${w.code})`);
                      }}
                      style={{
                        padding: '0.55rem 0.8rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div>
                        <strong style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-main)' }}>{w.name}</strong>
                        <span className="font-mono" style={{ marginLeft: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{w.code}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Building2 size={11} /> {w.department || 'Line A'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '1rem', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Authenticating...' : 'Access Shop-Floor Verification'} <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          /* Admin Login Form */
          <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div className="form-group">
              <label className="form-label">Admin Username</label>
              <input
                type="text"
                className="form-control"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', fontSize: '1rem', marginTop: '0.5rem' }} disabled={loading}>
              <Lock size={18} /> {loading ? 'Verifying...' : 'Sign In to Admin Center'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Indus Production System &bull; JWT Authentication Active
        </div>
      </div>
    </div>
  );
}
