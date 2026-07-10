import { getAppId, isProduction } from '@/components/shared/utils/config/config';

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
                    data: JSON.stringify({ ping: 'pong', msg_type: 'ping', req_id: data.req_id }),
                });
            }
        } catch (e) {
            console.error('LegacyWSAdapter parse error:', e);
        }
    }

    private async handleMultiAuthorize(tokens: string[], req_id: number) {
        const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
        const environment = isProduction() ? 'production' : 'staging';
        const baseURL = environment === 'production' ? 'https://api.derivws.com/trading/v1/' : 'https://staging-api.derivws.com/trading/v1/';
        const accountList: any[] = [];

        // For each token, retrieve Options account info via new REST API
        for (const token of tokens) {
            try {
                const response = await fetch(`${baseURL}options/accounts`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Deriv-App-ID': appId,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    const accounts = data?.data || [];
                    for (const auth of accounts) {
                        accountList.push({
                            loginid: auth.account_id,
                            currency: auth.currency,
                            is_virtual: auth.account_type === 'demo' ? 1 : 0,
                            currency_type: 'fiat',
                        });
                    }
                }
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
                    account_list: accountList,
                },
            }),
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

        // Use REST accounts API to fetch balance
        if (matchedToken) {
            const appId = getAppId?.() ?? localStorage.getItem('APP_ID') ?? '1069';
            const environment = isProduction() ? 'production' : 'staging';
            const baseURL = environment === 'production' ? 'https://api.derivws.com/trading/v1/' : 'https://staging-api.derivws.com/trading/v1/';

            try {
                const response = await fetch(`${baseURL}options/accounts`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${matchedToken}`,
                        'Deriv-App-ID': appId,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    const accounts = data?.data || [];
                    const matchedAcc = accounts.find((a: any) => a.account_id === loginid);
                    if (matchedAcc) {
                        this.dispatchEvent('message', {
                            data: JSON.stringify({
                                echo_req: { req_id },
                                req_id,
                                msg_type: 'balance',
                                balance: {
                                    balance: typeof matchedAcc.balance === 'number' ? matchedAcc.balance : parseFloat(matchedAcc.balance || '0'),
                                    currency: matchedAcc.currency,
                                    loginid: matchedAcc.account_id,
                                },
                            }),
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to fetch balance in adapter:', e);
            }
        }
    }

    close() {
        this.readyState = 3; // CLOSED
        this.dispatchEvent('close', {});
    }
}
