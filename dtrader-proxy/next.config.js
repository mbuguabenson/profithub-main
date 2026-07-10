/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/:path*',
                destination: 'https://app.deriv.com/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
