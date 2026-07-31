import React, { useState, useEffect, useRef } from 'react';
import { getAppId, getSocketURL } from '@/components/shared/utils/config/config';
import { api_base } from '@/external/bot-skeleton';
import './smart-analysis.scss';

interface SymbolOption {
    value: string;
    label: string;
}

const SYMBOLS: SymbolOption[] = [
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
];

export const SmartAnalysisPage: React.FC = () => {
    // Top Bar State
    const [selectedSymbol, setSelectedSymbol] = useState<string>('R_10');
    const [ticksCountLimit, setTicksCountLimit] = useState<number>(120);
    const [currentPrice, setCurrentPrice] = useState<number | null>(4940.53);
    const [ticksBuffer, setTicksBuffer] = useState<number[]>([]);
    const [lastDigitsBuffer, setLastDigitsBuffer] = useState<number[]>([]);

    // Engines Execution Active States
    const [activeEngines, setActiveEngines] = useState<Record<string, boolean>>({
        rise_fall: false,
        even_odd_prob: false,
        even_odd_streak: false,
        over_under_rec: false,
        over_under_freq: false,
        matches_differs: false,
    });

    // Engine Parameter Inputs
    const [params, setParams] = useState({
        // Card 1: Rise/Fall
        rise_prob_threshold: 65,
        rise_last_n_ticks: 3,
        rise_tick_condition: 'Rising',
        rise_stake: 0.5,
        rise_ticks: 1,
        rise_martingale: 1,

        // Card 2: Even/Odd Prob
        even_prob_threshold: 60,
        even_last_n_ticks: 3,
        even_tick_condition: 'Even',
        even_stake: 0.5,
        even_ticks: 1,
        even_martingale: 1,

        // Card 3: Even/Odd Streak
        streak_last_n_digits: 3,
        streak_digit_target: 'Even',
        streak_stake: 0.5,
        streak_ticks: 1,
        streak_martingale: 1,

        // Card 4: Over/Under Rec
        rec_barrier: 5,
        rec_prob_threshold: 55,
        rec_last_n_ticks: 3,
        rec_stake: 0.5,
        rec_ticks: 1,
        rec_martingale: 1,

        // Card 5: Over/Under Freq
        freq_last_n_digits: 3,
        freq_barrier: 5,
        freq_target_condition: 'Over',
        freq_stake: 0.5,
        freq_ticks: 1,
        freq_martingale: 1,

        // Card 6: Matches/Differs
        matches_barrier: 5,
        matches_prob_threshold: 55,
        matches_stake: 0.5,
        matches_ticks: 1,
        matches_martingale: 1,
    });

    // Live Execution States per engine (Current Stake, Win/Loss Stats)
    const engineExecRefs = useRef<Record<string, { currentStake: number; isTrading: boolean }>>({
        rise_fall: { currentStake: 0.5, isTrading: false },
        even_odd_prob: { currentStake: 0.5, isTrading: false },
        even_odd_streak: { currentStake: 0.5, isTrading: false },
        over_under_rec: { currentStake: 0.5, isTrading: false },
        over_under_freq: { currentStake: 0.5, isTrading: false },
        matches_differs: { currentStake: 0.5, isTrading: false },
    });

    const wsRef = useRef<WebSocket | null>(null);

    // Setup Real-Time Deriv Ticks WebSocket Stream
    useEffect(() => {
        let isComponentMounted = true;

        const connectWS = async () => {
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {}
            }

            const serverUrl = await getSocketURL();
            const wsUrl = `wss://${serverUrl}/websockets/v3?app_id=${getAppId()}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!isComponentMounted) return;
                ws.send(
                    JSON.stringify({
                        ticks_history: selectedSymbol,
                        count: ticksCountLimit,
                        end: 'latest',
                        style: 'ticks',
                        subscribe: 1,
                    })
                );
            };

            ws.onmessage = (event) => {
                if (!isComponentMounted) return;
                try {
                    const data = JSON.parse(event.data);

                    if (data.msg_type === 'history' && data.history?.prices) {
                        const rawPrices: number[] = data.history.prices.map((p: string | number) => Number(p));
                        setTicksBuffer(rawPrices);
                        const digits = rawPrices.map((p) => Math.abs(Math.round(p * 100)) % 10);
                        setLastDigitsBuffer(digits);
                        if (rawPrices.length > 0) {
                            setCurrentPrice(rawPrices[rawPrices.length - 1]);
                        }
                    } else if (data.msg_type === 'tick' && data.tick) {
                        const quote = Number(data.tick.quote);
                        setCurrentPrice(quote);
                        const lastDigit = Math.abs(Math.round(quote * 100)) % 10;

                        setTicksBuffer((prev) => {
                            const updated = [...prev, quote].slice(-ticksCountLimit);
                            return updated;
                        });
                        setLastDigitsBuffer((prev) => {
                            const updated = [...prev, lastDigit].slice(-ticksCountLimit);
                            return updated;
                        });
                    }
                } catch (e) {
                    console.warn('[SmartAnalysis] Message parse error:', e);
                }
            };
        };

        connectWS();

        return () => {
            isComponentMounted = false;
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {}
            }
        };
    }, [selectedSymbol, ticksCountLimit]);

    // Handle Reconnect Button Click
    const handleReconnect = () => {
        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {}
        }
        setTicksBuffer([]);
        setLastDigitsBuffer([]);
    };

    // Calculate Analytics Indicators
    const totalTicks = ticksBuffer.length;

    // 1. Rise/Fall Percentages
    let riseCount = 0;
    let fallCount = 0;
    for (let i = 1; i < ticksBuffer.length; i++) {
        if (ticksBuffer[i] > ticksBuffer[i - 1]) riseCount++;
        else if (ticksBuffer[i] < ticksBuffer[i - 1]) fallCount++;
    }
    const rfTotal = Math.max(1, riseCount + fallCount);
    const risePct = (riseCount / rfTotal) * 100;
    const fallPct = (fallCount / rfTotal) * 100;

    // 2. Even/Odd Percentages & Streak
    let evenCount = 0;
    let oddCount = 0;
    lastDigitsBuffer.forEach((d) => {
        if (d % 2 === 0) evenCount++;
        else oddCount++;
    });
    const eoTotal = Math.max(1, totalTicks);
    const evenPct = (evenCount / eoTotal) * 100;
    const oddPct = (oddCount / eoTotal) * 100;

    let currentStreakType = 'Even';
    let currentStreakCount = 0;
    if (lastDigitsBuffer.length > 0) {
        const lastDigit = lastDigitsBuffer[lastDigitsBuffer.length - 1];
        currentStreakType = lastDigit % 2 === 0 ? 'Even' : 'Odd';
        for (let i = lastDigitsBuffer.length - 1; i >= 0; i--) {
            const isEven = lastDigitsBuffer[i] % 2 === 0;
            if ((currentStreakType === 'Even' && isEven) || (currentStreakType === 'Odd' && !isEven)) {
                currentStreakCount++;
            } else {
                break;
            }
        }
    }

    // 3. Over/Under Percentages for Barrier 5
    let overCount = 0;
    let underCount = 0;
    lastDigitsBuffer.forEach((d) => {
        if (d > params.rec_barrier) overCount++;
        else if (d < params.rec_barrier) underCount++;
    });
    const ouTotal = Math.max(1, overCount + underCount);
    const overPct = (overCount / ouTotal) * 100;
    const underPct = (underCount / ouTotal) * 100;
    const recRecommendation = overPct >= underPct ? 'OVER' : 'UNDER';
    const recProb = Math.max(overPct, underPct);

    // 4. Digit Frequency Histogram (0 to 9)
    const digitCounts = new Array(10).fill(0);
    lastDigitsBuffer.forEach((d) => {
        if (d >= 0 && d <= 9) digitCounts[d]++;
    });
    const maxFreqCount = Math.max(1, Math.max(...digitCounts));
    const mostFreqDigit = digitCounts.indexOf(Math.max(...digitCounts));
    const mostFreqPct = ((digitCounts[mostFreqDigit] || 0) / Math.max(1, totalTicks)) * 100;

    // Matches / Differs for Barrier 5
    const matchesBarrierCount = digitCounts[params.matches_barrier] || 0;
    const matchesPct = (matchesBarrierCount / Math.max(1, totalTicks)) * 100;
    const differsPct = 100 - matchesPct;

    // Toggle Engine On/Off
    const toggleEngine = (engineKey: string) => {
        setActiveEngines((prev) => ({
            ...prev,
            [engineKey]: !prev[engineKey],
        }));
    };

    // Execute Deriv Trade Contract Order
    const executeTradeOrder = async (tradeType: string, stakeAmount: number, durationTicks: number, barrierDigit?: number) => {
        if (!api_base.api) {
            console.warn('[SmartAnalysis] Deriv API not connected');
            return;
        }

        try {
            const req: any = {
                proposal: 1,
                amount: stakeAmount,
                basis: 'stake',
                contract_type: tradeType,
                currency: api_base.account_info?.currency || 'USD',
                duration: durationTicks,
                duration_unit: 't',
                symbol: selectedSymbol,
            };

            if (barrierDigit !== undefined && ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(tradeType)) {
                req.barrier = String(barrierDigit);
            }

            const proposalRes = await api_base.api.send(req);
            if (proposalRes?.proposal?.id) {
                const buyRes = await api_base.api.send({
                    buy: proposalRes.proposal.id,
                    price: proposalRes.proposal.ask_price,
                });
                console.log(`[SmartAnalysis Engine] ${tradeType} Trade Order Placed:`, buyRes);
            }
        } catch (err) {
            console.error('[SmartAnalysis Engine] Trade execution error:', err);
        }
    };

    // Real-Time Evaluation Loop on Tick Update
    useEffect(() => {
        if (ticksBuffer.length < 5) return;

        // 1. Rise/Fall Card Evaluation
        if (activeEngines.rise_fall) {
            if (risePct >= params.rise_prob_threshold) {
                executeTradeOrder('CALL', params.rise_stake, params.rise_ticks);
            }
        }

        // 2. Even/Odd Prob Card Evaluation
        if (activeEngines.even_odd_prob) {
            if (evenPct >= params.even_prob_threshold) {
                executeTradeOrder('DIGITEVEN', params.even_stake, params.even_ticks);
            } else if (oddPct >= params.even_prob_threshold) {
                executeTradeOrder('DIGITODD', params.even_stake, params.even_ticks);
            }
        }

        // 3. Even/Odd Streak Card Evaluation
        if (activeEngines.even_odd_streak) {
            if (currentStreakCount >= params.streak_last_n_digits) {
                const typeToBuy = currentStreakType === 'Even' ? 'DIGITEVEN' : 'DIGITODD';
                executeTradeOrder(typeToBuy, params.streak_stake, params.streak_ticks);
            }
        }

        // 4. Over/Under Rec Card Evaluation
        if (activeEngines.over_under_rec) {
            if (recProb >= params.rec_prob_threshold) {
                const typeToBuy = recRecommendation === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER';
                executeTradeOrder(typeToBuy, params.rec_stake, params.rec_ticks, params.rec_barrier);
            }
        }

        // 5. Over/Under Freq Card Evaluation
        if (activeEngines.over_under_freq) {
            const targetType = params.freq_target_condition === 'Over' ? 'DIGITOVER' : 'DIGITUNDER';
            executeTradeOrder(targetType, params.freq_stake, params.freq_ticks, params.freq_barrier);
        }

        // 6. Matches/Differs Card Evaluation
        if (activeEngines.matches_differs) {
            if (matchesPct >= params.matches_prob_threshold) {
                executeTradeOrder('DIGITMATCH', params.matches_stake, params.matches_ticks, params.matches_barrier);
            }
        }
    }, [ticksBuffer, activeEngines]);

    return (
        <div className="smart-analysis-container">
            {/* Top Bar Controls */}
            <div className="smart-analysis-header">
                <div className="smart-analysis-header__controls">
                    <div className="smart-analysis-header__group">
                        <label>Symbol</label>
                        <select value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}>
                            {SYMBOLS.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="smart-analysis-header__group">
                        <label>Ticks</label>
                        <input
                            type="number"
                            value={ticksCountLimit}
                            min={10}
                            max={1000}
                            onChange={(e) => setTicksCountLimit(Number(e.target.value))}
                        />
                    </div>

                    <div className="smart-analysis-header__price-badge">
                        <span>Price:</span>
                        <span className="price-val">{currentPrice !== null ? currentPrice.toFixed(2) : 'Loading...'}</span>
                    </div>
                </div>

                <button className="smart-analysis-header__reconnect-btn" onClick={handleReconnect}>
                    🔄 Reconnect
                </button>
            </div>

            {/* Grid of 6 Strategy Engines */}
            <div className="smart-analysis-grid">
                {/* 1. Rise / Fall Card */}
                <div className={`engine-card ${activeEngines.rise_fall ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Rise/Fall</h3>
                        <span className={`status-dot ${activeEngines.rise_fall ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Rise</span>
                            <span>{risePct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${risePct}%`, background: '#22c55e' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Fall</span>
                            <span>{fallPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${fallPct}%`, background: '#ef4444' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Rise Prob &gt;</span>
                            <input
                                type="number"
                                value={params.rise_prob_threshold}
                                onChange={(e) => setParams({ ...params, rise_prob_threshold: Number(e.target.value) })}
                            />
                            <span>%</span>
                        </div>
                        <div className="cond-row">
                            <input type="checkbox" defaultChecked />
                            <span>and last</span>
                            <input
                                type="number"
                                value={params.rise_last_n_ticks}
                                onChange={(e) => setParams({ ...params, rise_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks are</span>
                            <select
                                value={params.rise_tick_condition}
                                onChange={(e) => setParams({ ...params, rise_tick_condition: e.target.value })}
                            >
                                <option value="Rising">Rising</option>
                                <option value="Falling">Falling</option>
                            </select>
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>Buy Rise</strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.rise_stake}
                                onChange={(e) => setParams({ ...params, rise_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.rise_ticks}
                                onChange={(e) => setParams({ ...params, rise_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.rise_martingale}
                                onChange={(e) => setParams({ ...params, rise_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.rise_fall ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('rise_fall')}
                    >
                        {activeEngines.rise_fall ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>

                {/* 2. Even / Odd (Probability) Card */}
                <div className={`engine-card ${activeEngines.even_odd_prob ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Even/Odd</h3>
                        <span className={`status-dot ${activeEngines.even_odd_prob ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Even</span>
                            <span>{evenPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${evenPct}%`, background: '#3b82f6' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Odd</span>
                            <span>{oddPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${oddPct}%`, background: '#8b5cf6' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Even Prob &gt;</span>
                            <input
                                type="number"
                                value={params.even_prob_threshold}
                                onChange={(e) => setParams({ ...params, even_prob_threshold: Number(e.target.value) })}
                            />
                            <span>%</span>
                        </div>
                        <div className="cond-row">
                            <input type="checkbox" defaultChecked />
                            <span>and last</span>
                            <input
                                type="number"
                                value={params.even_last_n_ticks}
                                onChange={(e) => setParams({ ...params, even_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks are</span>
                            <select
                                value={params.even_tick_condition}
                                onChange={(e) => setParams({ ...params, even_tick_condition: e.target.value })}
                            >
                                <option value="Even">Even</option>
                                <option value="Odd">Odd</option>
                            </select>
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>Buy Even</strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.even_stake}
                                onChange={(e) => setParams({ ...params, even_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.even_ticks}
                                onChange={(e) => setParams({ ...params, even_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.even_martingale}
                                onChange={(e) => setParams({ ...params, even_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.even_odd_prob ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('even_odd_prob')}
                    >
                        {activeEngines.even_odd_prob ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>

                {/* 3. Even / Odd (Streak & Pattern) Card */}
                <div className={`engine-card ${activeEngines.even_odd_streak ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Even/Odd</h3>
                        <span className={`status-dot ${activeEngines.even_odd_streak ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                        LAST DIGITS PATTERN
                    </div>
                    <div className="digit-pattern-row">
                        {lastDigitsBuffer.slice(-10).map((d, i) => (
                            <span key={i} className={`digit-pill ${d % 2 === 0 ? 'digit-pill--even' : 'digit-pill--odd'}`}>
                                {d % 2 === 0 ? 'E' : 'O'}
                            </span>
                        ))}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                        Recent digit pattern (E=Even, O=Odd)
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                        Current streak: {currentStreakCount} {currentStreakType}
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span>Check if the last</span>
                            <input
                                type="number"
                                value={params.streak_last_n_digits}
                                onChange={(e) => setParams({ ...params, streak_last_n_digits: Number(e.target.value) })}
                            />
                            <span>digits are</span>
                            <select
                                value={params.streak_digit_target}
                                onChange={(e) => setParams({ ...params, streak_digit_target: e.target.value })}
                            >
                                <option value="Even">Even</option>
                                <option value="Odd">Odd</option>
                            </select>
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>Buy Even</strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.streak_stake}
                                onChange={(e) => setParams({ ...params, streak_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.streak_ticks}
                                onChange={(e) => setParams({ ...params, streak_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.streak_martingale}
                                onChange={(e) => setParams({ ...params, streak_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.even_odd_streak ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('even_odd_streak')}
                    >
                        {activeEngines.even_odd_streak ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>

                {/* 4. Over / Under (Recommendation & Barrier) Card */}
                <div className={`engine-card ${activeEngines.over_under_rec ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Over/Under</h3>
                        <span className={`status-dot ${activeEngines.over_under_rec ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Barrier</span>
                        <input
                            type="number"
                            style={{
                                width: '50px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontWeight: 700,
                                textAlign: 'center',
                            }}
                            value={params.rec_barrier}
                            onChange={(e) => setParams({ ...params, rec_barrier: Number(e.target.value) })}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Under: 0-4, Equals: 5, Over: 6-9</span>
                    </div>

                    <div className="recommendation-box">
                        <span>Recommendation {recRecommendation}</span>
                        <span className="pct-badge">{recProb.toFixed(1)}%</span>
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Over</span>
                            <span>{overPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${overPct}%`, background: '#22c55e' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Under</span>
                            <span>{underPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${underPct}%`, background: '#f97316' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Over Prob &gt;</span>
                            <input
                                type="number"
                                value={params.rec_prob_threshold}
                                onChange={(e) => setParams({ ...params, rec_prob_threshold: Number(e.target.value) })}
                            />
                            <span>%</span>
                        </div>
                        <div className="cond-row">
                            <input type="checkbox" defaultChecked />
                            <span>and last</span>
                            <input
                                type="number"
                                value={params.rec_last_n_ticks}
                                onChange={(e) => setParams({ ...params, rec_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks Over</span>
                            <input
                                type="number"
                                value={params.rec_barrier}
                                onChange={(e) => setParams({ ...params, rec_barrier: Number(e.target.value) })}
                            />
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>Buy Over digit {params.rec_barrier}</strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.rec_stake}
                                onChange={(e) => setParams({ ...params, rec_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.rec_ticks}
                                onChange={(e) => setParams({ ...params, rec_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.rec_martingale}
                                onChange={(e) => setParams({ ...params, rec_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.over_under_rec ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('over_under_rec')}
                    >
                        {activeEngines.over_under_rec ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>

                {/* 5. Over / Under (Pattern & Frequency) Card */}
                <div className={`engine-card ${activeEngines.over_under_freq ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Over/Under</h3>
                        <span className={`status-dot ${activeEngines.over_under_freq ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                        LAST DIGITS PATTERN
                    </div>
                    <div className="digit-pattern-row">
                        {lastDigitsBuffer.slice(-10).map((d, i) => {
                            const typeCls = d > 5 ? 'digit-pill--over' : d < 5 ? 'digit-pill--under' : 'digit-pill--equal';
                            const labelStr = d > 5 ? `${d}o` : d < 5 ? `${d}u` : `${d}e`;
                            return (
                                <span key={i} className={`digit-pill ${typeCls}`}>
                                    {labelStr}
                                </span>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                        O=Over (&gt;5), E=Equal (=5), U=Under (&lt;5)
                    </div>

                    {/* Digit Histogram */}
                    <div className="digit-histogram">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(36, Math.round((count / maxFreqCount) * 36));
                            return (
                                <div key={d} className="histo-col">
                                    <span className="pct-val">{pct.toFixed(1)}%</span>
                                    <div className="bar-wrapper">
                                        <div className="bar-fill" style={{ height: `${barH}px` }}></div>
                                    </div>
                                    <span className="digit-lbl">{d}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span>Check if the last</span>
                            <input
                                type="number"
                                value={params.freq_last_n_digits}
                                onChange={(e) => setParams({ ...params, freq_last_n_digits: Number(e.target.value) })}
                            />
                            <span>digits are</span>
                            <select
                                value={params.freq_target_condition}
                                onChange={(e) => setParams({ ...params, freq_target_condition: e.target.value })}
                            >
                                <option value="Over">Over</option>
                                <option value="Under">Under</option>
                            </select>
                            <input
                                type="number"
                                value={params.freq_barrier}
                                onChange={(e) => setParams({ ...params, freq_barrier: Number(e.target.value) })}
                            />
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>
                                Buy {params.freq_target_condition} digit {params.freq_barrier}
                            </strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.freq_stake}
                                onChange={(e) => setParams({ ...params, freq_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.freq_ticks}
                                onChange={(e) => setParams({ ...params, freq_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.freq_martingale}
                                onChange={(e) => setParams({ ...params, freq_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.over_under_freq ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('over_under_freq')}
                    >
                        {activeEngines.over_under_freq ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>

                {/* 6. Matches / Differs Card */}
                <div className={`engine-card ${activeEngines.matches_differs ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <h3>Matches/Differs</h3>
                        <span className={`status-dot ${activeEngines.matches_differs ? 'status-dot--active' : ''}`}></span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                        Most frequent: {mostFreqDigit} ({mostFreqPct.toFixed(2)}%)
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Matches {params.matches_barrier}</span>
                            <span>{matchesPct.toFixed(2)}%</span>
                        </div>

                        <div className="stat-row">
                            <span>Differs from {params.matches_barrier}</span>
                            <span>{differsPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${differsPct}%`, background: 'linear-gradient(90deg, #ec4899, #8b5cf6)' }}
                            ></div>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
                        Barrier digit {params.matches_barrier} appears {matchesPct.toFixed(2)}% of the time
                    </div>

                    {/* Digit Histogram */}
                    <div className="digit-histogram">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(36, Math.round((count / maxFreqCount) * 36));
                            return (
                                <div key={d} className="histo-col">
                                    <span className="pct-val">{pct.toFixed(1)}%</span>
                                    <div className="bar-wrapper">
                                        <div className="bar-fill" style={{ height: `${barH}px` }}></div>
                                    </div>
                                    <span className="digit-lbl">{d}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="trading-condition-box">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Matches Prob for</span>
                            <input
                                type="number"
                                value={params.matches_barrier}
                                onChange={(e) => setParams({ ...params, matches_barrier: Number(e.target.value) })}
                            />
                            <span>&gt;</span>
                            <input
                                type="number"
                                value={params.matches_prob_threshold}
                                onChange={(e) => setParams({ ...params, matches_prob_threshold: Number(e.target.value) })}
                            />
                            <span>%</span>
                        </div>
                        <div className="cond-row">
                            <span className="then-badge">Then</span>
                            <strong>Buy Matches</strong>
                        </div>
                    </div>

                    <div className="execution-inputs">
                        <div className="input-field">
                            <label>Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                value={params.matches_stake}
                                onChange={(e) => setParams({ ...params, matches_stake: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Ticks</label>
                            <input
                                type="number"
                                value={params.matches_ticks}
                                onChange={(e) => setParams({ ...params, matches_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label>Martingale</label>
                            <input
                                type="number"
                                value={params.matches_martingale}
                                onChange={(e) => setParams({ ...params, matches_martingale: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <button
                        className={`btn-start-auto ${activeEngines.matches_differs ? 'btn-start-auto--active' : ''}`}
                        onClick={() => toggleEngine('matches_differs')}
                    >
                        {activeEngines.matches_differs ? 'Stop Auto Trading' : 'Start Auto Trading'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartAnalysisPage;
