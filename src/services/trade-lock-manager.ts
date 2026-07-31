/**
 * TradeLockManager
 * Enterprise-grade Mutex Lock and Signal Deduplication Manager.
 * Ensures:
 * 1. Exactly ONE trade is executed per strategy signal UUID.
 * 2. Only ONE trade is active at any given time unless explicit parallel trading is enabled.
 */

export interface TradeLockState {
    isTradeLocked: boolean;
    activeContractId: string | null;
    activeSignalId: string | null;
    lastExecutedTime: number;
}

class TradeLockManager {
    private static instance: TradeLockManager;
    private isLocked = false;
    private activeContractId: string | null = null;
    private activeSignalId: string | null = null;
    private executedSignalUUIDs: Set<string> = new Set();
    private lastExecutedTimestamp = 0;

    private constructor() {}

    public static getInstance(): TradeLockManager {
        if (!TradeLockManager.instance) {
            TradeLockManager.instance = new TradeLockManager();
        }
        return TradeLockManager.instance;
    }

    /**
     * Attempts to acquire the mutex lock for a trade execution.
     * @param signalId Optional unique identifier for the trade signal.
     * @returns boolean - true if lock acquired successfully, false if locked or duplicate signal.
     */
    public acquireLock(signalId?: string): boolean {
        if (this.isLocked) {
            console.warn('[TradeLockManager] Acquire rejected: Mutex is currently LOCKED by active trade.');
            return false;
        }

        if (signalId) {
            if (this.executedSignalUUIDs.has(signalId)) {
                console.warn(`[TradeLockManager] Acquire rejected: Signal UUID ${signalId} was already executed.`);
                return false;
            }
            this.executedSignalUUIDs.add(signalId);
            this.activeSignalId = signalId;

            // Keep cache size bounded (max 500 signals)
            if (this.executedSignalUUIDs.size > 500) {
                const firstItem = this.executedSignalUUIDs.values().next().value;
                if (firstItem) this.executedSignalUUIDs.delete(firstItem);
            }
        }

        this.isLocked = true;
        this.lastExecutedTimestamp = Date.now();
        console.log(`[TradeLockManager] Mutex Lock ACQUIRED. Signal: ${signalId || 'N/A'}`);
        return true;
    }

    /**
     * Releases the mutex lock.
     * @param contractId Optional contract ID that was completed.
     */
    public releaseLock(contractId?: string): void {
        this.isLocked = false;
        this.activeContractId = null;
        this.activeSignalId = null;
        console.log(`[TradeLockManager] Mutex Lock RELEASED. Completed Contract: ${contractId || 'N/A'}`);
    }

    /**
     * Checks if a trade is currently in progress.
     */
    public isTradeInProgress(): boolean {
        return this.isLocked;
    }

    /**
     * Sets active contract ID once purchase is confirmed by WebSocket API.
     */
    public setActiveContract(contractId: string): void {
        this.activeContractId = contractId;
    }

    /**
     * Checks if a signal UUID has already been executed.
     */
    public hasSignalBeenExecuted(signalId: string): boolean {
        return this.executedSignalUUIDs.has(signalId);
    }

    /**
     * Clears all locks and signal tracking upon engine stop or reset.
     */
    public reset(): void {
        this.isLocked = false;
        this.activeContractId = null;
        this.activeSignalId = null;
        this.executedSignalUUIDs.clear();
        this.lastExecutedTimestamp = 0;
        console.log('[TradeLockManager] State cleanly RESET.');
    }

    public getState(): TradeLockState {
        return {
            isTradeLocked: this.isLocked,
            activeContractId: this.activeContractId,
            activeSignalId: this.activeSignalId,
            lastExecutedTime: this.lastExecutedTimestamp,
        };
    }
}

export const tradeLockManager = TradeLockManager.getInstance();
