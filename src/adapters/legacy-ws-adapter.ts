import { getAppId } from '@/components/shared/utils/config/config';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';

// A mock WebSocket that intercepts legacy calls and routes them through the new API
export class LegacyWSAdapter {
    private eventListeners: { [key: string]: Array<(evt: any) => void> } = {};
    public readyState: number = 0; // CONNECTING
    private connectedClients: any[] = [];
    private balances: { [loginid: string]: any } = {};

    constructor() {
        // Simulate immediate connection open
        setTimeout(() => {
            this.readyState = 1; // OPEN
            this.dispatchEvent('open', {});
        }, 100);
    }

    addEventListener(event: string, callback: (evt: any) => void) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    removeEventListener(event: string, callback: (evt: any) => void) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }

    private dispatchEvent(eventName: string, data: any) {
        const evt = { type: eventName, ...data };
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(cb => cb(evt));
        }
    }

    async send(dataStr: string) {
        try {
            const data = JSON.parse(dataStr);

            if (data.authorize === 'MULTI' && Array.isArray(data.tokens)) {
                // Legacy multi-auth for copy trading
                this.handleMultiAuthorize(data.tokens, data.req_id);
            } else if (data.balance === 1 && data.loginid) {
                // Legacy balance fetch for specific account
                this.handleBalanceFetch(data.loginid, data.req_id);
            } else if (data.ping === 1) {
                // Mock ping
                this.dispatchEvent('message', {
                    data: JSON.stringify({ ping: 'pong', msg_type: 'ping', req_id: data.req_id })
                });
            }
        } catch (e) {
            console.error('LegacyWSAdapter parse error:', e);
        }
    }

    private async handleMultiAuthorize(tokens: string[], req_id: number) {
        const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
        const accountList: any[] = [];

        // For each token, we use DerivAPIBasic to authorize and get the account info
        // We'll use v3 for the legacy API tokens since v1 requires OAuth
        for (const token of tokens) {
            try {
                // Since this is just for UI population (webSS), we can use basic API requests
                const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
                
                const authPromise = new Promise((resolve) => {
                    ws.onopen = () => ws.send(JSON.stringify({ authorize: token }));
                    ws.onmessage = (msg) => {
                        const response = JSON.parse(msg.data);
                        if (response.msg_type === 'authorize') {
                            resolve(response.authorize);
                        }
                    };
                    setTimeout(() => resolve(null), 5000); // 5s timeout
                });

                const auth: any = await authPromise;
                if (auth) {
                    accountList.push({
                        loginid: auth.loginid,
                        currency: auth.currency,
                        is_virtual: auth.is_virtual,
                        currency_type: 'fiat'
                    });
                }
                ws.close();
            } catch (e) {
                console.error('Failed to auth token in adapter:', e);
            }
        }

        this.dispatchEvent('message', {
            data: JSON.stringify({
                echo_req: { req_id },
                req_id,
                msg_type: 'authorize',
                authorize: {
                    account_list: accountList
                }
            })
        });
    }

    private async handleBalanceFetch(loginid: string, req_id: number) {
        // Find token for this loginid
        const storedArray = JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
        const accountsList = JSON.parse(localStorage.getItem('accountsList') || '{}');
        let matchedToken = '';

        Object.keys(accountsList).forEach(key => {
            if (key === loginid) matchedToken = accountsList[key];
        });

        // Use v3 to fetch balance quickly for UI
        if (matchedToken) {
            const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
            const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`);
            
            ws.onopen = () => {
                ws.send(JSON.stringify({ authorize: matchedToken }));
            };
            ws.onmessage = (msg) => {
                const response = JSON.parse(msg.data);
                if (response.msg_type === 'authorize') {
                    ws.send(JSON.stringify({ balance: 1, account: 'all' }));
                } else if (response.msg_type === 'balance') {
                    this.dispatchEvent('message', {
                        data: JSON.stringify({
                            echo_req: { req_id },
                            req_id,
                            msg_type: 'balance',
                            balance: response.balance
                        })
                    });
                    ws.close();
                }
            };
        }
    }

    close() {
        this.readyState = 3; // CLOSED
        this.dispatchEvent('close', {});
    }
}
