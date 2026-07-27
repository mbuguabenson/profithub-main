import crypto from 'crypto';

function base64URLEncode(buffer) {
    return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function randomString(length = 64) {
    return base64URLEncode(crypto.randomBytes(length));
}

export default async function handler(req, res) {
    // Only GET supported: redirect to the Deriv authorization endpoint
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = req.query || {};

        // Use client_id passed as query or fallback to env var
        const client_id = query.client_id || process.env.DERIV_OAUTH_CLIENT_ID || process.env.DERIV_LEGACY_APP_ID;
        const redirect_uri = query.redirect_uri || process.env.DERIV_REDIRECT_URI;

        if (!client_id || !redirect_uri) {
            return res.status(500).json({ error: 'Missing server configuration for client_id or redirect_uri' });
        }

        const preferred_account = query.account || query.preferred_account || '';

        // Generate PKCE code_verifier and state
        const code_verifier = randomString(64);
        const code_challenge = base64URLEncode(sha256(code_verifier));
        const state = randomString(32);

        // Set HttpOnly cookies to keep code_verifier, state, and preferred account server-side
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOpts = [`HttpOnly`, `Path=/`, `SameSite=Lax`];
        if (isProd) cookieOpts.push('Secure');

        const cookies = [
            `oauth_code_verifier=${encodeURIComponent(code_verifier)}; ${cookieOpts.join('; ')}`,
            `oauth_state=${encodeURIComponent(state)}; ${cookieOpts.join('; ')}`,
        ];

        if (preferred_account) {
            cookies.push(`oauth_preferred_account=${encodeURIComponent(preferred_account)}; ${cookieOpts.join('; ')}`);
        }

        res.setHeader('Set-Cookie', cookies);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id,
            redirect_uri,
            scope: 'trade',
            state,
            code_challenge,
            code_challenge_method: 'S256',
        });

        Object.entries(query).forEach(([key, value]) => {
            if (!['client_id', 'redirect_uri', 'account', 'preferred_account'].includes(key) && value) {
                params.set(key, String(value));
            }
        });

        const authUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;

        // Redirect the browser to Deriv's authorization endpoint
        return res.writeHead(302, { Location: authUrl }).end();
    } catch (err) {
        return res
            .status(500)
            .json({ error: 'oauth_start_failed', error_description: err instanceof Error ? err.message : String(err) });
    }
}
