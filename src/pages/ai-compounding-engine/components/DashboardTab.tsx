import React from 'react';
import { CompoundingSummary } from '../utils/compounding-calculator';
import { SymbolMarketData } from '../hooks/useCompoundingWS';

interface DashboardTabProps {
    summary: CompoundingSummary;
    botStatus: string;
    setBotStatus: (s: string) => void;
    activeMarketData?: SymbolMarketData;
    balance: number;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
    summary,
    botStatus,
    setBotStatus,
    activeMarketData,
    balance,
}) => {
    const currentStake = summary.projectedStake;
    const todayProfit = 18.40;
    const remainingProfit = summary.targetBalance - balance;
    const challengeProgress = Math.min(parseFloat(((balance / summary.targetBalance) * 100).toFixed(1)), 100);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Stat Cards Grid */}
            <div className="ace-grid">
                <div className="ace-card">
                    <div className="ace-card-title">Current Balance</div>
                    <div className="ace-card-value positive">${balance > 0 ? balance.toFixed(2) : summary.initialBalance.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Target: ${summary.targetBalance}</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Today's Profit</div>
                    <div className="ace-card-value positive">+${todayProfit.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>Daily Target: ${summary.targetDailyProfit.toFixed(2)}</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Challenge Progress</div>
                    <div className="ace-card-value accent">{challengeProgress}%</div>
                    <div className="ace-progress-bar">
                        <div className="ace-progress-fill green" style={{ width: `${challengeProgress}%` }} />
                    </div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Remaining Profit</div>
                    <div className="ace-card-value">${remainingProfit > 0 ? remainingProfit.toFixed(2) : '0.00'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{summary.days} Days Compounding</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Current Stake</div>
                    <div className="ace-card-value">${currentStake.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Max Stake: ${(currentStake * 3).toFixed(2)}</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Daily Target</div>
                    <div className="ace-card-value positive">+${summary.targetDailyProfit.toFixed(2)}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Growth: +{summary.dailyGrowthPct}%/day</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Days Remaining</div>
                    <div className="ace-card-value">{summary.days - 1}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Day 1 of {summary.days}</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Current Win Rate</div>
                    <div className="ace-card-value positive">82.4%</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>14 Wins / 3 Losses</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Consecutive Wins</div>
                    <div className="ace-card-value positive">5 🔥</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Max Consecutive: 8</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Current Market</div>
                    <div className="ace-card-value accent" style={{ fontSize: '1.1rem' }}>{activeMarketData?.displayName || 'Volatility 100 (1s)'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem' }}>Health: {activeMarketData?.healthScore || 92}%</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Current Strategy</div>
                    <div className="ace-card-value" style={{ fontSize: '1.1rem' }}>Over / Under Pro</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Signal Strength: {activeMarketData?.signalStrength || 85}%</div>
                </div>

                <div className="ace-card">
                    <div className="ace-card-title">Bot Status</div>
                    <div className="ace-card-value">
                        <span className={`ace-status-pill status-${botStatus}`}>{botStatus}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.4rem' }}>Engine Active & Scanning</div>
                </div>
            </div>

            {/* Quick Engine Controls Card */}
            <div className="ace-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>AI Compounding Automation Engine</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        Active Challenge: <strong style={{ color: '#10b981' }}>${summary.initialBalance} → ${summary.targetBalance}</strong> in {summary.days} Days
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {botStatus === 'PAUSED' || botStatus === 'WAITING' ? (
                        <button className="ace-btn btn-primary" onClick={() => setBotStatus('AUTO')}>
                            ▶ Start Auto Engine
                        </button>
                    ) : (
                        <button className="ace-btn btn-secondary" onClick={() => setBotStatus('PAUSED')}>
                            ⏸ Pause Engine
                        </button>
                    )}
                    <button className="ace-btn btn-danger" onClick={() => setBotStatus('WAITING')}>
                        ⏹ Stop Engine
                    </button>
                </div>
            </div>
        </div>
    );
};
