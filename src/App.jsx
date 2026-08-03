import React, { useState, useEffect } from 'react';
import { Sun, Moon, Wrench, LogOut, User, Shield } from 'lucide-react';
import { io } from 'socket.io-client';
import AdminDashboard from './components/AdminDashboard.jsx';
import WorkerInterface from './components/WorkerInterface.jsx';
import LoginPage from './components/LoginPage.jsx';

export default function App() {
  // Path-based route detection: /admin vs /
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isAdminSite = currentPath.startsWith('/admin');

  // Separate session states for Worker vs Admin
  const [currentUser, setCurrentUser] = useState(() => {
    const key = isAdminSite ? 'indus_admin_user' : 'indus_worker_user';
    const savedUser = localStorage.getItem(key);
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [authToken, setAuthToken] = useState(() => {
    const key = isAdminSite ? 'indus_admin_token' : 'indus_worker_token';
    return localStorage.getItem(key) || '';
  });

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Update session state when route changes between / and /admin
  useEffect(() => {
    const keyUser = isAdminSite ? 'indus_admin_user' : 'indus_worker_user';
    const keyToken = isAdminSite ? 'indus_admin_token' : 'indus_worker_token';

    const savedUser = localStorage.getItem(keyUser);
    const savedToken = localStorage.getItem(keyToken);

    setCurrentUser(savedUser ? JSON.parse(savedUser) : null);
    setAuthToken(savedToken || '');
    setLoginError('');
  }, [isAdminSite]);

  const [theme, setTheme] = useState('dark');
  const [lastWsMessage, setLastWsMessage] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [parts, setParts] = useState([]);
  const [machines, setMachines] = useState([]);

  // Fetch Public Worker Roster for Worker Login Dropdown
  const fetchPublicWorkers = async () => {
    try {
      const res = await fetch('/api/auth/public-workers');
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (err) {
      console.error('Error fetching public worker roster:', err);
    }
  };

  useEffect(() => {
    if (!isAdminSite) {
      fetchPublicWorkers();
    }
  }, [isAdminSite]);

  // Authenticated API Helper (Attaches Bearer Token to Headers)
  const authFetch = async (url, options = {}) => {
    const keyToken = isAdminSite ? 'indus_admin_token' : 'indus_worker_token';
    const activeToken = authToken || localStorage.getItem(keyToken) || '';

    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      handleLogout();
    }
    return res;
  };

  // Fetch Master Data for authenticated user
  const fetchMasterData = async () => {
    if (!authToken) return;
    try {
      const [wRes, pRes, mRes] = await Promise.all([
        authFetch('/api/workers'),
        authFetch('/api/parts'),
        authFetch('/api/machines')
      ]);

      if (wRes.ok) setWorkers(await wRes.json());
      if (pRes.ok) setParts(await pRes.json());
      if (mRes.ok) setMachines(await mRes.json());
    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  };

  useEffect(() => {
    if (authToken) {
      fetchMasterData();
    }
  }, [authToken]);

  // Handle Login Event
  const handleLogin = async (credentials) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check credentials.');
      }

      setCurrentUser(data.user);
      setAuthToken(data.token);
      const keyUser = isAdminSite ? 'indus_admin_user' : 'indus_worker_user';
      const keyToken = isAdminSite ? 'indus_admin_token' : 'indus_worker_token';
      localStorage.setItem(keyUser, JSON.stringify(data.user));
      localStorage.setItem(keyToken, data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout Event
  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken('');
    const keyUser = isAdminSite ? 'indus_admin_user' : 'indus_worker_user';
    const keyToken = isAdminSite ? 'indus_admin_token' : 'indus_worker_token';
    localStorage.removeItem(keyUser);
    localStorage.removeItem(keyToken);
    if (!isAdminSite) fetchPublicWorkers();
  };

  const handleWorkerAdded = (newWorker) => {
    setWorkers(prev => [...prev, newWorker]);
  };

  // Authenticated Socket.IO Client Connection (P0 Render Cloud Fix)
  useEffect(() => {
    if (!authToken) return;

    let socket;
    try {
      socket = io('/', {
        path: '/socket.io',
        auth: { token: authToken },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: Infinity
      });

      socket.on('CONNECTED', (msg) => {
        console.log('Socket.IO connection active:', msg);
      });

      const handleEvent = (type) => (data) => {
        setLastWsMessage({ type, data });
      };

      socket.on('TARGET_UPDATED', handleEvent('TARGET_UPDATED'));
      socket.on('HOURLY_LOG_UPDATED', handleEvent('HOURLY_LOG_UPDATED'));
      socket.on('SLOT_UNLOCKED', handleEvent('SLOT_UNLOCKED'));
    } catch (err) {
      console.warn('Socket.IO connection warning:', err);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [authToken]);

  // Theme toggle
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Render Login Page if unauthenticated on current site
  if (!currentUser || !authToken || (isAdminSite && currentUser.role !== 'admin')) {
    return (
      <LoginPage 
        siteMode={isAdminSite ? 'admin' : 'worker'}
        publicWorkers={workers} 
        onLogin={handleLogin}
        loading={loginLoading}
        error={loginError}
      />
    );
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
              background: isAdminSite 
                ? 'linear-gradient(135deg, var(--accent-blue), #8b5cf6)' 
                : 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAdminSite 
                ? '0 4px 12px rgba(139, 92, 246, 0.4)' 
                : '0 4px 12px rgba(6, 182, 212, 0.4)'
            }}>
              {isAdminSite ? <Shield color="white" size={20} /> : <Wrench color="white" size={20} />}
            </div>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {isAdminSite ? 'INDUS MANAGEMENT CENTER' : 'INDUS SHOP-FLOOR TERMINAL'}
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAdminSite ? `Admin Portal` : `Worker Site: ${currentUser.name}`}
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

            <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Sign Out">
              <LogOut size={15} /> Logout
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {isAdminSite ? (
          <AdminDashboard 
            workers={workers} 
            parts={parts} 
            machines={machines} 
            lastWsMessage={lastWsMessage} 
            onWorkerAdded={handleWorkerAdded}
            onRefreshWorkers={fetchMasterData}
            authFetch={authFetch}
          />
        ) : (
          <WorkerInterface 
            currentUser={currentUser}
            workers={workers} 
            parts={parts} 
            machines={machines} 
            lastWsMessage={lastWsMessage} 
            authFetch={authFetch}
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
        Indus Industrial Production System &bull; Dedicated {isAdminSite ? 'Admin Management' : 'Shop-Floor'} Portal
      </footer>
    </div>
  );
}
