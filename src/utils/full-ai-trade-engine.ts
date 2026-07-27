/**
 * FullAiTradeEngine
 * ─────────────────
 * Directly executes trades via the Deriv WebSocket API without any Blockly
 * dependency.  It reads live signals from ScannerStore, applies martingale,
 * enforces take-profit / stop-loss, and autonomously:
 *   • Auto-pauses  when signal confidence drops below threshold
 *   • Auto-resumes when confidence recovers
 *   • Auto-switches market when current market weakens
 *   • Auto-rotates strategy on the same market when needed
 */

import { api_base } from '@/external/bot-skeleton';
import { buyContractForUi } from '@/utils/trade-purchase';

// ─── Contract Type Maps ────────────────────────────────────────────────────────
const STRATEGY_TO_CONTRACT: Record<string, { contract_type: string; prediction?: number }> = {
    even_odd:    { contract_type: 'DIGITEVEN' },
    over_under:  { contract_type: 'DIGITOVER',  prediction: 2 },
    differs:     { contract_type: 'DIGITDIFF',  prediction: 5 },
    matches:     { contract_type: 'DIGITMATCH', prediction: 5 },
    rise_fall:   { contract_type: 'CALL' },
    pro_even_odd:   { contract_type: 'DIGITODD' },
    pro_over_under: { contract_type: 'DIGITUNDER', prediction: 7 },
    pro_differs:    { contract_type: 'DIGITDIFF', prediction: 4 },
    under_7:    { contract_type: 'DIGITUNDER', prediction: 7 },
    over_2:     { contract_type: 'DIGITOVER',  prediction: 2 },
    super:      { contract_type: 'DIGITEVEN' },
};

const DURATION_UNIT = 't'; // ticks
const TICKS = 1;

export type EngineConfig = {
    stake: number;
    martingaleMultiplier: number;
    takeProfit: number;   // USD absolute
    stopLoss: number;     // max consecutive losses
    autoPauseThreshold: number;   // 0-1
    autoResumeThreshold: number;  // 0-1
    autoMarketSwitch: boolean;
    autoStrategyRotate: boolean;
};

type EngineCallbacks = {
    onLog: (msg: string) => void;
    onTrade: (result: 'WIN' | 'LOSS', profit: number, stake: number) => void;
    onStatusChange: (status: string) => void;
    getSignals: () => any[];
    getCurrentSignal: () => any | null;
    getBestMarket: () => string | null;
    getBestStrategy: (market: string) => string | null;
    switchMarket: (market: string, signal: any) => void;
    switchStrategy: (strategy: string, signal: any) => void;
};

export class FullAiTradeEngine {
    private running = false;
    private paused = false;
    private abortController: AbortController | null = null;
    private consecutiveLosses = 0;
    private totalProfit = 0;
    private currentStake: number;
    private config: EngineConfig;
    private cb: EngineCallbacks;
    private market = 'R_100';
    private strategy = 'even_odd';
    private switchCooldownUntil = 0;

    constructor(config: EngineConfig, callbacks: EngineCallbacks) {
        this.config = config;
        this.cb = callbacks;
        this.currentStake = config.stake;
    }

    updateConfig(config: Partial<EngineConfig>) {
        this.config = { ...this.config, ...config };
    }

    isRunning() { return this.running; }
    isPaused()  { return this.paused;  }

    start(market: string, strategy: string) {
        if (this.running) return;
        this.running = true;
        this.paused = false;
        this.market = market;
        this.strategy = strategy;
        this.currentStake = this.config.stake;
        this.consecutiveLosses = 0;
        this.totalProfit = 0;
        this.abortController = new AbortController();
        this.cb.onLog(`🚀 Engine started — Market: ${market} | Strategy: ${strategy}`);
        this.cb.onStatusChange('trading');
        this._runLoop(this.abortController.signal);
    }

    stop() {
        this.running = false;
        this.paused = false;
        this.abortController?.abort();
        this.abortController = null;
        this.cb.onLog('⏹ Engine stopped.');
        this.cb.onStatusChange('idle');
    }

    pause() {
        if (!this.running || this.paused) return;
        this.paused = true;
        this.cb.onLog(`⏸ Engine auto-paused.`);
        this.cb.onStatusChange('paused');
    }

    resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        this.cb.onLog(`▶ Engine auto-resumed.`);
        this.cb.onStatusChange('trading');
    }

    private async _runLoop(signal: AbortSignal) {
        while (this.running && !signal.aborted) {
            // ── Wait while paused ──────────────────────────────────────────
            while (this.paused && this.running && !signal.aborted) {
                await this._sleep(500);
            }
            if (!this.running || signal.aborted) break;

            // ── Read current signal confidence ─────────────────────────────
            const currentSig = this.cb.getCurrentSignal();
            const confidence = currentSig?.confidence ?? 0;

            // ── Auto-pause check ───────────────────────────────────────────
            if (confidence < this.config.autoPauseThreshold) {
                this.cb.onLog(`⚠️ Confidence dropped to ${(confidence * 100).toFixed(0)}% (threshold: ${(this.config.autoPauseThreshold * 100).toFixed(0)}%)`);
                const now = Date.now();

                // Try auto-switch market
                if (this.config.autoMarketSwitch && now > this.switchCooldownUntil) {
                    const bestMarket = this.cb.getBestMarket();
                    if (bestMarket && bestMarket !== this.market) {
                        this.switchCooldownUntil = now + 15000;
                        const bestSig = this.cb.getSignals().find((s: any) => s.symbol === bestMarket);
                        this.market = bestMarket;
                        this.strategy = bestSig?.strategy ?? this.strategy;
                        this.cb.switchMarket(bestMarket, bestSig);
                        this.cb.onLog(`🔄 Switched market → ${bestMarket} | Strategy: ${this.strategy}`);
                        this.cb.onStatusChange('switching_market');
                        await this._sleep(2000);
                        this.cb.onStatusChange('trading');
                        continue;
                    }

                    // Try auto-rotate strategy
                    if (this.config.autoStrategyRotate) {
                        const bestStrategy = this.cb.getBestStrategy(this.market);
                        if (bestStrategy && bestStrategy !== this.strategy) {
                            this.switchCooldownUntil = now + 10000;
                            const bestSig = this.cb.getSignals().find((s: any) => s.symbol === this.market && s.strategy === bestStrategy);
                            this.strategy = bestStrategy;
                            this.cb.switchStrategy(bestStrategy, bestSig);
                            this.cb.onLog(`🔀 Rotated strategy → ${bestStrategy} on ${this.market}`);
                            this.cb.onStatusChange('switching_strategy');
                            await this._sleep(1500);
                            this.cb.onStatusChange('trading');
                            continue;
                        }
                    }
                }

                // Pause and wait for signal recovery
                this.pause();
                await this._sleep(3000);
                continue;
            }

            // ── Auto-resume check ──────────────────────────────────────────
            if (this.paused && confidence >= this.config.autoResumeThreshold) {
                this.resume();
            }

            if (this.paused) {
                await this._sleep(500);
                continue;
            }

            // ── Execute single trade ───────────────────────────────────────
            try {
                const result = await this._executeTrade(currentSig, signal);
                if (!result) break;
            } catch (e: any) {
                this.cb.onLog(`❌ Trade error: ${e?.message ?? 'Unknown error'}`);
                await this._sleep(2000);
            }

            // ── TP / SL check ──────────────────────────────────────────────
            if (this.totalProfit >= this.config.takeProfit) {
                this.cb.onLog(`🎯 Take Profit reached: +$${this.totalProfit.toFixed(2)}. Stopping engine.`);
                this.stop();
                break;
            }
            if (this.consecutiveLosses >= this.config.stopLoss) {
                this.cb.onLog(`🛑 Stop Loss reached: ${this.consecutiveLosses} consecutive losses. Stopping.`);
                this.stop();
                break;
            }

            // Small delay between trades
            await this._sleep(800);
        }
    }

    private async _executeTrade(signal: any, abortSignal: AbortSignal): Promise<boolean> {
        if (!api_base.is_authorized) {
            this.cb.onLog('⚠️ Not authorized. Waiting for login...');
            await this._sleep(3000);
            return true;
        }

        const strat = (signal?.strategy ?? this.strategy) as string;
        const symbol = signal?.symbol ?? this.market;
        const contractDef = STRATEGY_TO_CONTRACT[strat] ?? STRATEGY_TO_CONTRACT['even_odd'];

        // Compute prediction from signal details if available
        let prediction = contractDef.prediction;
        if (signal?.details?.targetDigit !== undefined) {
            prediction = signal.details.targetDigit;
        }

        const parameters: Record<string, any> = {
            amount: this.currentStake,
            basis: 'stake',
            contract_type: contractDef.contract_type,
            currency: this._getCurrency(),
            duration: TICKS,
            duration_unit: DURATION_UNIT,
            symbol,
        };

        if (prediction !== undefined) {
            parameters.barrier = prediction.toString();
        }

        this.cb.onLog(`📤 Trade: ${contractDef.contract_type} | ${symbol} | Stake: $${this.currentStake.toFixed(2)}${prediction !== undefined ? ` | Barrier: ${prediction}` : ''}`);

        let buy: any;
        try {
            buy = await buyContractForUi({ parameters, price: this.currentStake, source: 'FullAiEngine' });
        } catch (e: any) {
            if (abortSignal.aborted) return false;
            this.cb.onLog(`❌ Buy failed: ${e?.message}`);
            await this._sleep(1000);
            return true;
        }

        if (abortSignal.aborted) return false;

        // ── Wait for contract settlement ───────────────────────────────────
        const contractId = buy?.contract_id;
        if (!contractId) {
            this.cb.onLog('⚠️ No contract ID in buy response.');
            return true;
        }

        const settled = await this._waitForSettlement(contractId, abortSignal);
        if (!settled || abortSignal.aborted) return false;

        const profit = Number(settled.profit ?? 0);
        const isWin = profit > 0;

        if (isWin) {
            this.consecutiveLosses = 0;
            this.currentStake = this.config.stake; // Reset stake on win
            this.totalProfit += profit;
            this.cb.onLog(`✅ WIN +$${profit.toFixed(2)} | Total P/L: ${this.totalProfit >= 0 ? '+' : ''}$${this.totalProfit.toFixed(2)}`);
            this.cb.onTrade('WIN', profit, this.currentStake);
        } else {
            this.consecutiveLosses++;
            this.totalProfit += profit; // profit is negative on loss
            this.cb.onLog(`❌ LOSS $${profit.toFixed(2)} (${this.consecutiveLosses} consecutive) | Total P/L: ${this.totalProfit >= 0 ? '+' : ''}$${this.totalProfit.toFixed(2)}`);
            this.cb.onTrade('LOSS', profit, this.currentStake);
            // Apply martingale
            this.currentStake = Math.min(
                this.currentStake * this.config.martingaleMultiplier,
                this.config.stake * 50 // cap at 50x initial
            );
            this.cb.onLog(`📈 Martingale: next stake → $${this.currentStake.toFixed(2)}`);
        }

        return true;
    }

    private async _waitForSettlement(contractId: number, abortSignal: AbortSignal): Promise<any> {
        const maxWait = 90000;
        const start = Date.now();
        const pollMs = 600;

        while (!abortSignal.aborted && Date.now() - start < maxWait) {
            try {
                const resp = await (api_base.api as any).send({
                    proposal_open_contract: 1,
                    contract_id: contractId,
                });
                const c = resp?.proposal_open_contract;
                if (c?.is_sold || c?.status === 'sold' || c?.status === 'won' || c?.status === 'lost') {
                    return c;
                }
            } catch (e) {
                // ignore transient errors
            }
            await this._sleep(pollMs);
        }
        return null;
    }

    private _getCurrency(): string {
        try {
            const raw = localStorage.getItem('accountsList');
            const loginid = localStorage.getItem('active_loginid');
            if (raw && loginid) {
                const list = JSON.parse(raw);
                return list?.[loginid]?.currency ?? 'USD';
            }
        } catch { /* ignore */ }
        return 'USD';
    }

    private _sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
