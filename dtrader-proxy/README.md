# DTrader Proxy

This is a lightweight Next.js Edge proxy specifically designed to allow embedding Deriv's `app.deriv.com` inside an iframe on your own domains.

It accomplishes this by utilizing Next.js Rewrites to proxy all traffic to Deriv, and an Edge Middleware to strip out the `X-Frame-Options` and `Content-Security-Policy` headers from the response in real-time.

## How to Deploy to Vercel

1. Push this folder to a new GitHub repository (e.g., `my-dtrader-proxy`).
2. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New > Project**.
3. Import the GitHub repository you just created.
4. Leave all settings as default and click **Deploy**.
5. Once deployed, copy the new Vercel URL (e.g., `https://my-dtrader-proxy.vercel.app`).

## Integrating into your Bot Builder

After you deploy this proxy, open `src/pages/dtrader/dtrader.tsx` in your main Bot Builder codebase and replace `https://hyperbot-indol.vercel.app/` with your new Vercel proxy URL.

Example:

```typescript
const url = `https://my-dtrader-proxy.vercel.app/?${params.toString()}`;
```
