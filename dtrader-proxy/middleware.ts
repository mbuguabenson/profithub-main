import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Pass the request forward to the rewrite destination
    const response = NextResponse.next();

    // Remove security headers that prevent iframe embedding
    response.headers.delete('x-frame-options');
    response.headers.delete('content-security-policy');

    // Set headers to explicitly allow embedding from anywhere
    response.headers.set('Access-Control-Allow-Origin', '*');

    return response;
}

export const config = {
    // Apply this middleware to all routes
    matcher: '/:path*',
};
