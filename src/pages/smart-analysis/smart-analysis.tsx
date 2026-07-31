import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import './smart-analysis.scss';

const TARGET_APP_URL = 'https://deriv-api-integratio-o3c5.bolt.host';

export const SmartAnalysisPage: React.FC = observer(() => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { transactions, run_panel, summary_card } = useStore();

    // Broadcast current auth context & user active token to embedded iFrame
    const sendAuthToIFrame = () => {
        if (!iframeRef.current?.contentWindow) return;

        const activeLoginId = localStorage.getItem('active_loginid');
        const accountsListRaw = localStorage.getItem('accountsList');
        const accountsList = accountsListRaw ? JSON.parse(accountsListRaw) : {};
        const activeToken = accountsList[activeLoginId || '']?.token;

        const authPayload = {
            type: 'INIT_AUTH',
            payload: {
                active_loginid: activeLoginId,
                token: activeToken,
                currency: (api_base.account_info as any)?.currency || 'USD',
                accountsList,
            },
        };

        iframeRef.current.contentWindow.postMessage(authPayload, '*');
    };

    // Handle iFrame postMessage Listeners
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { type, payload } = event.data || {};

            switch (type) {
                case 'IFRAME_READY':
                    sendAuthToIFrame();
                    break;

                case 'TRADE_EXECUTED':
                    // Dispatch trades from external app to ProfitHub's Run Panel Drawer
                    try {
                        transactions.pushTransaction({ ...(payload as any), run_id: run_panel.run_id });
                        run_panel.onBotContractEvent(payload as any);
                        summary_card.onBotContractEvent(payload as any);
                    } catch (err) {
                        console.warn('[SmartAnalysis iFrame] Run panel dispatch warning:', err);
                    }
                    break;

                case 'REQUEST_REAUTH':
                    sendAuthToIFrame();
                    break;

                default:
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Reload iFrame
    const handleReload = () => {
        if (iframeRef.current) {
            iframeRef.current.src = TARGET_APP_URL;
        }
    };

    // Open App in New Tab
    const handleOpenNewTab = () => {
        window.open(TARGET_APP_URL, '_blank');
    };

    return (
        <div className="smart-analysis-iframe-container">
            {/* Header Control Bar */}
            <div className="iframe-header">
                <div className="iframe-header__title">
                    <span className="icon">🤖</span>
                    <div>
                        <h2>Deriv Auto Trader & Smart Analysis</h2>
                        <span>Integrated Live Web Application</span>
                    </div>
                </div>

                <div className="iframe-header__actions">
                    <button className="action-btn" onClick={handleReload}>
                        🔄 Reload App
                    </button>
                    <button className="action-btn action-btn--primary" onClick={handleOpenNewTab}>
                        🔗 Open New Tab
                    </button>
                </div>
            </div>

            {/* Responsive iFrame Container */}
            <div className="iframe-wrapper">
                <iframe
                    ref={iframeRef}
                    src={TARGET_APP_URL}
                    title="Deriv Auto Trader & Smart Analysis"
                    allow="clipboard-read; clipboard-write; autoplay; fullscreen"
                    onLoad={sendAuthToIFrame}
                />
            </div>
        </div>
    );
});

export default SmartAnalysisPage;
