import React, { useState, Suspense, lazy } from 'react';
import ChunkLoader from '@/components/loader/chunk-loader';
import { localize } from '@deriv-com/translations';
import './automated.scss';

const SmartAnalysisPage = lazy(() => import('../smart-analysis/smart-analysis'));
const CirclesAnalysis = lazy(() => import('../circles-analysis'));
const DigitCracker = lazy(() => import('../digit-cracker'));
const AutoTrades = lazy(() => import('../auto-trades/auto-trades'));
const ScannerPage = lazy(() => import('../scanner/scanner'));
const ManualTrading = lazy(() => import('../manual-trading'));
const Marketkiller = lazy(() => import('../marketkiller'));
const MultiTrader = lazy(() => import('../multi-trader'));

type AutomatedSubTab =
    | 'smart-analysis'
    | 'circles-analysis'
    | 'digit-cracker'
    | 'autotrades'
    | 'scanner'
    | 'manual-trading'
    | 'marketkiller'
    | 'multi-trader';

interface SubTabDescriptor {
    id: AutomatedSubTab;
    label: string;
    icon: string;
    badge?: string;
}

const SUB_TABS: SubTabDescriptor[] = [
    { id: 'smart-analysis', label: 'Smart Analysis', icon: '📈', badge: 'ENGINE' },
    { id: 'circles-analysis', label: 'Circles Analysis', icon: '⭕', badge: 'ANALYSIS' },
    { id: 'digit-cracker', label: 'Digit Cracker', icon: '🔢', badge: 'DIGITS' },
    { id: 'autotrades', label: 'Autotrades', icon: '⚡', badge: 'AI BOT' },
    { id: 'scanner', label: 'AI Strategy Scanner', icon: '🎯', badge: 'RADAR' },
    { id: 'manual-trading', label: 'Manual Trading', icon: '✋', badge: 'EXECUTION' },
    { id: 'marketkiller', label: 'Market Killer', icon: '⚔️', badge: 'PRO' },
    { id: 'multi-trader', label: 'Multi Trader', icon: '🔄', badge: 'BULK' },
];

const AutomatedPage: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<AutomatedSubTab>('smart-analysis');

    const renderContent = () => {
        switch (activeSubTab) {
            case 'smart-analysis':
                return <SmartAnalysisPage />;
            case 'circles-analysis':
                return <CirclesAnalysis />;
            case 'digit-cracker':
                return <DigitCracker />;
            case 'autotrades':
                return <AutoTrades />;
            case 'scanner':
                return <ScannerPage />;
            case 'manual-trading':
                return <ManualTrading />;
            case 'marketkiller':
                return <Marketkiller />;
            case 'multi-trader':
                return <MultiTrader />;
            default:
                return <SmartTrading />;
        }
    };

    return (
        <div className="automated-container">
            <div className="automated-header">
                <div className="automated-header__title-group">
                    <h2 className="automated-header__title">🤖 Automated Trading Suite</h2>
                    <span className="automated-header__subtitle">
                        Comprehensive Automated Trading, Scanner & Strategy Tools
                    </span>
                </div>
                <div className="automated-header__tabs">
                    {SUB_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`automated-tab-btn ${activeSubTab === tab.id ? 'automated-tab-btn--active' : ''}`}
                            onClick={() => setActiveSubTab(tab.id)}
                        >
                            <span className="automated-tab-btn__icon">{tab.icon}</span>
                            <span className="automated-tab-btn__label">{tab.label}</span>
                            {tab.badge && <span className="automated-tab-btn__badge">{tab.badge}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="automated-body">
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading automated tool...')} />}>
                    {renderContent()}
                </Suspense>
            </div>
        </div>
    );
};

export default AutomatedPage;
