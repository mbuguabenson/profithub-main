/**
 * TradeQueueWorker
 * Centralized FIFO Trade Queue Worker.
 * Serializes strategy execution requests so that signals execute sequentially:
 * Signal -> Queue -> Worker -> Acquire Mutex -> Execute -> Await Settlement -> Release Mutex -> Next Signal.
 */

import { tradeLockManager } from './trade-lock-manager';

export interface TradeTask {
    id: string;
    symbol: string;
    contractType: string;
    stake: number;
    executeFn: () => Promise<any>;
    timestamp: number;
}

class TradeQueueWorker {
    private static instance: TradeQueueWorker;
    private queue: TradeTask[] = [];
    private isProcessing = false;

    private constructor() {}

    public static getInstance(): TradeQueueWorker {
        if (!TradeQueueWorker.instance) {
            TradeQueueWorker.instance = new TradeQueueWorker();
        }
        return TradeQueueWorker.instance;
    }

    /**
     * Enqueues a trade execution task.
     */
    public enqueue(task: TradeTask): boolean {
        if (tradeLockManager.hasSignalBeenExecuted(task.id)) {
            console.warn(`[TradeQueueWorker] Signal ${task.id} already executed or queued. Rejecting duplicate.`);
            return false;
        }

        this.queue.push(task);
        console.log(`[TradeQueueWorker] Enqueued signal ${task.id} (${task.contractType} on ${task.symbol}). Queue size: ${this.queue.length}`);
        this.processNext();
        return true;
    }

    /**
     * Processes the next task in the FIFO queue.
     */
    private async processNext(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        if (tradeLockManager.isTradeInProgress()) {
            console.log('[TradeQueueWorker] Trade currently in progress. Waiting for active contract to finish...');
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();

        if (!task) {
            this.isProcessing = false;
            return;
        }

        const lockAcquired = tradeLockManager.acquireLock(task.id);
        if (!lockAcquired) {
            console.warn(`[TradeQueueWorker] Could not acquire Mutex Lock for task ${task.id}. Skipping.`);
            this.isProcessing = false;
            this.processNext();
            return;
        }

        try {
            console.log(`[TradeQueueWorker] Executing trade task ${task.id}...`);
            await task.executeFn();
        } catch (error) {
            console.error(`[TradeQueueWorker] Execution error for task ${task.id}:`, error);
            tradeLockManager.releaseLock();
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Called when a contract finishes to trigger the next queued trade.
     */
    public onContractCompleted(contractId?: string): void {
        tradeLockManager.releaseLock(contractId);
        this.isProcessing = false;
        this.processNext();
    }

    /**
     * Clears all pending tasks in the queue upon STOP.
     */
    public clear(): void {
        this.queue = [];
        this.isProcessing = false;
        tradeLockManager.reset();
        console.log('[TradeQueueWorker] Queue cleared.');
    }

    public getQueueLength(): number {
        return this.queue.length;
    }
}

export const tradeQueueWorker = TradeQueueWorker.getInstance();
