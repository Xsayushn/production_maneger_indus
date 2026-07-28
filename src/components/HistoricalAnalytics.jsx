import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Download, Calendar, Filter, BarChart2, Layers, AlertCircle, RefreshCcw, CheckCircle2, Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend 
} from 'recharts';

export default function HistoricalAnalytics({ parts, machines, workers, authFetch }) {
  const [period, setPeriod] = useState('daily'); // 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly'
  const [selectedYear, setSelectedYear] = useState(''); // Default to All Years so data is never filtered out
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const apiFetch = authFetch || fetch;

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        period,
        ...(selectedYear && { year: selectedYear }),
        ...(selectedMonth && { month: selectedMonth }),
        ...(selectedWorker && { worker: selectedWorker }),
        ...(selectedPart && { part: selectedPart }),
        ...(selectedMachine && { machine: selectedMachine })
      });

      const res = await apiFetch(`/api/analytics/historical?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Error fetching historical analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, selectedYear, selectedMonth, selectedWorker, selectedPart, selectedMachine]);

  // Export Evaluation CSV
  const handleExportCSV = () => {
    if (!analyticsData || !analyticsData.trendData) return;

    const headers = ['Time Interval', 'Planned Pcs', 'Produced Pcs', 'Efficiency %', 'Hours Recorded'];
    const rows = analyticsData.trendData.map(row => [
      `"${row.label}"`,
      row.total_planned || 0,
      row.total_produced || 0,
      `${row.efficiency_percent || 0}%`,
      row.total_hours_recorded || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Production_Evaluation_${period}_${selectedYear || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = analyticsData?.summary || {};
  const trendData = analyticsData?.trendData || [];
  const downtimeLogs = analyticsData?.downtimeLogs || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Filter Header Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp color="var(--accent-cyan)" size={22} /> Production Historical Evaluation & Analytics
            </h2>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Long-term multi-interval performance archive across all shop-floor operations
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
              <Download size={15} /> Export Report (CSV)
            </button>
            <button onClick={fetchAnalytics} className="btn btn-primary btn-sm">
              <RefreshCcw size={15} /> Refresh
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px' }}>
          
          <div className="form-group">
            <label className="form-label">Evaluation Interval</label>
            <select className="form-control" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="daily">Daily Breakdown</option>
              <option value="weekly">Weekly Breakdown</option>
              <option value="monthly">Monthly Breakdown</option>
              <option value="yearly">Yearly Breakdown</option>
              <option value="hourly">Hourly Slot Profile</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Year Filter</label>
            <select className="form-control" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              <option value="">All Years</option>
              {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Month Filter</label>
            <select className="form-control" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Worker Filter</label>
            <select className="form-control" value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              <option value="">All Workers ({workers.length})</option>
              {workers.map(w => (
                <option key={w.id || w.code} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Part Number</label>
            <select className="form-control" value={selectedPart} onChange={(e) => setSelectedPart(e.target.value)}>
              <option value="">All Part Numbers</option>
              {parts.map(p => (
                <option key={p.id} value={p.part_number}>{p.part_number}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Aggregate Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Period Planned Target</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.2rem' }}>
            {(summary.grand_planned || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Period Actual Output</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
            {(summary.grand_produced || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Target Fulfillment</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>
            {summary.grand_efficiency || 0}%
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-yellow)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Days Evaluated</div>
          <div className="font-mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-yellow)', marginTop: '0.2rem' }}>
            {summary.total_days_worked || 0} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Days</span>
          </div>
        </div>
      </div>

      {/* Main Historical Trend Visualizer Chart */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', tracking: '0.03em' }}>
            {period} Production Volume & Fulfillment Trend
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {trendData.length} data points
          </span>
        </div>

        {trendData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>No historical records found for the selected filter combination.</p>
            <p style={{ fontSize: '0.825rem' }}>Try clearing filters or selecting "All Years" / "All Months".</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                  formatter={(val, name) => [val.toLocaleString() + ' Pcs', name === 'total_planned' ? 'Planned Target' : 'Actual Output']}
                />
                <Legend formatter={(value) => value === 'total_planned' ? 'Planned Target' : 'Actual Output'} />
                <Area type="monotone" dataKey="total_planned" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPlanned)" />
                <Area type="monotone" dataKey="total_produced" stroke="#10b981" fillOpacity={1} fill="url(#colorProduced)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Historical Data Table */}
      {trendData.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aggregated Performance Table</h3>
            <span className="badge badge-blue">{trendData.length} Records</span>
          </div>

          <div className="prod-table-container" style={{ border: 'none' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Time Period</th>
                  <th>Planned Target (Pcs)</th>
                  <th>Actual Output (Pcs)</th>
                  <th>Target Fulfillment</th>
                  <th>Hours Logged</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{row.label}</td>
                    <td className="font-mono">{(row.total_planned || 0).toLocaleString()}</td>
                    <td className="font-mono" style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{(row.total_produced || 0).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${row.efficiency_percent >= 90 ? 'badge-green' : row.efficiency_percent >= 75 ? 'badge-yellow' : 'badge-red'}`}>
                        {row.efficiency_percent || 0}%
                      </span>
                    </td>
                    <td className="font-mono">{row.total_hours_recorded || 0} Hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Downtime Remarks Log */}
      {downtimeLogs.length > 0 && (
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} /> Recorded Shop-Floor Downtime & Remark Log
            </h3>
          </div>

          <div className="prod-table-container" style={{ border: 'none' }}>
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Slot</th>
                  <th>Worker</th>
                  <th>Machine / Part</th>
                  <th>Downtime Remark</th>
                </tr>
              </thead>
              <tbody>
                {downtimeLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td className="font-mono">{log.date}</td>
                    <td className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{log.time_slot}</td>
                    <td><strong>{log.worker_name}</strong></td>
                    <td>{log.machine_name} ({log.part_number})</td>
                    <td style={{ color: 'var(--accent-red)' }}>{log.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
