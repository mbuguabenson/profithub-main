import React from 'react';
import { exportTransactionsToCSV } from '../utils/excel-export';

interface TransactionHistoryTabProps {
    tradeLogs: any[];
}

export const TransactionHistoryTab: React.FC<TransactionHistoryTabProps> = ({
    tradeLogs,
}) => {
    const mockLogs = [
        {
            id: 'ACE-84910291',
            timestamp: Date.now() - 120000,
            symbol: '1HZ100V',
            strategy: 'Over / Under Pro',
            contractType: 'DIGITOVER',
            stake: 0.35,
            entryPrice: 4210.82,
            exitPrice: 4211.55,
            pnl: 0.33,
            runningBalance: 418.40,
            result: 'WIN',
            duration: 1,
            signalStrength: 88,
            recoveryUsed: false,
        },
        {
            id: 'ACE-84910182',
            timestamp: Date.now() - 360000,
            symbol: '1HZ100V',
            strategy: 'Even Parity',
            contractType: 'DIGITEVEN',
            stake: 0.35,
            entryPrice: 4209.11,
            exitPrice: 4209.90,
            pnl: 0.33,
            runningBalance: 418.07,
            result: 'WIN',
            duration: 1,
            signalStrength: 82,
            recoveryUsed: false,
        },
    ];

    const displayLogs = tradeLogs.length > 0 ? tradeLogs : mockLogs;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="ace-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem' }}>Transaction History & Execution Logs</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        Complete audit trail of all manual and automated trades executed by ACE.
                    </p>
                </div>

                <button className="ace-btn btn-accent" onClick={() => exportTransactionsToCSV(displayLogs)}>
                    📥 Export CSV / Excel
                </button>
            </div>

            <div className="ace-card">
                <div className="ace-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Trade ID</th>
                                <th>Date & Time</th>
                                <th>Market</th>
                                <th>Strategy</th>
                                <th>Contract</th>
                                <th>Stake ($)</th>
                                <th>P/L ($)</th>
                                <th>Balance ($)</th>
                                <th>Result</th>
                                <th>Signal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayLogs.map((log, idx) => (
                                <tr key={log.id || idx}>
                                    <td><code className="ace-mono" style={{ color: '#3b82f6' }}>{log.id}</code></td>
                                    <td style={{ fontSize: '0.8rem', opacity: 0.85 }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td><strong>{log.symbol}</strong></td>
                                    <td>{log.strategy}</td>
                                    <td><span className="ace-mono">{log.contractType}</span></td>
                                    <td>${(log.stake || 0).toFixed(2)}</td>
                                    <td style={{ color: log.pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                        {log.pnl >= 0 ? `+$${log.pnl.toFixed(2)}` : `-$${Math.abs(log.pnl).toFixed(2)}`}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>${(log.runningBalance || 0).toFixed(2)}</td>
                                    <td>
                                        <span
                                            style={{
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                background: log.result === 'WIN' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                color: log.result === 'WIN' ? '#10b981' : '#ef4444',
                                            }}
                                        >
                                            {log.result}
                                        </span>
                                    </td>
                                    <td style={{ color: '#f59e0b', fontWeight: 700 }}>{log.signalStrength}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
