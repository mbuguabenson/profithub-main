import './chunk-loader.scss';

export default function ChunkLoader({ message, isWelcome }: { message?: string; isWelcome?: boolean }) {
    if (isWelcome) {
        return (
            <div className='chunk-loader-overlay'>
                <div className='welcome-loader-card'>
                    <div className='welcome-loader-glow' />
                    <div className='welcome-loader-brand'>
                        <div className='welcome-loader-icon'>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="url(#wl-grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 17L12 22L22 17" stroke="url(#wl-grad2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M2 12L12 17L22 12" stroke="url(#wl-grad1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <defs>
                                    <linearGradient id="wl-grad1" x1="2" y1="2" x2="22" y2="12">
                                        <stop offset="0%" stopColor="#10b981" />
                                        <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                    <linearGradient id="wl-grad2" x1="2" y1="12" x2="22" y2="22">
                                        <stop offset="0%" stopColor="#3b82f6" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h1 className='welcome-loader-title'>PROFIT<span className='accent'>HUB</span></h1>
                    </div>

                    {/* Smooth Bouncing Animation Loader */}
                    <div className='bouncing-loader'>
                        <div className='bounce-dot dot-1' />
                        <div className='bounce-dot dot-2' />
                        <div className='bounce-dot dot-3' />
                        <div className='bounce-dot dot-4' />
                    </div>

                    <div className='welcome-loader-meta'>
                        {message && <span className='welcome-loader-msg'>{message}</span>}
                        <div className='welcome-loader-deriv-badge'>
                            <span className='deriv-dot' />
                            <span>Powered by Deriv</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='chunk-loader-overlay clean'>
            <div className='bouncing-loader-wrapper'>
                {/* Smooth Bouncing Animation Loader - No Card */}
                <div className='bouncing-loader'>
                    <div className='bounce-dot dot-1' />
                    <div className='bounce-dot dot-2' />
                    <div className='bounce-dot dot-3' />
                    <div className='bounce-dot dot-4' />
                </div>
                {message && <span className='bouncing-loader-msg'>{message}</span>}
            </div>
        </div>
    );
}

