import React, { useEffect, useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { tickSubscriber } from './engine/TickSubscriber';
import { SignalCard } from './components/SignalCard';
import { AnalysisResult, Signal } from './engine/SignalEngine';
import './signals.scss';

const AVAILABLE_MARKETS = [
    { value: 'R_100', label: 'Volatility 100 Index' },
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
];

const Signals = observer(() => {
    const [market, setMarket] = useState('R_100');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [standard, setStandard] = useState<Signal[]>([]);
    const [pro, setPro] = useState<Signal[]>([]);
    const [superSignals, setSuperSignals] = useState<Signal[]>([]);

    useEffect(() => {
        const handleState = (state: { analysis: AnalysisResult | null, standard: Signal[], pro: Signal[], super: Signal[] }) => {
            setAnalysis(state.analysis);
            setStandard(state.standard.filter(s => s.status !== 'NEUTRAL'));
            setPro(state.pro.filter(s => s.status !== 'NEUTRAL'));
            setSuperSignals(state.super);
        };

        tickSubscriber.subscribe(handleState);
        tickSubscriber.startStreaming(market);

        return () => {
            tickSubscriber.unsubscribe(handleState);
            tickSubscriber.stopStreaming();
        };
    }, [market]);

    const handleMarketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setMarket(e.target.value);
    };

    return (
        <div className="signals-container">
            <div className="signals-header">
                <div>
                    <h2>Pro Signal Engine</h2>
                    <p>Real-time analytics and trade opportunities</p>
                </div>
                <div className="market-selector">
                    <label>Select Market:</label>
                    <select value={market} onChange={handleMarketChange}>
                        {AVAILABLE_MARKETS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {analysis && (
                <div className="analysis-stats">
                    <div className="stat-box">
                        <span className="stat-label">Total Ticks</span>
                        <span className="stat-value">{analysis.totalTicks}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Strongest Digit</span>
                        <span className="stat-value">{analysis.powerIndex.strongest}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Weakest Digit</span>
                        <span className="stat-value">{analysis.powerIndex.weakest}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Power Gap</span>
                        <span className="stat-value">{analysis.powerIndex.gap.toFixed(1)}%</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Entropy</span>
                        <span className="stat-value">{analysis.entropy.toFixed(3)}</span>
                    </div>
                </div>
            )}

            <div className="signals-grid">
                <div className="signals-section">
                    <div className="section-title">
                        <h3>Super Signals</h3>
                        <span className="badge">LIVE MONITORING</span>
                    </div>
                    <div className="cards-container">
                        {superSignals.length > 0 ? (
                            superSignals.map((signal, idx) => (
                                <SignalCard key={`super-${idx}`} signal={signal} isSuper />
                            ))
                        ) : (
                            <div className="empty-state">No Super Signals currently active. (Requires 65%+ confidence)</div>
                        )}
                    </div>
                </div>

                <div className="signals-section">
                    <div className="section-title">
                        <h3>Pro Strategies</h3>
                        <span className="badge pro">ADVANCED</span>
                    </div>
                    <div className="cards-container">
                        {pro.length > 0 ? (
                            pro.map((signal, idx) => (
                                <SignalCard key={`pro-${idx}`} signal={signal} />
                            ))
                        ) : (
                            <div className="empty-state">No Pro Strategies matching criteria.</div>
                        )}
                    </div>
                </div>

                <div className="signals-section">
                    <div className="section-title">
                        <h3>Standard Signals</h3>
                        <span className="badge std">BASIC</span>
                    </div>
                    <div className="cards-container">
                        {standard.length > 0 ? (
                            standard.map((signal, idx) => (
                                <SignalCard key={`std-${idx}`} signal={signal} />
                            ))
                        ) : (
                            <div className="empty-state">No Standard Signals matching criteria.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Signals;
