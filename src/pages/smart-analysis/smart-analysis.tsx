import React, { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { getAppId, getSocketURL } from '@/components/shared/utils/config/config';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
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

export interface SmartTradeRecord {
    id: string;
    contractId: string | number;
    engineName: string;
    tradeType: string;
    symbol: string;
    stake: number;
    barrier?: number | string;
    entrySpot?: number | string;
    exitSpot?: number | string;
    pnl: number;
    status: 'WON' | 'LOST' | 'PENDING';
    timestamp: string;
}

export const SmartAnalysisPage: React.FC = observer(() => {
    // MobX Store for Platform Run Panel Drawer Integration
    const { transactions, run_panel, summary_card } = useStore();

    // Theme Mode ('dark' | 'light')
    const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

    // Top Bar & Controls State
    const [selectedSymbol, setSelectedSymbol] = useState<string>('R_10');
    const [ticksCountLimit, setTicksCountLimit] = useState<number>(120);
    const [currentPrice, setCurrentPrice] = useState<number | null>(4940.53);
    const [priceFlashClass, setPriceFlashClass] = useState<string>('');
    const [ticksBuffer, setTicksBuffer] = useState<number[]>([]);
    const [lastDigitsBuffer, setLastDigitsBuffer] = useState<number[]>([]);

    // Local Run Panel Drawer Transaction Log
    const [tradeRecords, setTradeRecords] = useState<SmartTradeRecord[]>([]);
    const [totalProfitLoss, setTotalProfitLoss] = useState<number>(0);
    const [totalWins, setTotalWins] = useState<number>(0);
    const [totalLosses, setTotalLosses] = useState<number>(0);

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

    // Current Stake States for Martingale Tracking
    const [currentStakes, setCurrentStakes] = useState({
        rise_fall: 0.5,
        even_odd_prob: 0.5,
        even_odd_streak: 0.5,
        over_under_rec: 0.5,
        over_under_freq: 0.5,
        matches_differs: 0.5,
    });

    // Pending Order Execution Lock per Engine
    const isTradeInFlightRef = useRef<Record<string, boolean>>({});

    // Engine Parameters
    const [params, setParams] = useState({
        // Card 1: Rise/Fall
        rise_prob_threshold: 65,
        rise_last_n_ticks: 3,
        rise_tick_condition: 'Rising',
        rise_stake: 0.5,
        rise_ticks: 1,
        rise_martingale: 2,

        // Card 2: Even/Odd Prob
        even_prob_threshold: 60,
        even_last_n_ticks: 3,
        even_tick_condition: 'Even',
        even_stake: 0.5,
        even_ticks: 1,
        even_martingale: 2,

        // Card 3: Even/Odd Streak
        streak_last_n_digits: 3,
        streak_digit_target: 'Even',
        streak_stake: 0.5,
        streak_ticks: 1,
        streak_martingale: 2,

        // Card 4: Over/Under Rec
        rec_barrier: 5,
        rec_prob_threshold: 55,
        rec_last_n_ticks: 3,
        rec_stake: 0.5,
        rec_ticks: 1,
        rec_martingale: 2,

        // Card 5: Over/Under Freq
        freq_last_n_digits: 3,
        freq_barrier: 5,
        freq_target_condition: 'Over',
        freq_stake: 0.5,
        freq_ticks: 1,
        freq_martingale: 2,

        // Card 6: Matches/Differs
        matches_barrier: 5,
        matches_prob_threshold: 55,
        matches_stake: 0.5,
        matches_ticks: 1,
        matches_martingale: 2,
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

            let wsUrl = await getSocketURL();
            if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
                wsUrl = `wss://${wsUrl}/websockets/v3?app_id=${getAppId()}`;
            }
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

    // Analytics Calculations
    const totalTicks = ticksBuffer.length;

    // 1. Rise/Fall Pct
    let riseCount = 0;
    let fallCount = 0;
    for (let i = 1; i < ticksBuffer.length; i++) {
        if (ticksBuffer[i] > ticksBuffer[i - 1]) riseCount++;
        else if (ticksBuffer[i] < ticksBuffer[i - 1]) fallCount++;
    }
    const rfTotal = Math.max(1, riseCount + fallCount);
    const risePct = (riseCount / rfTotal) * 100;
    const fallPct = (fallCount / rfTotal) * 100;

    // 2. Even/Odd Pct & Streak
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

    // 3. Over/Under Pct
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

    // 4. Digit Frequency Histogram
    const digitCounts = new Array(10).fill(0);
    lastDigitsBuffer.forEach((d) => {
        if (d >= 0 && d <= 9) digitCounts[d]++;
    });
    const maxFreqCount = Math.max(1, Math.max(...digitCounts));
    const mostFreqDigit = digitCounts.indexOf(Math.max(...digitCounts));
    const mostFreqPct = ((digitCounts[mostFreqDigit] || 0) / Math.max(1, totalTicks)) * 100;

    // Matches / Differs
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

    // Execute Deriv Trade Contract Order with Settlement Streaming & Run Panel Dispatch
    const executeTradeOrder = async (
        engineKey: string,
        engineName: string,
        tradeType: string,
        baseStake: number,
        durationTicks: number,
        martingaleMultiplier: number,
        barrierDigit?: number
    ) => {
        if (isTradeInFlightRef.current[engineKey]) return;
        if (!api_base.api) {
            console.warn('[SmartAnalysis] Deriv API not connected');
            return;
        }

        isTradeInFlightRef.current[engineKey] = true;
        const currentStakeAmount = currentStakes[engineKey as keyof typeof currentStakes] || baseStake;

        try {
            const req: any = {
                proposal: 1,
                amount: currentStakeAmount,
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

                if (buyRes?.buy?.contract_id) {
                    const contractId = buyRes.buy.contract_id;
                    const timestampStr = new Date().toLocaleTimeString();

                    // 1. Initial Pending Record
                    const initialRecord: SmartTradeRecord = {
                        id: String(contractId),
                        contractId,
                        engineName,
                        tradeType,
                        symbol: selectedSymbol,
                        stake: currentStakeAmount,
                        barrier: barrierDigit,
                        pnl: 0,
                        status: 'PENDING',
                        timestamp: timestampStr,
                    };

                    setTradeRecords((prev) => [initialRecord, ...prev]);

                    // Dispatch Contract Start Event to Platform Run Panel Drawer
                    const initialContractData = {
                        contract_id: contractId,
                        transaction_ids: { buy: buyRes.buy.transaction_id },
                        contract_type: tradeType,
                        currency: (api_base.account_info as any)?.currency || 'USD',
                        buy_price: currentStakeAmount,
                        display_name: selectedSymbol,
                        symbol: selectedSymbol,
                        status: 'open',
                    };

                    try {
                        transactions.pushTransaction({ ...(initialContractData as any), run_id: run_panel.run_id });
                        run_panel.onBotContractEvent(initialContractData as any);
                        summary_card.onBotContractEvent(initialContractData as any);
                    } catch (e) {
                        console.warn('[SmartAnalysis] Run panel push warning:', e);
                    }

                    // 2. Subscribe to Proposal Open Contract to stream settlement
                    const subRes = await api_base.api.send({
                        proposal_open_contract: 1,
                        contract_id: contractId,
                        subscribe: 1,
                    });

                    const subId = subRes?.subscription?.id;

                    const handlePocMessage = (e: MessageEvent) => {
                        try {
                            const msg = JSON.parse(e.data);
                            if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
                                const poc = msg.proposal_open_contract;
                                if (poc.contract_id === contractId && poc.is_sold === 1) {
                                    const profit = Number(poc.profit || 0);
                                    const isWin = profit > 0;
                                    const statusStr: 'WON' | 'LOST' = isWin ? 'WON' : 'LOST';

                                    // Update Local Log Record
                                    setTradeRecords((prev) =>
                                        prev.map((rec) =>
                                            rec.contractId === contractId
                                                ? {
                                                      ...rec,
                                                      pnl: profit,
                                                      status: statusStr,
                                                      entrySpot: poc.entry_spot,
                                                      exitSpot: poc.exit_spot,
                                                  }
                                                : rec
                                        )
                                    );

                                    // Update Cumulative Summary Stats
                                    setTotalProfitLoss((prev) => prev + profit);
                                    if (isWin) setTotalWins((prev) => prev + 1);
                                    else setTotalLosses((prev) => prev + 1);

                                    // Martingale Stake Calculation
                                    setCurrentStakes((prev) => ({
                                        ...prev,
                                        [engineKey]: isWin ? baseStake : currentStakeAmount * martingaleMultiplier,
                                    }));

                                    // Dispatch Contract Settlement Event to Platform Run Panel Drawer
                                    const finalContractData = {
                                        contract_id: contractId,
                                        transaction_ids: { buy: buyRes.buy.transaction_id, sell: poc.transaction_id },
                                        contract_type: tradeType,
                                        currency: (api_base.account_info as any)?.currency || 'USD',
                                        buy_price: currentStakeAmount,
                                        sell_price: Number(poc.sell_price || 0),
                                        profit,
                                        status: isWin ? 'won' : 'lost',
                                        is_sold: 1,
                                    };

                                    try {
                                        transactions.pushTransaction({ ...(finalContractData as any), run_id: run_panel.run_id });
                                        run_panel.onBotContractEvent(finalContractData as any);
                                        summary_card.onBotContractEvent(finalContractData as any);
                                    } catch (err) {
                                        console.warn('[SmartAnalysis] Final run panel push warning:', err);
                                    }

                                    // Unsubscribe POC WS
                                    if (subId && api_base.api) {
                                        api_base.api.send({ forget: subId }).catch(() => {});
                                    }
                                    if (wsRef.current) {
                                        wsRef.current.removeEventListener('message', handlePocMessage);
                                    }

                                    isTradeInFlightRef.current[engineKey] = false;
                                }
                            }
                        } catch (err) {
                            console.warn('[SmartAnalysis] POC parse error:', err);
                        }
                    };

                    if (wsRef.current) {
                        wsRef.current.addEventListener('message', handlePocMessage);
                    }
                }
            }
        } catch (err) {
            console.error('[SmartAnalysis Engine] Trade execution error:', err);
            isTradeInFlightRef.current[engineKey] = false;
        }
    };

    // Real-Time Strategy Evaluation Loop
    useEffect(() => {
        if (ticksBuffer.length < 5) return;

        // 1. Rise/Fall Card
        if (activeEngines.rise_fall) {
            if (risePct >= params.rise_prob_threshold) {
                executeTradeOrder(
                    'rise_fall',
                    'Rise/Fall Engine',
                    'CALL',
                    params.rise_stake,
                    params.rise_ticks,
                    params.rise_martingale
                );
            }
        }

        // 2. Even/Odd Prob Card
        if (activeEngines.even_odd_prob) {
            if (evenPct >= params.even_prob_threshold) {
                executeTradeOrder(
                    'even_odd_prob',
                    'Even/Odd Prob Engine',
                    'DIGITEVEN',
                    params.even_stake,
                    params.even_ticks,
                    params.even_martingale
                );
            } else if (oddPct >= params.even_prob_threshold) {
                executeTradeOrder(
                    'even_odd_prob',
                    'Even/Odd Prob Engine',
                    'DIGITODD',
                    params.even_stake,
                    params.even_ticks,
                    params.even_martingale
                );
            }
        }

        // 3. Even/Odd Streak Card
        if (activeEngines.even_odd_streak) {
            if (currentStreakCount >= params.streak_last_n_digits) {
                const typeToBuy = currentStreakType === 'Even' ? 'DIGITEVEN' : 'DIGITODD';
                executeTradeOrder(
                    'even_odd_streak',
                    'Even/Odd Streak Engine',
                    typeToBuy,
                    params.streak_stake,
                    params.streak_ticks,
                    params.streak_martingale
                );
            }
        }

        // 4. Over/Under Rec Card
        if (activeEngines.over_under_rec) {
            if (recProb >= params.rec_prob_threshold) {
                const typeToBuy = recRecommendation === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER';
                executeTradeOrder(
                    'over_under_rec',
                    'Over/Under Rec Engine',
                    typeToBuy,
                    params.rec_stake,
                    params.rec_ticks,
                    params.rec_martingale,
                    params.rec_barrier
                );
            }
        }

        // 5. Over/Under Freq Card
        if (activeEngines.over_under_freq) {
            const targetType = params.freq_target_condition === 'Over' ? 'DIGITOVER' : 'DIGITUNDER';
            executeTradeOrder(
                'over_under_freq',
                'Over/Under Freq Engine',
                targetType,
                params.freq_stake,
                params.freq_ticks,
                params.freq_martingale,
                params.freq_barrier
            );
        }

        // 6. Matches/Differs Card
        if (activeEngines.matches_differs) {
            if (matchesPct >= params.matches_prob_threshold) {
                executeTradeOrder(
                    'matches_differs',
                    'Matches/Differs Engine',
                    'DIGITMATCH',
                    params.matches_stake,
                    params.matches_ticks,
                    params.matches_martingale,
                    params.matches_barrier
                );
            }
        }
    }, [ticksBuffer, activeEngines]);

    return (
        <div className={`smart-analysis-container smart-analysis-container--${themeMode}`}>
            {/* Multi-Market Live Ticker Bar */}
            <div className="market-ticker-strip glass-panel">
                {TOP_TICKER_SYMBOLS.map((sym) => {
                    const q = marketQuotes[sym] || { price: 0, direction: 'up' };
                    const isActive = selectedSymbol === sym;
                    return (
                        <div
                            key={sym}
                            className={`ticker-item glass-sub ${isActive ? 'ticker-item--active' : ''}`}
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
            <div className="smart-analysis-header glass-panel">
                <div className="smart-analysis-header__title-area">
                    <span className="title-icon">📈</span>
                    <div>
                        <h2>Smart Analysis Engine</h2>
                        <span className="text-sub">Real-Time Market Tick-Stream & Strategy Scanner Suite</span>
                    </div>
                </div>

                <div className="smart-analysis-header__controls">
                    <div className="smart-analysis-header__group">
                        <label className="text-sub">Symbol</label>
                        <select
                            className="input-box"
                            value={selectedSymbol}
                            onChange={(e) => setSelectedSymbol(e.target.value)}
                        >
                            {SYMBOLS.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="smart-analysis-header__group">
                        <label className="text-sub">Ticks</label>
                        <input
                            type="number"
                            className="input-box"
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

                <div className="action-btns">
                    <button
                        className="smart-analysis-header__theme-toggle glass-sub"
                        onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                    >
                        {themeMode === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                    </button>

                    <button className="smart-analysis-header__reconnect-btn" onClick={handleReconnect}>
                        🔄 Reconnect Stream
                    </button>
                </div>
            </div>

            {/* Live Ticks Scrolling Ribbon */}
            <div className="ticks-ribbon glass-panel">
                <span className="ribbon-label text-sub">Tick Stream</span>
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

            {/* Live Run Panel Drawer / Transaction Log Table */}
            <div className="run-panel-drawer glass-panel">
                <div className="run-panel-drawer__header">
                    <div className="title">
                        <span>📜</span>
                        <h3>Run Panel Drawer Log</h3>
                    </div>

                    <div className="summary-chips">
                        <div className="chip chip--trades">
                            <span>Trades:</span>
                            <strong>{tradeRecords.length}</strong>
                        </div>

                        <div className="chip chip--profit">
                            <span>Wins:</span>
                            <strong>
                                {totalWins} ({tradeRecords.length > 0 ? ((totalWins / tradeRecords.length) * 100).toFixed(0) : 0}%)
                            </strong>
                        </div>

                        <div className="chip chip--loss">
                            <span>Losses:</span>
                            <strong>{totalLosses}</strong>
                        </div>

                        <div className={`chip ${totalProfitLoss >= 0 ? 'chip--profit' : 'chip--loss'}`}>
                            <span>PnL:</span>
                            <strong>
                                {totalProfitLoss >= 0 ? '+' : ''}
                                {totalProfitLoss.toFixed(2)} USD
                            </strong>
                        </div>
                    </div>
                </div>

                <div className="transactions-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Contract ID</th>
                                <th>Engine</th>
                                <th>Type</th>
                                <th>Stake</th>
                                <th>Entry Spot</th>
                                <th>Exit Spot</th>
                                <th>PnL</th>
                                <th>Status</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tradeRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                                        No active automated trades executed yet. Enable an engine below to start.
                                    </td>
                                </tr>
                            ) : (
                                tradeRecords.map((rec, i) => (
                                    <tr key={rec.id} className={i % 2 === 1 ? 'table-row-odd' : ''}>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{rec.contractId}</td>
                                        <td>{rec.engineName}</td>
                                        <td>
                                            <strong>{rec.tradeType}</strong>
                                        </td>
                                        <td>${rec.stake.toFixed(2)}</td>
                                        <td>{rec.entrySpot || '-'}</td>
                                        <td>{rec.exitSpot || '-'}</td>
                                        <td
                                            style={{
                                                fontWeight: 800,
                                                color: rec.pnl > 0 ? '#10b981' : rec.pnl < 0 ? '#ef4444' : 'inherit',
                                            }}
                                        >
                                            {rec.pnl > 0 ? `+$${rec.pnl.toFixed(2)}` : `$${rec.pnl.toFixed(2)}`}
                                        </td>
                                        <td>
                                            <span
                                                className={`status-badge ${
                                                    rec.status === 'WON'
                                                        ? 'status-badge--won'
                                                        : rec.status === 'LOST'
                                                        ? 'status-badge--lost'
                                                        : 'status-badge--pending'
                                                }`}
                                            >
                                                {rec.status === 'WON' ? '✓ WON' : rec.status === 'LOST' ? '✕ LOST' : '⏳ PENDING'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '11px', color: '#94a3b8' }}>{rec.timestamp}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grid of 6 Strategy Cards */}
            <div className="smart-analysis-grid">
                {/* 1. Rise / Fall Card */}
                <div className={`engine-card glass-panel ${activeEngines.rise_fall ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--risefall">📈</div>
                            <h3>Rise/Fall</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.rise_fall ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.rise_fall ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Rise</span>
                            <span>{risePct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${risePct}%`, background: '#10b981' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Fall</span>
                            <span>{fallPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${fallPct}%`, background: '#ef4444' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Rise Prob &gt;</span>
                            <input
                                type="number"
                                className="input-box"
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
                                className="input-box"
                                value={params.rise_last_n_ticks}
                                onChange={(e) => setParams({ ...params, rise_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks are</span>
                            <select
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.rise_fall}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, rise_fall: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.rise_ticks}
                                onChange={(e) => setParams({ ...params, rise_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
                <div className={`engine-card glass-panel ${activeEngines.even_odd_prob ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--evenodd">🔢</div>
                            <h3>Even/Odd</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.even_odd_prob ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.even_odd_prob ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div className="engine-card__stats">
                        <div className="stat-row">
                            <span>Even</span>
                            <span>{evenPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${evenPct}%`, background: '#3b82f6' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Odd</span>
                            <span>{oddPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${oddPct}%`, background: '#8b5cf6' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Even Prob &gt;</span>
                            <input
                                type="number"
                                className="input-box"
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
                                className="input-box"
                                value={params.even_last_n_ticks}
                                onChange={(e) => setParams({ ...params, even_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks are</span>
                            <select
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.even_odd_prob}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, even_odd_prob: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.even_ticks}
                                onChange={(e) => setParams({ ...params, even_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
                <div className={`engine-card glass-panel ${activeEngines.even_odd_streak ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--streak">🎯</div>
                            <h3>Even/Odd</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.even_odd_streak ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.even_odd_streak ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 800, marginBottom: '6px' }} className="text-sub">
                        LAST DIGITS PATTERN
                    </div>
                    <div className="digit-pattern-row">
                        {lastDigitsBuffer.slice(-10).map((d, i) => (
                            <span key={i} className={`digit-pill ${d % 2 === 0 ? 'digit-pill--even' : 'digit-pill--odd'}`}>
                                {d % 2 === 0 ? 'E' : 'O'}
                            </span>
                        ))}
                    </div>
                    <div style={{ fontSize: '11px', marginBottom: '8px' }} className="text-sub">
                        Recent digit pattern (E=Even, O=Odd)
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#3b82f6', marginBottom: '12px' }}>
                        Current streak: {currentStreakCount} {currentStreakType}
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span>Check if the last</span>
                            <input
                                type="number"
                                className="input-box"
                                value={params.streak_last_n_digits}
                                onChange={(e) => setParams({ ...params, streak_last_n_digits: Number(e.target.value) })}
                            />
                            <span>digits are</span>
                            <select
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.even_odd_streak}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, even_odd_streak: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.streak_ticks}
                                onChange={(e) => setParams({ ...params, streak_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
                <div className={`engine-card glass-panel ${activeEngines.over_under_rec ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--overunder">📊</div>
                            <h3>Over/Under</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.over_under_rec ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.over_under_rec ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700 }} className="text-sub">
                            Barrier
                        </span>
                        <input
                            type="number"
                            className="input-box"
                            style={{ width: '50px', padding: '4px 6px', textAlign: 'center' }}
                            value={params.rec_barrier}
                            onChange={(e) => setParams({ ...params, rec_barrier: Number(e.target.value) })}
                        />
                        <span style={{ fontSize: '11px' }} className="text-sub">
                            Under: 0-4, Equals: 5, Over: 6-9
                        </span>
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
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${overPct}%`, background: '#10b981' }}></div>
                        </div>

                        <div className="stat-row">
                            <span>Under</span>
                            <span>{underPct.toFixed(2)}%</span>
                        </div>
                        <div className="progress-bar-bg glass-sub">
                            <div className="progress-bar-fill" style={{ width: `${underPct}%`, background: '#f97316' }}></div>
                        </div>
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Over Prob &gt;</span>
                            <input
                                type="number"
                                className="input-box"
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
                                className="input-box"
                                value={params.rec_last_n_ticks}
                                onChange={(e) => setParams({ ...params, rec_last_n_ticks: Number(e.target.value) })}
                            />
                            <span>ticks Over</span>
                            <input
                                type="number"
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.over_under_rec}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, over_under_rec: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.rec_ticks}
                                onChange={(e) => setParams({ ...params, rec_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
                <div className={`engine-card glass-panel ${activeEngines.over_under_freq ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--overunder">⚡</div>
                            <h3>Over/Under</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.over_under_freq ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.over_under_freq ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', fontWeight: 800, marginBottom: '6px' }} className="text-sub">
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
                    <div style={{ fontSize: '11px', marginBottom: '8px' }} className="text-sub">
                        O=Over (&gt;5), E=Equal (=5), U=Under (&lt;5)
                    </div>

                    <div className="digit-histogram glass-sub">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(40, Math.round((count / maxFreqCount) * 40));
                            return (
                                <div key={d} className="histo-col">
                                    <span className="pct-val text-sub">{pct.toFixed(1)}%</span>
                                    <div className="bar-wrapper glass-panel">
                                        <div className="bar-fill" style={{ height: `${barH}px` }}></div>
                                    </div>
                                    <span className="digit-lbl">{d}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span>Check if the last</span>
                            <input
                                type="number"
                                className="input-box"
                                value={params.freq_last_n_digits}
                                onChange={(e) => setParams({ ...params, freq_last_n_digits: Number(e.target.value) })}
                            />
                            <span>digits are</span>
                            <select
                                className="input-box"
                                value={params.freq_target_condition}
                                onChange={(e) => setParams({ ...params, freq_target_condition: e.target.value })}
                            >
                                <option value="Over">Over</option>
                                <option value="Under">Under</option>
                            </select>
                            <input
                                type="number"
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.over_under_freq}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, over_under_freq: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.freq_ticks}
                                onChange={(e) => setParams({ ...params, freq_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
                <div className={`engine-card glass-panel ${activeEngines.matches_differs ? 'engine-card--running' : ''}`}>
                    <div className="engine-card__header">
                        <div className="badge-title">
                            <div className="badge-icon badge-icon--matches">👑</div>
                            <h3>Matches/Differs</h3>
                        </div>
                        <div
                            className={`status-indicator glass-sub ${
                                activeEngines.matches_differs ? 'status-indicator--active' : ''
                            }`}
                        >
                            <span className="dot"></span>
                            <span>{activeEngines.matches_differs ? 'Running' : 'Idle'}</span>
                        </div>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#ec4899', marginBottom: '8px' }}>
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
                        <div className="progress-bar-bg glass-sub">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${differsPct}%`, background: 'linear-gradient(90deg, #ec4899, #8b5cf6)' }}
                            ></div>
                        </div>
                    </div>

                    <div style={{ fontSize: '11px', marginBottom: '10px' }} className="text-sub">
                        Barrier digit {params.matches_barrier} appears {matchesPct.toFixed(2)}% of the time
                    </div>

                    <div className="digit-histogram glass-sub">
                        {digitCounts.map((count, d) => {
                            const pct = totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                            const barH = Math.min(40, Math.round((count / maxFreqCount) * 40));
                            return (
                                <div key={d} className="histo-col">
                                    <span className="pct-val text-sub">{pct.toFixed(1)}%</span>
                                    <div className="bar-wrapper glass-panel">
                                        <div className="bar-fill" style={{ height: `${barH}px` }}></div>
                                    </div>
                                    <span className="digit-lbl">{d}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="trading-condition-box glass-sub">
                        <div className="cond-row">
                            <span className="if-badge">If</span>
                            <span>Matches Prob for</span>
                            <input
                                type="number"
                                className="input-box"
                                value={params.matches_barrier}
                                onChange={(e) => setParams({ ...params, matches_barrier: Number(e.target.value) })}
                            />
                            <span>&gt;</span>
                            <input
                                type="number"
                                className="input-box"
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
                            <label className="text-sub">Stake</label>
                            <input
                                type="number"
                                step="0.1"
                                className="input-box"
                                value={currentStakes.matches_differs}
                                onChange={(e) =>
                                    setCurrentStakes((prev) => ({ ...prev, matches_differs: Number(e.target.value) }))
                                }
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Ticks</label>
                            <input
                                type="number"
                                className="input-box"
                                value={params.matches_ticks}
                                onChange={(e) => setParams({ ...params, matches_ticks: Number(e.target.value) })}
                            />
                        </div>
                        <div className="input-field">
                            <label className="text-sub">Martingale</label>
                            <input
                                type="number"
                                className="input-box"
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
});

export default SmartAnalysisPage;
