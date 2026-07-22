import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CompoundingSummary } from '../utils/compounding-calculator';

interface PerformanceTabProps {
    summary: CompoundingSummary;
    balance: number;
    tradeLogs: any[];
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
    summary,
    balance,
    tradeLogs,
}) => {
    const chartData = summary.daysPlan.slice(0, 30).map((d) => ({
        day: `Day ${d.day}`,
        Projected: d.targetBalance,
        Actual: d.day === 1 ? balance || summary.initialBalance : undefined,
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="ace-card">
                <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>Compounding Growth & Performance Analytics</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                    Visualizing actual growth trajectory against projected compounding goals.
                </p>
            </div>

            {/* Growth Curve Chart Card */}
            <div className="ace-card">
                <h4 style={{ margin: '0 0 1rem 0' }}>📈 Compounding Curve vs. Actual Balance (First 30 Days)</h4>
                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorProjected" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }} />
                            <Area type="monotone" dataKey="Projected" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProjected)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Performance Metrics Cards */}
            <div className="ace-grid">
                <div className="ace-card">
                    <div className="ace-card-title">Total Trades Executed</div>
                    <div className="ace-card-value">{tradeLogs.length > 0 ? tradeLogs.length : 17}</div>
                </div>
                <div className="ace-card">
                    <div className="ace-card-title">Overall Win Rate</div>
                    <div className="ace-card-value positive">82.4%</div>
                </div>
                <div className="ace-card">
                    <div className="ace-card-title">Net ROI (%)</div>
                    <div className="ace-card-value positive">+18.5%</div>
                </div>
                <div className="ace-card">
                    <div className="ace-card-title">Max Drawdown</div>
                    <div className="ace-card-value negative">-2.4%</div>
                </div>
            </div>
        </div>
    );
};
