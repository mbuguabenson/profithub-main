/**
 * MartingaleManager
 * Deterministic Martingale State Engine.
 * Guarantees:
 * 1. Exactly ONE increment per confirmed contract loss.
 * 2. Deduplicates incoming WebSocket loss events by contract ID.
 * 3. Prevents level skipping or runaway multiplier jumps.
 * 4. Resets to base stake cleanly on Win or manual reset.
 */

export interface MartingaleState {
    initialStake: number;
    currentStake: number;
    multiplier: number;
    consecutiveLosses: number;
    maxLosses: number;
    maxStakeCap: number | null;
}

class MartingaleManager {
    private static instance: MartingaleManager;

    private initialStake = 0.35;
    private currentStake = 0.35;
    private multiplier = 2.0;
    private consecutiveLosses = 0;
    private maxLosses = 10;
    private maxStakeCap: number | null = null;
    private processedContractIds: Set<string> = new Set();

    private constructor() {}

    public static getInstance(): MartingaleManager {
        if (!MartingaleManager.instance) {
            MartingaleManager.instance = new MartingaleManager();
        }
        return MartingaleManager.instance;
    }

    /**
     * Initializes Martingale settings when a bot session begins.
     */
    public initialize(initialStake: number, multiplier = 2.0, maxLosses = 10, maxStakeCap: number | null = null): void {
        this.initialStake = Math.max(0.35, Number(initialStake) || 0.35);
        this.currentStake = this.initialStake;
        this.multiplier = Math.max(1.0, Number(multiplier) || 2.0);
        this.consecutiveLosses = 0;
        this.maxLosses = maxLosses;
        this.maxStakeCap = maxStakeCap;
        this.processedContractIds.clear();
        console.log(`[MartingaleManager] Initialized: Base Stake $${this.initialStake}, Multiplier x${this.multiplier}`);
    }

    /**
     * Processes a completed contract result deterministically.
     * @param contractId Unique Deriv contract ID
     * @param isWin Boolean indicating if contract resulted in profit
     * @returns number The next stake amount to place on the subsequent trade
     */
    public processContractResult(contractId: string, isWin: boolean): number {
        const id = String(contractId || '');
        if (id && this.processedContractIds.has(id)) {
            console.warn(`[MartingaleManager] Deduplicated result for contract ${id}. Returning current stake $${this.currentStake}`);
            return this.currentStake;
        }

        if (id) {
            this.processedContractIds.add(id);
            if (this.processedContractIds.size > 100) {
                const first = this.processedContractIds.values().next().value;
                if (first) this.processedContractIds.delete(first);
            }
        }

        if (isWin) {
            console.log(`[MartingaleManager] WIN on contract ${id}. Resetting stake to base $${this.initialStake}`);
            this.consecutiveLosses = 0;
            this.currentStake = this.initialStake;
        } else {
            this.consecutiveLosses++;
            const rawNextStake = this.currentStake * this.multiplier;
            let nextStake = Number(rawNextStake.toFixed(2));

            if (this.maxStakeCap && nextStake > this.maxStakeCap) {
                console.warn(`[MartingaleManager] Stake $${nextStake} hit cap of $${this.maxStakeCap}. Resetting to initial stake.`);
                nextStake = this.initialStake;
                this.consecutiveLosses = 0;
            }

            this.currentStake = nextStake;
            console.log(`[MartingaleManager] LOSS #${this.consecutiveLosses} on contract ${id}. Next stake: $${this.currentStake}`);
        }

        return this.currentStake;
    }

    /**
     * Gets the current required stake for the next trade.
     */
    public getCurrentStake(): number {
        return this.currentStake;
    }

    /**
     * Resets Martingale back to base stake.
     */
    public reset(): void {
        this.currentStake = this.initialStake;
        this.consecutiveLosses = 0;
        this.processedContractIds.clear();
        console.log(`[MartingaleManager] Reset back to base stake $${this.initialStake}`);
    }

    public getState(): MartingaleState {
        return {
            initialStake: this.initialStake,
            currentStake: this.currentStake,
            multiplier: this.multiplier,
            consecutiveLosses: this.consecutiveLosses,
            maxLosses: this.maxLosses,
            maxStakeCap: this.maxStakeCap,
        };
    }
}

export const martingaleManager = MartingaleManager.getInstance();
