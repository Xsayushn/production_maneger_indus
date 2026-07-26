import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ClipboardList, Sun, Moon, Wrench, LogOut, User, Shield } from 'lucide-react';
import AdminDashboard from './components/AdminDashboard.jsx';
import WorkerInterface from './components/WorkerInterface.jsx';
import LoginPage from './components/LoginPage.jsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null); // null | { role: 'admin'|'worker', name: string, code: string }
  const [theme, setTheme] = useState('dark');
  const [lastWsMessage, setLastWsMessage] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [parts, setParts] = useState([]);
  const [machines, setMachines] = useState([]);

  // Fetch Master Data (Workers, Parts, Machines)
  const fetchMasterData = async () => {
    try {
      const [wRes, pRes, mRes] = await Promise.all([
        fetch('/api/workers'),
        fetch('/api/parts'),
        fetch('/api/machines')
      ]);

      const wData = await wRes.json();
      const pData = await pRes.json();
      const mData = await mRes.json();

      setWorkers(wData);
      setParts(pData);
      setMachines(mData);
    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  // Handle addition of a new worker
  const handleWorkerAdded = (newWorker) => {
    setWorkers(prev => [...prev, newWorker]);
  };

  // Set up WebSocket real-time connection silently
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          setLastWsMessage(msg);
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // If user is not logged in, render Login Page
  if (!currentUser) {
    return <LoginPage workers={workers} onLogin={(usr) => setCurrentUser(usr)} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Navbar */}
      <header style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.85rem 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(6, 182, 212, 0.4)'
            }}>
              <Wrench color="white" size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                INDUS PRODUCTION MANAGER
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {currentUser.role === 'admin' ? `Admin Portal (${workers.length} Workers)` : `Worker Site: ${currentUser.name}`}
              </p>
            </div>
          </div>

          {/* Right Action Items */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '0.825rem' }}>
              {currentUser.role === 'admin' ? <Shield size={14} color="var(--accent-cyan)" /> : <User size={14} color="var(--accent-green)" />}
              <span><strong>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})</span>
            </div>

            <button onClick={toggleTheme} className="btn btn-secondary btn-sm" title="Toggle Light/Dark Theme">
              {theme === 'dark' ? <Sun size={15} color="var(--accent-yellow)" /> : <Moon size={15} />}
            </button>

            <button onClick={() => setCurrentUser(null)} className="btn btn-secondary btn-sm" title="Sign Out">
              <LogOut size={15} /> Logout
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {currentUser.role === 'admin' ? (
          <AdminDashboard 
            workers={workers} 
            parts={parts} 
            machines={machines} 
            lastWsMessage={lastWsMessage} 
            onWorkerAdded={handleWorkerAdded}
          />
        ) : (
          <WorkerInterface 
            currentUser={currentUser}
            workers={workers} 
            parts={parts} 
            machines={machines} 
            lastWsMessage={lastWsMessage} 
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '1rem',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        Indus Industrial Production Management System &bull; Enterprise 100+ Worker Roster System
      </footer>
    </div>
  );
}
