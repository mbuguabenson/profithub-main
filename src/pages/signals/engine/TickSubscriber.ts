import { SignalEngine, AnalysisResult, Signal } from './SignalEngine';
import { getSocketURL } from '@/components/shared/utils/config/config';

type EngineState = {
    analysis: AnalysisResult | null;
    standard: Signal[];
    pro: Signal[];
    super: Signal[];
};

export class TickSubscriber {
    private engine = new SignalEngine();
    private symbol: string = 'R_100';
    private callbacks: ((state: EngineState) => void)[] = [];
    private isStreaming = false;
    private ws: WebSocket | null = null;

    constructor() {}

    public subscribe(callback: (state: EngineState) => void) {
        this.callbacks.push(callback);
    }

    public unsubscribe(callback: (state: EngineState) => void) {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    }

    private emit() {
        const analysis = this.engine.analyze();
        if (analysis) {
            const standard = this.engine.generateStandardSignals(analysis);
            const pro = this.engine.generateProSignals(analysis);
            const superSignals = this.engine.generateSuperSignals(analysis, standard, pro);
            
            const state = { analysis, standard, pro, super: superSignals };
            this.callbacks.forEach(cb => cb(state));
        }
    }

    public async startStreaming(symbol: string = 'R_100') {
        if (this.isStreaming && this.symbol === symbol) return;
        
        this.stopStreaming();
        this.symbol = symbol;
        this.engine = new SignalEngine(); // Reset engine on new symbol
        this.isStreaming = true;

        try {
            const wsUrl = await getSocketURL();
            if (!this.isStreaming || this.symbol !== symbol) return;

            // Create direct WebSocket connection
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    // Subscribe to ticks history to get the last 100 ticks
                    this.ws.send(JSON.stringify({
                        ticks_history: this.symbol,
                        adjust_start_time: 1,
                        count: 100,
                        end: 'latest',
                        start: 1,
                        style: 'ticks',
                        subscribe: 1
                    }));
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    
                    if (msg.error) {
                        console.error('WebSocket error in TickSubscriber:', msg.error);
                        return;
                    }

                    if (msg.msg_type === 'history') {
                        if (msg.history && msg.history.prices) {
                            msg.history.prices.forEach((price: number) => {
                                this.engine.addTick(price);
                            });
                            this.emit();
                        }
                    } else if (msg.msg_type === 'tick') {
                        if (msg.tick && msg.tick.symbol === this.symbol) {
                            this.engine.addTick(msg.tick.quote);
                            this.emit();
                        }
                    }
                } catch (e) {
                    console.error('Error parsing tick message:', e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket connection error in TickSubscriber:', error);
            };

            this.ws.onclose = () => {
                this.isStreaming = false;
            };
        } catch (e) {
            console.error('Failed to get socket URL for TickSubscriber:', e);
            this.isStreaming = false;
        }
    }

    public stopStreaming() {
        if (!this.isStreaming) return;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isStreaming = false;
    }
}

// Export a singleton instance for global use across components
export const tickSubscriber = new TickSubscriber();
