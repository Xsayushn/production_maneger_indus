import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Download, Filter, TrendingUp, Users, Package, Clock, CheckCircle2, FileText } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';

export default function HistoricalAnalytics({ workers, parts, machines }) {
  const [period, setPeriod] = useState('daily'); // 'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly'
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [monthFilter, setMonthFilter] = useState((new Date().getMonth() + 1).toString());
  const [workerFilter, setWorkerFilter] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [machineFilter, setMachineFilter] = useState('');

  const [data, setData] = useState({
    summary: {},
    trendData: [],
    downtimeLogs: []
  });
  const [loading, setLoading] = useState(false);

  const fetchHistoricalData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period,
        ...(yearFilter && { year: yearFilter }),
        ...(monthFilter && { month: monthFilter }),
        ...(workerFilter && { worker: workerFilter }),
        ...(partFilter && { part: partFilter }),
        ...(machineFilter && { machine: machineFilter })
      });

      const res = await fetch(`/api/analytics/historical?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching historical analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData();
  }, [period, yearFilter, monthFilter, workerFilter, partFilter, machineFilter]);

  // Export to CSV function
  const handleExportCSV = () => {
    if (!data.trendData || data.trendData.length === 0) return;

    const headers = ['Timeframe Label', 'Planned Qty Target', 'Produced Qty Actual', 'Efficiency %', 'Active Days'];
    const rows = data.trendData.map(row => [
      row.label,
      row.total_planned,
      row.total_produced,
      `${row.efficiency_percent}%`,
      row.active_days || 1
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `production_evaluation_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { summary, trendData, downtimeLogs } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Evaluation Title */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BarChart3 color="var(--accent-cyan)" size={24} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Historical Evaluation & Analytics Center</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Long-term archive and multi-interval evaluation (Yearly, Monthly, Weekly, Daily, Hourly)
          </p>
        </div>

        <button onClick={handleExportCSV} className="btn btn-success" disabled={!trendData || trendData.length === 0}>
          <Download size={16} /> Export Evaluation Report (CSV)
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-panel" style={{ padding: '1.2rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={14} /> Historical Evaluation Timeframe & Filters
        </div>

        {/* Period Selector Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
          {[
            { id: 'yearly', label: 'Yearly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'daily', label: 'Daily' },
            { id: 'hourly', label: 'Hourly' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setPeriod(btn.id)}
              className={`btn ${period === btn.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Select Year</label>
            <select className="form-control" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Select Month</label>
            <select className="form-control" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m.toString()}>Month {m}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Worker Filter</label>
            <select className="form-control" value={workerFilter} onChange={(e) => setWorkerFilter(e.target.value)}>
              <option value="">All Workers</option>
              {workers.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Part Number Filter</label>
            <select className="form-control" value={partFilter} onChange={(e) => setPartFilter(e.target.value)}>
              <option value="">All Parts</option>
              {parts.map(p => (
                <option key={p.id} value={p.part_number}>{p.part_number}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Machine Filter</label>
            <select className="form-control" value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
              <option value="">All Machines</option>
              {machines.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Evaluation Summary Scorecards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Planned Qty</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '0.2rem' }}>
            {(summary?.grand_planned || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Produced Actual</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-green)', marginTop: '0.2rem' }}>
            {(summary?.grand_produced || 0).toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pcs</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Efficiency %</div>
          <div className="font-mono" style={{ 
            fontSize: '1.6rem', 
            fontWeight: 800, 
            color: (summary?.grand_efficiency || 0) >= 100 ? 'var(--accent-green)' : (summary?.grand_efficiency || 0) >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)',
            marginTop: '0.2rem' 
          }}>
            {summary?.grand_efficiency || 0}%
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Days & Active Workers</div>
          <div className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem' }}>
            {summary?.total_days_worked || 0} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Days</span> &bull; {summary?.total_workers_active || 0} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Workers</span>
          </div>
        </div>
      </div>

      {/* Visual Charts Component */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp color="var(--accent-cyan)" size={18} /> Production Fulfillment & Target Comparison Trend ({period.toUpperCase()})
        </h3>

        {trendData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            No evaluation data available for the selected filters.
          </div>
        ) : (
          <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }} 
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Bar dataKey="total_planned" name="Planned Target Qty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_produced" name="Produced Actual Qty" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Evaluation Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText color="var(--accent-cyan)" size={18} /> Evaluation Data Table ({period.toUpperCase()} Breakdown)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{trendData.length} Intervals Recorded</span>
        </div>

        <div className="prod-table-container" style={{ border: 'none' }}>
          <table className="prod-table">
            <thead>
              <tr>
                <th>Interval / Label</th>
                <th>Planned Target Qty</th>
                <th>Produced Actual Qty</th>
                <th>Variance (Pcs)</th>
                <th>Target Fulfillment %</th>
                <th>Active Production Days</th>
              </tr>
            </thead>
            <tbody>
              {trendData.map((row, idx) => {
                const diff = row.total_produced - row.total_planned;
                const eff = row.efficiency_percent;

                return (
                  <tr key={idx}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {row.label}
                    </td>
                    <td className="font-mono">{row.total_planned?.toLocaleString()}</td>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      {row.total_produced?.toLocaleString()}
                    </td>
                    <td className="font-mono" style={{ color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td>
                      <span className={`badge ${eff >= 100 ? 'badge-green' : eff >= 80 ? 'badge-yellow' : 'badge-red'}`}>
                        {eff}%
                      </span>
                    </td>
                    <td className="font-mono">{row.active_days || 1} Days</td>
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
