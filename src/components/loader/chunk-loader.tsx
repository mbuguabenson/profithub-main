import React from 'react';
import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message?: string }) {
    return (
        <div className='chunk-loader-overlay'>
            <div className='chunk-loader-card'>
                <div className='chunk-loader-icon-wrapper'>
                    {/* Ambient Glow */}
                    <div className='chunk-loader-glow' />
                    
                    {/* SVG Quantum Orbital Loader */}
                    <svg className='chunk-loader-svg' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <defs>
                            <linearGradient id='cl-grad-outer' x1='0%' y1='0%' x2='100%' y2='100%'>
                                <stop offset='0%' stopColor='#10b981' />
                                <stop offset='50%' stopColor='#3b82f6' />
                                <stop offset='100%' stopColor='#8b5cf6' />
                            </linearGradient>
                            <linearGradient id='cl-grad-inner' x1='100%' y1='0%' x2='0%' y2='100%'>
                                <stop offset='0%' stopColor='#f59e0b' />
                                <stop offset='100%' stopColor='#ef4444' />
                            </linearGradient>
                        </defs>
                        
                        {/* Track rings */}
                        <circle cx='50' cy='50' r='42' stroke='rgba(255, 255, 255, 0.06)' strokeWidth='3' />
                        <circle cx='50' cy='50' r='30' stroke='rgba(255, 255, 255, 0.04)' strokeWidth='2' />

                        {/* Outer animated gradient arc */}
                        <circle
                            className='cl-arc-outer'
                            cx='50'
                            cy='50'
                            r='42'
                            stroke='url(#cl-grad-outer)'
                            strokeWidth='3.5'
                            strokeLinecap='round'
                            strokeDasharray='180 80'
                        />

                        {/* Inner reverse animated gradient arc */}
                        <circle
                            className='cl-arc-inner'
                            cx='50'
                            cy='50'
                            r='30'
                            stroke='url(#cl-grad-inner)'
                            strokeWidth='3'
                            strokeLinecap='round'
                            strokeDasharray='110 80'
                        />
                    </svg>

                    {/* Central glowing core emblem */}
                    <div className='chunk-loader-core'>
                        <span className='chunk-loader-core-dot' />
                    </div>
                </div>

                {message && (
                    <div className='chunk-loader-badge'>
                        <span className='chunk-loader-dot-live' />
                        <span className='chunk-loader-text'>{message}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

