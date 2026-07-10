import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import ChunkLoader from '@/components/loader/chunk-loader';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import './app-root.scss';

const AppContent = lazy(() => import('./app-content'));

const AppRootLoader = () => {
    return <ChunkLoader message={localize('Loading...')} />;
};

const ErrorComponentWrapper = observer(() => {
    const { common } = useStore();

    if (!common.error) return null;

    return (
        <ErrorComponent
            header={common.error?.header}
            message={common.error?.message}
            redirect_label={common.error?.redirect_label}
            redirectOnClick={common.error?.redirectOnClick}
            should_clear_error_on_click={common.error?.should_clear_error_on_click}
            setError={common.setError}
            redirect_to={common.error?.redirect_to}
            should_redirect={common.error?.should_redirect}
        />
    );
});

const WelcomeScreen = ({ onFinished }: { onFinished: () => void }) => {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFadeOut(true);
            const unmountTimer = setTimeout(onFinished, 500);
            return () => clearTimeout(unmountTimer);
        }, 2500);

        return () => clearTimeout(timer);
    }, [onFinished]);

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: '#0e1118',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    width: '350px',
                    height: '350px',
                    background: 'radial-gradient(circle, rgba(76, 175, 80, 0.15) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                }}
            />

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '24px',
                    transform: fadeOut ? 'scale(1.05)' : 'scale(1)',
                    transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                    animation: 'welcome-zoom-in 2s cubic-bezier(0.25, 1, 0.5, 1) forwards',
                }}
            >
                <img
                    src='/logo.png'
                    alt='Ultimate Protool Logo'
                    style={{
                        height: '70px',
                        width: 'auto',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 0 15px rgba(76, 175, 80, 0.3))',
                    }}
                />

                <div
                    style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px',
                        padding: '12px 32px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                    }}
                >
                    <div
                        style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '11px',
                            fontWeight: '600',
                            letterSpacing: '3px',
                            textTransform: 'uppercase',
                        }}
                    >
                        Ultimate Trading Platform
                    </div>

                    <div
                        style={{
                            width: '140px',
                            height: '3px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                width: '60%',
                                height: '100%',
                                background: 'linear-gradient(90deg, #4caf50, #81c784)',
                                borderRadius: '2px',
                                position: 'absolute',
                                animation: 'welcome-loading-shimmer 1.5s infinite ease-in-out',
                            }}
                        />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes welcome-zoom-in {
                    0% {
                        transform: scale(0.85);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                @keyframes welcome-loading-shimmer {
                    0% {
                        left: -100%;
                        width: 50%;
                    }
                    50% {
                        width: 70%;
                    }
                    100% {
                        left: 100%;
                        width: 50%;
                    }
                }
            `}</style>
        </div>
    );
};

const AppRoot = () => {
    const store = useStore();
    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);

    // Initialize API
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!is_api_initialized) {
                setIsApiInitialized(true);
            }
        }, 5000);

        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await api_base.init();
                    api_base_initialized.current = true;
                } catch (error) {
                    console.error('API initialization failed:', error);
                    api_base_initialized.current = false;
                } finally {
                    setIsApiInitialized(true);
                    clearTimeout(timeoutId); // Clear timeout if API init completes
                }
            }
        };

        initializeApi();
        return () => clearTimeout(timeoutId);
    }, [is_api_initialized]);

    if (showWelcome) {
        return (
            <WelcomeScreen
                onFinished={() => {
                    if (is_api_initialized) {
                        setShowWelcome(false);
                    } else {
                        const checkInterval = setInterval(() => {
                            if (is_api_initialized) {
                                setShowWelcome(false);
                                clearInterval(checkInterval);
                            }
                        }, 100);
                        return () => clearInterval(checkInterval);
                    }
                }}
            />
        );
    }

    if (!store || !is_api_initialized) return <AppRootLoader />;

    return (
        <Suspense fallback={<AppRootLoader />}>
            <ErrorBoundary root_store={store}>
                <ErrorComponentWrapper />
                <AppContent />
            </ErrorBoundary>
        </Suspense>
    );
};

export default AppRoot;
