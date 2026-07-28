import React, { useState } from 'react';
import { Shield, KeyRound, UserCheck, AlertCircle, Wrench, Search } from 'lucide-react';

export default function LoginPage({ siteMode = 'worker', publicWorkers = [], onLogin, loading, error }) {
  // Un-prefill credentials for security compliance
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Worker login state
  const [selectedWorkerCode, setSelectedWorkerCode] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');

  const filteredWorkers = publicWorkers.filter(w => 
    w.name.toLowerCase().includes(workerSearch.toLowerCase()) || 
    w.code.toLowerCase().includes(workerSearch.toLowerCase())
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (siteMode === 'admin') {
      onLogin({
        role: 'admin',
        username: adminUsername,
        password: adminPassword
      });
    } else {
      const selectedWorker = publicWorkers.find(w => w.code === selectedWorkerCode);
      onLogin({
        role: 'worker',
        workerCode: selectedWorkerCode,
        workerName: selectedWorker ? selectedWorker.name : workerSearch
      });
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '2.5rem',
        borderTop: siteMode === 'admin' ? '4px solid var(--accent-purple)' : '4px solid var(--accent-cyan)'
      }}>
        
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: siteMode === 'admin' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(6, 182, 212, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            border: siteMode === 'admin' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
          }}>
            {siteMode === 'admin' ? (
              <Shield color="var(--accent-purple)" size={28} />
            ) : (
              <Wrench color="var(--accent-cyan)" size={28} />
            )}
          </div>
          
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, tracking: '-0.02em', marginBottom: '0.3rem' }}>
            {siteMode === 'admin' ? 'INDUS MANAGEMENT CENTER' : 'INDUS SHOP-FLOOR TERMINAL'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {siteMode === 'admin' ? 'Executive Admin Operations Portal' : 'Hourly Production Verification Portal'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {siteMode === 'admin' ? (
            <>
              <div className="form-group">
                <label className="form-label">Admin Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username..."
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
                  placeholder="Enter admin password..."
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Search Worker Name or Employee Code</label>
                <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '36px' }}
                    placeholder="e.g. Lavkush, WRK-1001, Rahul..."
                    value={workerSearch}
                    onChange={(e) => setWorkerSearch(e.target.value)}
                  />
                </div>

                <select 
                  className="form-control"
                  value={selectedWorkerCode}
                  onChange={(e) => setSelectedWorkerCode(e.target.value)}
                  size={5}
                  style={{ height: '140px' }}
                  required
                >
                  {filteredWorkers.length === 0 ? (
                    <option disabled>No matching active workers found</option>
                  ) : (
                    filteredWorkers.map(w => (
                      <option key={w.id || w.code} value={w.code} style={{ padding: '0.4rem' }}>
                        {w.name} ({w.code} - {w.department})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            className={`btn ${siteMode === 'admin' ? 'btn-primary' : 'btn-primary'}`}
            disabled={loading || (siteMode === 'worker' && !selectedWorkerCode && !workerSearch)}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {siteMode === 'admin' ? <KeyRound size={18} /> : <UserCheck size={18} />}
            {loading ? 'Authenticating...' : siteMode === 'admin' ? 'Sign In to Management Center' : 'Access Shop-Floor Verification'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.8rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Indus Industrial System • Dedicated {siteMode === 'admin' ? 'Admin Management' : 'Shop-Floor'} Portal
        </div>

      </div>
    </div>
  );
}
