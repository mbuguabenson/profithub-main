import { URLSearchParams } from 'url';

function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(function (cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = parts.join('=');
        list[key] = decodeURIComponent(value);
    });
    return list;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, state } = req.query || {};
        if (!code || !state) {
            return res.status(400).send('Missing code or state');
        }

        const cookies = parseCookies(req.headers.cookie || '');
        const storedState = cookies.oauth_state;
        const code_verifier = cookies.oauth_code_verifier;

        if (!storedState || !code_verifier) {
            return res.status(400).send('Missing PKCE/session data');
        }

        if (storedState !== state) {
            return res.status(400).send('Invalid state');
        }

        const client_id = process.env.DERIV_OAUTH_CLIENT_ID || process.env.DERIV_LEGACY_APP_ID;
        const redirect_uri = process.env.DERIV_REDIRECT_URI;

        if (!client_id || !redirect_uri) {
            return res.status(500).send('Server not configured for OAuth');
        }

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id,
            redirect_uri,
            code_verifier,
        });

        const tokenResp = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        const tokenData = await tokenResp.json();

        if (!tokenResp.ok) {
            return res.status(500).json({ error: 'token_exchange_failed', details: tokenData });
        }

        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = [`HttpOnly`, `Path=/`, `SameSite=Lax`];
        if (isProd) cookieOpts.push('Secure');

        const setCookies = [];
        if (tokenData.access_token)
            setCookies.push(
                `deriv_access_token=${encodeURIComponent(tokenData.access_token)}; ${cookieOpts.join('; ')}`
            );
        if (tokenData.refresh_token)
            setCookies.push(
                `deriv_refresh_token=${encodeURIComponent(tokenData.refresh_token)}; ${cookieOpts.join('; ')}`
            );
        if (tokenData.expires_in)
            setCookies.push(
                `deriv_token_expires=${Date.now() + Number(tokenData.expires_in) * 1000}; ${cookieOpts.join('; ')}`
            );

        const app_id = process.env.DERIV_LEGACY_APP_ID;
        if (app_id) {
            setCookies.push(`deriv_app_id=${encodeURIComponent(app_id)}; ${cookieOpts.join('; ')}`);
        }

        setCookies.push(`oauth_code_verifier=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
        setCookies.push(`oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
        setCookies.push(`oauth_preferred_account=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
        setCookies.push(`logged_state=true; Path=/; SameSite=Lax; ${isProd ? 'Secure' : ''}`.replace(/; $/, ''));

        let selectedAccount = null;
        let selectedCurrency = '';
        let selectedType = '';
        let accounts = [];

        if (tokenData.access_token) {
            const accountHeaders = {
                Authorization: `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json',
                ...(app_id ? { 'X-APP-ID': app_id } : {}),
            };

            const preferredAccount = cookies.oauth_preferred_account;

            // Try to fetch new wallet accounts (DOT, ROT) using trading API
            try {
                const accountResponse = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
                    headers: accountHeaders,
                }).catch(() => null);

                if (accountResponse && accountResponse.ok) {
                    const accountData = await accountResponse.json();
                    const rawAccounts = accountData.accounts || accountData.trading_accounts || [];
                    accounts = rawAccounts
                        .map(account => ({
                            loginid: account.account_id || account.loginid || account.login_id || '',
                            currency: account.currency || '',
                            account_type: account.account_type || (account.is_virtual ? 'demo' : 'real'),
                            is_virtual: account.is_virtual ?? false,
                            balance: account.balance ?? null,
                        }))
                        .filter(account => account.loginid);
                }
            } catch (err) {
                // Continue even if account fetch fails - frontend will discover via api_base.init()
            }

            // Select account based on preference or defaults
            if (accounts.length > 0) {
                const findByPreferred = () => {
                    if (!preferredAccount) return null;
                    const normalized = preferredAccount.toUpperCase();
                    if (normalized === 'DEMO') {
                        return accounts.find(account => account.account_type === 'demo');
                    }
                    return accounts.find(account => account.currency?.toUpperCase() === normalized);
                };

                selectedAccount =
                    findByPreferred() ||
                    accounts.find(account => account.account_type === 'real') ||
                    accounts[0] ||
                    null;
            }
        }

        if (selectedAccount) {
            selectedCurrency = selectedAccount.currency;
            selectedType = selectedAccount.account_type;
            setCookies.push(
                `deriv_selected_loginid=${encodeURIComponent(selectedAccount.loginid)}; ${cookieOpts.join('; ')}`
            );
            if (selectedAccount.account_type) {
                setCookies.push(
                    `deriv_account_type=${encodeURIComponent(selectedAccount.account_type)}; ${cookieOpts.join('; ')}`
                );
            }
            if (selectedAccount.currency) {
                setCookies.push(
                    `deriv_account_currency=${encodeURIComponent(selectedAccount.currency)}; ${cookieOpts.join('; ')}`
                );
            }
        }

        res.setHeader('Set-Cookie', setCookies);

        const wantsJson = req.query.return_json === 'true' || req.headers.accept?.includes('application/json');
        const payload = {
            logged_in: true,
            account_id: selectedAccount?.loginid || null,
            account_type: selectedAccount?.account_type || null,
            currency: selectedCurrency || null,
            app_id: app_id || null,
            client_id: client_id || null,
            accounts,
        };

        if (wantsJson) {
            return res.status(200).json(payload);
        }

        const redirectUrl = new URL('/', `https://${req.headers.host}`);
        if (selectedCurrency) {
            redirectUrl.searchParams.set('account', selectedCurrency);
        }

        return res.writeHead(302, { Location: redirectUrl.toString() }).end();
    } catch (err) {
        return res.status(500).json({
            error: 'oauth_callback_error',
            error_description: err instanceof Error ? err.message : String(err),
        });
    }
}
