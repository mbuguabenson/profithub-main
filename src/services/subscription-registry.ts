/**
 * SubscriptionRegistry
 * Centralized registry for all active WebSocket subscriptions, Event Listeners,
 * Intervals, and Timeouts. Guarantees 100% leak-free cleanup upon engine STOP.
 */

type CleanUpHandler = () => void;

class SubscriptionRegistry {
    private static instance: SubscriptionRegistry;
    private webSocketSubscriptions: Map<string, CleanUpHandler> = new Map();
    private eventListeners: Map<string, CleanUpHandler> = new Map();
    private activeTimers: Set<NodeJS.Timeout | number> = new Set();
    private activeIntervals: Set<NodeJS.Timeout | number> = new Set();

    private constructor() {}

    public static getInstance(): SubscriptionRegistry {
        if (!SubscriptionRegistry.instance) {
            SubscriptionRegistry.instance = new SubscriptionRegistry();
        }
        return SubscriptionRegistry.instance;
    }

    /**
     * Registers a WebSocket subscription with a key. Unsubscribes previous key if present.
     */
    public registerSubscription(key: string, unsubscribeFn: CleanUpHandler): void {
        if (this.webSocketSubscriptions.has(key)) {
            try {
                this.webSocketSubscriptions.get(key)?.();
            } catch (err) {
                console.warn(`[SubscriptionRegistry] Error unsubscribing previous ${key}:`, err);
            }
        }
        this.webSocketSubscriptions.set(key, unsubscribeFn);
    }

    /**
     * Unsubscribes a specific registered subscription by key.
     */
    public unsubscribe(key: string): void {
        const handler = this.webSocketSubscriptions.get(key);
        if (handler) {
            try {
                handler();
            } catch (err) {
                console.warn(`[SubscriptionRegistry] Error unsubscribing ${key}:`, err);
            }
            this.webSocketSubscriptions.delete(key);
        }
    }

    /**
     * Registers a timeout for tracking.
     */
    public registerTimer(timer: NodeJS.Timeout | number): NodeJS.Timeout | number {
        this.activeTimers.add(timer);
        return timer;
    }

    /**
     * Clears a registered timer.
     */
    public clearTimer(timer: NodeJS.Timeout | number | undefined | null): void {
        if (!timer) return;
        clearTimeout(timer as any);
        this.activeTimers.delete(timer);
    }

    /**
     * Registers an interval for tracking.
     */
    public registerInterval(interval: NodeJS.Timeout | number): NodeJS.Timeout | number {
        this.activeIntervals.add(interval);
        return interval;
    }

    /**
     * Clears a registered interval.
     */
    public clearInterval(interval: NodeJS.Timeout | number | undefined | null): void {
        if (!interval) return;
        clearInterval(interval as any);
        this.activeIntervals.delete(interval);
    }

    /**
     * Purges and cleans up all registered subscriptions, timers, intervals, and event listeners.
     */
    public purgeAll(): void {
        // Clear all timers
        this.activeTimers.forEach(timer => {
            try {
                clearTimeout(timer as any);
            } catch {}
        });
        this.activeTimers.clear();

        // Clear all intervals
        this.activeIntervals.forEach(interval => {
            try {
                clearInterval(interval as any);
            } catch {}
        });
        this.activeIntervals.clear();

        // Unsubscribe all WebSockets
        this.webSocketSubscriptions.forEach((unsubscribeFn, key) => {
            try {
                unsubscribeFn();
            } catch (err) {
                console.warn(`[SubscriptionRegistry] Error during purge of ${key}:`, err);
            }
        });
        this.webSocketSubscriptions.clear();

        // Remove all event listeners
        this.eventListeners.forEach((cleanupFn, key) => {
            try {
                cleanupFn();
            } catch (err) {
                console.warn(`[SubscriptionRegistry] Error cleaning listener ${key}:`, err);
            }
        });
        this.eventListeners.clear();

        console.log('[SubscriptionRegistry] All subscriptions, timers, and listeners PURGED.');
    }
}

export const subscriptionRegistry = SubscriptionRegistry.getInstance();
