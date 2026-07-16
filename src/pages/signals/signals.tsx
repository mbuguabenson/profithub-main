import React, { useEffect, useState, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { tickSubscriber } from './engine/TickSubscriber';
import { SignalCard } from './components/SignalCard';
import { AnalysisResult, Signal } from './engine/SignalEngine';
import './signals.scss';

import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const Signals = observer(() => {
    const [market, setMarket] = useState('R_100');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [standard, setStandard] = useState<Signal[]>([]);
    const [pro, setPro] = useState<Signal[]>([]);
    const [superSignals, setSuperSignals] = useState<Signal[]>([]);
    const [availableMarkets, setAvailableMarkets] = useState<{value: string, label: string}[]>([
        { value: 'R_100', label: 'Volatility 100 Index' }
    ]);

    useEffect(() => {
        if (api_base.active_symbols && api_base.active_symbols.length > 0) {
            const symbols = api_base.active_symbols
                .filter((s: any) => {
                    if (!s.symbol && !s.underlying_symbol) return false;
                    const sym = (s.symbol || s.underlying_symbol).toUpperCase();
                    if (sym.includes('BOOM') || sym.includes('CRASH')) return false;
                    if (sym.includes('1HZ15V') || sym.includes('1HZ30V') || sym.includes('1HZ90V')) return false;
                    return sym.includes('1HZ') || sym.startsWith('R_') || sym.includes('JD') || sym.includes('JUMP');
                })
                .map((s: any) => ({
                    value: s.symbol || s.underlying_symbol,
                    label: s.display_name || s.symbol || s.underlying_symbol
                }));
            
            if (symbols.length > 0) {
                setAvailableMarkets(symbols);
            }
        }
    }, [api_base.active_symbols]);

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
                <div className="header-text-glow">
                    <h2>Premium AI Signals</h2>
                    <p>Next-Generation Predictive Analytics & Trade Intelligence</p>
                </div>
                <div className="market-selector">
                    <label>Select Market:</label>
                    <div className="select-wrapper">
                        <select value={market} onChange={handleMarketChange}>
                            {availableMarkets.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
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
