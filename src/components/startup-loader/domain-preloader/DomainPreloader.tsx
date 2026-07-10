import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLoaderProgress } from '../useLoaderProgress';
import './DomainPreloader.scss';

interface DomainPreloaderProps {
    appReady?: boolean;
    disableSessionReduction?: boolean;
    minimumDuration?: number;
    maximumDuration?: number;
    onComplete: () => void;
}

export const DomainPreloader: React.FC<DomainPreloaderProps> = ({
    appReady = false,
    minimumDuration = 6000,
    maximumDuration = 15000,
    onComplete,
}) => {
    const [isExiting, setIsExiting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [statusIndex, setStatusIndex] = useState(0);
    const completionFiredRef = useRef(false);

    // AI neural connections
    const neuralNodes = useMemo(() => {
        return Array.from({ length: 15 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 2,
            delay: Math.random() * 5,
        }));
    }, []);

    // Side floating panels specific to Binary Options (Rise/Fall, Call/Put, Payouts)
    const floatingPanels = [
        { id: 1, label: 'EURUSD PAYOUT', value: '95% RISE', type: 'success', class: 'panel-top-left' },
        { id: 2, label: 'Volatility 75', value: 'CALL SIGNAL', type: 'success', class: 'panel-mid-right' },
        { id: 3, label: 'Volatility 100', value: 'PUT SIGNAL', type: 'danger', class: 'panel-bottom-left' },
        { id: 4, label: 'Boom 500 PAYOUT', value: '90% FALL', type: 'danger', class: 'panel-top-right' },
    ];

    const { progress } = useLoaderProgress({
        appReady: appReady,
        minimumDuration: minimumDuration,
        maximumDuration: maximumDuration,
    });

    // Update status text based on progress thresholds specific to binary options
    useEffect(() => {
        if (progress < 20) setStatusIndex(0);
        else if (progress < 40) setStatusIndex(1);
        else if (progress < 60) setStatusIndex(2);
        else if (progress < 80) setStatusIndex(3);
        else setStatusIndex(4);
    }, [progress]);

    // Handle scroll locking
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.width = originalWidth;
        };
    }, []);

    // Handle completion
    useEffect(() => {
        if (progress >= 100 && !completionFiredRef.current) {
            completionFiredRef.current = true;
            setIsComplete(true);
            setIsExiting(true);
            
            // Allow exit animation to complete before calling onComplete
            const timer = setTimeout(() => {
                onComplete();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [progress, onComplete]);

    return (
        <div
            className={`domain-preloader ${isExiting ? 'domain-preloader--exiting' : ''} ${isComplete ? 'domain-preloader--complete' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Initializing AI Binary Trading Interface"
        >
            {/* World-Class Background Neural Network & Glows */}
            <div className='preloader-bg-ambient'>
                <div className='glow-blob glow-blob--1' />
                <div className='glow-blob glow-blob--2' />
                <div className='glow-blob glow-blob--3' />
            </div>
            
            <div className='preloader-grid' />

            {/* Subtle Scrolling Forex Background Tickers with Binary Options payouts */}
            <div className='preloader-forex-ticker preloader-forex-ticker--top'>
                <div className='ticker-track'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`top-ticker-${i}`} className='ticker-group'>
                            <span className='ticker-item'>EURUSD <span className='val-up'>95% PAYOUT</span></span>
                            <span className='ticker-item'>GBPUSD <span className='val-down'>90% PAYOUT</span></span>
                            <span className='ticker-item'>USDJPY <span className='val-up'>92% PAYOUT</span></span>
                            <span className='ticker-item'>Volatility 75 <span className='val-up'>95% PAYOUT</span></span>
                            <span className='ticker-item'>Volatility 100 <span className='val-down'>95% PAYOUT</span></span>
                            <span className='ticker-item'>AUDUSD <span className='val-up'>88% PAYOUT</span></span>
                        </div>
                    ))}
                </div>
            </div>

            <div className='preloader-forex-ticker preloader-forex-ticker--bottom'>
                <div className='ticker-track'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`bottom-ticker-${i}`} className='ticker-group'>
                            <span className='ticker-item'>NZDUSD <span className='val-up'>90% PAYOUT</span></span>
                            <span className='ticker-item'>Volatility 50 <span className='val-down'>95% PAYOUT</span></span>
                            <span className='ticker-item'>Volatility 25 <span className='val-up'>95% PAYOUT</span></span>
                            <span className='ticker-item'>EURJPY <span className='val-up'>91% PAYOUT</span></span>
                            <span className='ticker-item'>GBPJPY <span className='val-up'>93% PAYOUT</span></span>
                            <span className='ticker-item'>Gold <span className='val-up'>85% PAYOUT</span></span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Neural Connections */}
            <svg className='preloader-neural-net' viewBox='0 0 100 100' preserveAspectRatio='none'>
                {neuralNodes.map((node, index) => {
                    const nextNode = neuralNodes[(index + 1) % neuralNodes.length];
                    return (
                        <line
                            key={`line-${node.id}`}
                            x1={`${node.x}%`}
                            y1={`${node.y}%`}
                            x2={`${nextNode.x}%`}
                            y2={`${nextNode.y}%`}
                            className='neural-line'
                        />
                    );
                })}
                {neuralNodes.map(node => (
                    <circle
                        key={`node-${node.id}`}
                        cx={`${node.x}%`}
                        cy={`${node.y}%`}
                        r={node.size / 15}
                        className='neural-node'
                        style={{ animationDelay: `${node.delay}s` }}
                    />
                ))}
            </svg>

            {/* Side Floating Holographic Panels */}
            {floatingPanels.map(panel => (
                <div key={panel.id} className={`floating-hologram ${panel.class}`}>
                    <div className='hologram-glow' />
                    <div className='hologram-content'>
                        <span className='hologram-label'>{panel.label}</span>
                        <span className={`hologram-val hologram-val--${panel.type}`}>{panel.value}</span>
                    </div>
                </div>
            ))}

            {/* Main Center Glass Card */}
            <div className='preloader-center-card'>
                <div className='card-glow-border' />

                {/* Logo Section */}
                <div className='preloader-logo-area'>
                    <div className='logo-shine-wrapper'>
                        <h1 className='preloader-logo-title'>
                            PROFIT HUB <span className='logo-accent'>AI</span>
                        </h1>
                    </div>
                </div>

                {/* Classic Binary Options Rise/Fall Arrow Core */}
                <div className='ai-core-processor binary-core'>
                    <div className='core-orbit core-orbit--outer' />
                    <div className='core-orbit core-orbit--mid' />
                    <div className='core-orbit core-orbit--inner' />
                    <div className='core-glow-center binary-center-glow'>
                        <div className='binary-arrows-container'>
                            <span className='arrow-rise'>▲</span>
                            <span className='arrow-fall'>▼</span>
                        </div>
                    </div>
                    <div className='core-pulse-wave' />
                </div>

                {/* Status text fades */}
                <div className='preloader-status-text'>
                    {statusIndex === 0 && <span className='status-msg'>Initializing Rise/Fall Engines...</span>}
                    {statusIndex === 1 && <span className='status-msg'>Connecting to Deriv WS Server...</span>}
                    {statusIndex === 2 && <span className='status-msg'>Loading Binary Options Models...</span>}
                    {statusIndex === 3 && <span className='status-msg'>Scanning Tick Stream Data...</span>}
                    {statusIndex === 4 && <span className='status-msg'>Preparing Classic Trading Terminal...</span>}
                </div>

                {/* Modern Shimmer Progress Bar */}
                <div className='preloader-progress-container'>
                    <div className='preloader-progress-track'>
                        <div
                            className='preloader-progress-fill'
                            style={{ width: `${progress}%` }}
                        >
                            <div className='progress-shimmer' />
                        </div>
                    </div>
                    <div className='preloader-percentage-counter'>
                        {Math.round(progress)}%
                    </div>
                </div>

                {/* Sequentially Lit Status Pills */}
                <div className='live-status-indicators'>
                    <span className={`status-pill ${progress >= 15 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> Rise/Fall Engine Ready
                    </span>
                    <span className={`status-pill ${progress >= 35 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> WS Connected
                    </span>
                    <span className={`status-pill ${progress >= 60 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> Scanner Active
                    </span>
                    <span className={`status-pill ${progress >= 85 ? 'status-pill--active' : ''}`}>
                        <span className='pill-dot' /> AI Models Loaded
                    </span>
                </div>
            </div>

            {/* Bottom Brand Technology Credits */}
            <div className='preloader-powered-by'>
                <span className='powered-text'>Powered by</span>
                <span className='powered-brand-logo'>DERIV</span>
                <span className='powered-tech-tag'>AI TECHNOLOGY</span>
            </div>
        </div>
    );
};
export default DomainPreloader;
