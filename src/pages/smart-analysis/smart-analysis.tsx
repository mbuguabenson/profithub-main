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

const TOP_TICKER_SYMBOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];

export const SmartAnalysisPage: React.FC = () => {
    // Top Bar & State
    const [selectedSymbol, setSelectedSymbol] = useState<string>('R_10');
    const [ticksCountLimit, setTicksCountLimit] = useState<number>(120);
    const [currentPrice, setCurrentPrice] = useState<number | null>(4940.53);
    const [priceFlashClass, setPriceFlashClass] = useState<string>('');
    const [ticksBuffer, setTicksBuffer] = useState<number[]>([]);
    const [lastDigitsBuffer, setLastDigitsBuffer] = useState<number[]>([]);

    // Multi-Market Top Ticker Live Quotes
    const [marketQuotes, setMarketQuotes] = useState<Record<string, { price: number; direction: 'up' | 'down' }>>({
        R_10: { price: 642.12, direction: 'up' },
        R_25: { price: 189.45, direction: 'down' },
        R_50: { price: 312.80, direction: 'up' },
        R_75: { price: 541.20, direction: 'down' },
        R_100: { price: 1240.65, direction: 'up' },
    });

    // Engine Active Execution States
    const [activeEngines, setActiveEngines] = useState<Record<string, boolean>>({
        rise_fall: false,
        even_odd_prob: false,
        even_odd_streak: false,
        over_under_rec: false,
        over_under_freq: false,
        matches_differs: false,
    });

    // Engine Parameters
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

    const wsRef = useRef<WebSocket | null>(null);
    const prevPriceRef = useRef<number | null>(null);

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
                // Subscribe to active main symbol
                ws.send(
                    JSON.stringify({
                        ticks_history: selectedSymbol,
                        count: ticksCountLimit,
                        end: 'latest',
                        style: 'ticks',
                        subscribe: 1,
                    })
                );

                // Also subscribe to top market ticker symbols
                TOP_TICKER_SYMBOLS.forEach((sym) => {
                    if (sym !== selectedSymbol) {
                        ws.send(JSON.stringify({ ticks: sym }));
                    }
                });
            };

            ws.onmessage = (event) => {
                if (!isComponentMounted) return;
                try {
                    const data = JSON.parse(event.data);

                    // History for active main symbol
                    if (data.msg_type === 'history' && data.history?.prices) {
                        const rawPrices: number[] = data.history.prices.map((p: string | number) => Number(p));
                        setTicksBuffer(rawPrices);
                        const digits = rawPrices.map((p) => Math.abs(Math.round(p * 100)) % 10);
                        setLastDigitsBuffer(digits);
                        if (rawPrices.length > 0) {
                            const latest = rawPrices[rawPrices.length - 1];
                            setCurrentPrice(latest);
                            prevPriceRef.current = latest;
                        }
                    } else if (data.msg_type === 'tick' && data.tick) {
                        const tickSymbol = data.tick.symbol;
                        const quote = Number(data.tick.quote);

                        // If tick is for main selected symbol
                        if (tickSymbol === selectedSymbol) {
                            if (prevPriceRef.current !== null) {
                                if (quote > prevPriceRef.current) {
                                    setPriceFlashClass('flash-up');
                                } else if (quote < prevPriceRef.current) {
                                    setPriceFlashClass('flash-down');
                                }
                                setTimeout(() => setPriceFlashClass(''), 600);
                            }
                            prevPriceRef.current = quote;
                            setCurrentPrice(quote);
                            const lastDigit = Math.abs(Math.round(quote * 100)) % 10;

                            setTicksBuffer((prev) => [...prev, quote].slice(-ticksCountLimit));
                            setLastDigitsBuffer((prev) => [...prev, lastDigit].slice(-ticksCountLimit));
                        }

                        // Update multi-market ticker strip quote
                        if (TOP_TICKER_SYMBOLS.includes(tickSymbol)) {
                            setMarketQuotes((prev) => {
                                const oldPrice = prev[tickSymbol]?.price || quote;
                                return {
                                    ...prev,
                                    [tickSymbol]: {
                                        price: quote,
                                        direction: quote >= oldPrice ? 'up' : 'down',
                                    },
                                };
                            });
                        }
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

    // Handle Reconnect Button
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
                currency: (api_base.account_info as any)?.currency || 'USD',
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
            {/* Multi-Market Live Ticker Bar */}
            <div className="market-ticker-strip">
                {TOP_TICKER_SYMBOLS.map((sym) => {
                    const q = marketQuotes[sym] || { price: 0, direction: 'up' };
                    const isActive = selectedSymbol === sym;
                    return (
                        <div
                            key={sym}
                            className={`ticker-item ${isActive ? 'ticker-item--active' : ''}`}
                            onClick={() => setSelectedSymbol(sym)}
                        >
                            <span className="symbol-name">{sym}</span>
                            <span className={`symbol-price ${q.direction === 'up' ? 'price-up' : 'price-down'}`}>
                                {q.direction === 'up' ? '▲' : '▼'} {q.price ? q.price.toFixed(2) : 'Loading...'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Top Control Panel */}
            <div className="smart-analysis-header">
                <div className="smart-analysis-header__title-area">
                    <span className="title-icon">📈</span>
                    <div>
                        <h2>Smart Analysis Engine</h2>
                        <span>Real-Time Market Tick-Stream & Strategy Scanner Suite</span>
                    </div>
                </div>

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

                    <div className={`smart-analysis-header__price-hero ${priceFlashClass}`}>
                        <span className="label">Live Price</span>
                        <span className="price">{currentPrice !== null ? currentPrice.toFixed(2) : 'Loading...'}</span>
                    </div>
                </div>

                <button className="smart-analysis-header__reconnect-btn" onClick={handleReconnect}>
                    🔄 Reconnect Stream
                </button>
            </div>

            {/* Live Ticks Scrolling Ribbon */}
            <div className="ticks-ribbon">
                <span className="ribbon-label">Tick Stream</span>
                {ticksBuffer.slice(-15).map((price, idx, arr) => {
                    const prevPrice = idx > 0 ? arr[idx - 1] : price;
                    const isUp = price >= prevPrice;
                    return (
                        <div key={idx} className={`tick-chip ${isUp ? 'tick-chip--up' : 'tick-chip--down'}`}>
                            {isUp ? '▲' : '▼'} {price.toFixed(2)}
                        </div>
                    );
                })}
            </div>

            {/* Grid of 6 Strategy Cards */}
            <div className="smart-analysis-grid">
                {/* 1. Rise / Fall Card */}
                <div className={`engine-card ${activeEngines.rise_fall ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--risefall">📈</div>
                            <h3>Rise/Fall</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.rise_fall ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.rise_fall ? 'Running' : 'Idle'}</span>
                        </div>
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
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--evenodd">🔢</div>
                            <h3>Even/Odd</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.even_odd_prob ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.even_odd_prob ? 'Running' : 'Idle'}</span>
                        </div>
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
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--streak">🎯</div>
                            <h3>Even/Odd</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.even_odd_streak ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.even_odd_streak ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>
                        LAST DIGITS PATTERN
                    </div>
                    <div className="digit-pattern-row">
                        {lastDigitsBuffer.slice(-10).map((d, i) => (
                            <span key={i} className={`digit-pill ${d % 2 === 0 ? 'digit-pill--even' : 'digit-pill--odd'}`}>
                                {d % 2 === 0 ? 'E' : 'O'}
                            </span>
                        ))}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                        Recent digit pattern (E=Even, O=Odd)
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#60a5fa', marginBottom: '12px' }}>
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
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--overunder">📊</div>
                            <h3>Over/Under</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.over_under_rec ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.over_under_rec ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Barrier</span>
                        <input
                            type="number"
                            style={{
                                width: '50px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                background: 'rgba(15, 23, 42, 0.8)',
                                color: '#ffffff',
                                fontWeight: 800,
                                textAlign: 'center',
                            }}
                            value={params.rec_barrier}
                            onChange={(e) => setParams({ ...params, rec_barrier: Number(e.target.value) })}
                        />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Under: 0-4, Equals: 5, Over: 6-9</span>
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
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--overunder">⚡</div>
                            <h3>Over/Under</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.over_under_freq ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.over_under_freq ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>
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
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                        O=Over (&gt;5), E=Equal (=5), U=Under (&lt;5)
                    </div>

                    {/* Digit Histogram */}
                    <div className="digit-histogram">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(40, Math.round((count / maxFreqCount) * 40));
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
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--matches">👑</div>
                            <h3>Matches/Differs</h3>
                        </div>
                        <div className={`status-indicator ${activeEngines.matches_differs ? 'status-indicator--active' : ''}`}>
                            <span className="dot"></span>
                            <span>{activeEngines.matches_differs ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#f472b6', marginBottom: '8px' }}>
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

                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                        Barrier digit {params.matches_barrier} appears {matchesPct.toFixed(2)}% of the time
                    </div>

                    {/* Digit Histogram */}
                    <div className="digit-histogram">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(40, Math.round((count / maxFreqCount) * 40));
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
