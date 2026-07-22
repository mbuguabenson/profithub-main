import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useCompoundingWS } from './hooks/useCompoundingWS';
import { calculateCompoundingPlan, CompoundingSummary } from './utils/compounding-calculator';
import { DashboardTab } from './components/DashboardTab';
import { ChallengeGeneratorTab } from './components/ChallengeGeneratorTab';
import { MarketScannerTab } from './components/MarketScannerTab';
import { StrategyAnalyticsTab } from './components/StrategyAnalyticsTab';
import { TradingConsoleTab } from './components/TradingConsoleTab';
import { AutoCompoundingTab } from './components/AutoCompoundingTab';
import { RecoveryEngineTab } from './components/RecoveryEngineTab';
import { SmartZonesTab } from './components/SmartZonesTab';
import { PerformanceTab } from './components/PerformanceTab';
import { TransactionHistoryTab } from './components/TransactionHistoryTab';
import './ai-compounding-engine.scss';

type ACEActiveTab =
    | 'dashboard'
    | 'scanner'
    | 'analytics'
    | 'console'
    | 'autocompounding'
    | 'recovery'
    | 'smartzones'
    | 'history'
    | 'performance'
    | 'settings';

const AICompoundingEngine = observer(() => {
    const [activeTab, setActiveTab] = useState<ACEActiveTab>('dashboard');
    const [botStatus, setBotStatus] = useState<string>('AUTO');
    const [summary, setSummary] = useState<CompoundingSummary>(() => calculateCompoundingPlan(400, 4000, 150));
    const [tradeLogs, setTradeLogs] = useState<any[]>([]);

    const {
        isConnected,
        isAuthorized,
        accountLoginId,
        manualToken,
        updateManualToken,
        activeSymbol,
        changeActiveSymbol,
        balance,
        marketsData,
        buyProposal,
    } = useCompoundingWS();

    const [tokenInput, setTokenInput] = useState<string>(manualToken || '');
    const activeMarketData = marketsData[activeSymbol];

    const handleAddTradeLog = (newLog: any) => {
        setTradeLogs(prev => [newLog, ...prev]);
    };

    return (
        <div className="ace-container">
            {/* Header Bar */}
            <div className="ace-header">
                <div className="ace-brand">
                    <div>
                        <h1 className="ace-title">AI Compounding Engine ⭐</h1>
                        <p className="ace-subtitle">Quantum Statistical Trading Brain & Challenge Automation</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(15,23,42,0.8)', padding: '0.3rem 0.6rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>API Token:</span>
                        <input
                            type="password"
                            placeholder="Paste CR / ROT Token"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            onBlur={() => updateManualToken(tokenInput)}
                            style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '0.8rem', outline: 'none', width: '130px' }}
                        />
                        <button
                            onClick={() => updateManualToken(tokenInput)}
                            style={{ background: '#10b981', border: 'none', color: '#000', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', cursor: 'pointer' }}
                        >
                            Save
                        </button>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isAuthorized ? '#10b981' : '#ef4444' }} />
                        {isAuthorized ? `Real Account: ${accountLoginId || 'Authorized'}` : 'No Session Token'}
                    </div>

                    <span className={`ace-status-pill status-${botStatus}`}>
                        {botStatus}
                    </span>
                </div>
            </div>

            {/* Sub-Tabs Bar */}
            <div className="ace-nav-tabs">
                <button
                    className={`ace-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    📊 Dashboard
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'scanner' ? 'active' : ''}`}
                    onClick={() => setActiveTab('scanner')}
                >
                    🔍 Market Scanner
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    📈 Strategy Analytics
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'console' ? 'active' : ''}`}
                    onClick={() => setActiveTab('console')}
                >
                    ⚡ Trading Console
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'autocompounding' ? 'active' : ''}`}
                    onClick={() => setActiveTab('autocompounding')}
                >
                    🚀 Auto Compounding
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'recovery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('recovery')}
                >
                    🛡️ Recovery Engine
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'smartzones' ? 'active' : ''}`}
                    onClick={() => setActiveTab('smartzones')}
                >
                    🎯 Smart Zones
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    📜 Transaction History
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                >
                    📊 Performance
                </button>
                <button
                    className={`ace-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ Settings
                </button>
            </div>

            {/* Active Content Area */}
            <div className="ace-content-area">
                {activeTab === 'dashboard' && (
                    <DashboardTab
                        summary={summary}
                        botStatus={botStatus}
                        setBotStatus={setBotStatus}
                        activeMarketData={activeMarketData}
                        balance={balance}
                        tradeLogs={tradeLogs}
                    />
                )}

                {activeTab === 'scanner' && (
                    <MarketScannerTab
                        marketsData={marketsData}
                        activeSymbol={activeSymbol}
                        onSelectSymbol={changeActiveSymbol}
                    />
                )}

                {activeTab === 'analytics' && (
                    <StrategyAnalyticsTab activeMarketData={activeMarketData} />
                )}

                {activeTab === 'console' && (
                    <TradingConsoleTab
                        activeSymbol={activeSymbol}
                        activeMarketData={activeMarketData}
                        balance={balance}
                        buyProposal={buyProposal}
                        botStatus={botStatus}
                        setBotStatus={setBotStatus}
                        onAddTradeLog={handleAddTradeLog}
                    />
                )}

                {activeTab === 'autocompounding' && (
                    <AutoCompoundingTab summary={summary} balance={balance} />
                )}

                {activeTab === 'recovery' && <RecoveryEngineTab />}

                {activeTab === 'smartzones' && <SmartZonesTab marketsData={marketsData} />}

                {activeTab === 'history' && <TransactionHistoryTab tradeLogs={tradeLogs} />}

                {activeTab === 'performance' && (
                    <PerformanceTab summary={summary} balance={balance} tradeLogs={tradeLogs} />
                )}

                {activeTab === 'settings' && (
                    <ChallengeGeneratorTab summary={summary} onUpdateSummary={setSummary} />
                )}
            </div>
        </div>
    );
});

export default AICompoundingEngine;
