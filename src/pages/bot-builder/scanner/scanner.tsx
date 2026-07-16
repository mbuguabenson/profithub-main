import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { api_base } from '@/external/bot-skeleton';
import classNames from 'classnames';
import './scanner.scss';

const getStatsForStrategy = (analysis: any, strategy: string) => {
  if (!analysis) return { strength: 0, text: '-', details: {} as any };

  const lastDigits = analysis.lastDigits || [];
  const totalTicks = analysis.totalTicks || lastDigits.length || 1;

  if (strategy === 'even_odd') {
    const evenPct = analysis.evenPercentage;
    const oddPct = analysis.oddPercentage;
    const strength = Math.max(evenPct, oddPct);
    const bias = evenPct >= oddPct ? 'even' : 'odd';
    return {
      strength,
      text: `Even ${evenPct.toFixed(0)}% / Odd ${oddPct.toFixed(0)}%`,
      details: { bias }
    };
  }

  if (strategy === 'over_under') {
    const pctOver1 = (lastDigits.filter((d: number) => d > 1).length / totalTicks) * 100;
    const pctOver2 = (lastDigits.filter((d: number) => d > 2).length / totalTicks) * 100;
    const pctOver3 = (lastDigits.filter((d: number) => d > 3).length / totalTicks) * 100;

    const pctUnder6 = (lastDigits.filter((d: number) => d < 6).length / totalTicks) * 100;
    const pctUnder7 = (lastDigits.filter((d: number) => d < 7).length / totalTicks) * 100;
    const pctUnder8 = (lastDigits.filter((d: number) => d < 8).length / totalTicks) * 100;

    const maxOver = Math.max(pctOver1, pctOver2, pctOver3);
    const maxUnder = Math.max(pctUnder6, pctUnder7, pctUnder8);

    const isOver = maxOver >= maxUnder;
    const strength = isOver ? maxOver : maxUnder;
    
    let targetDigit = 1;
    if (isOver) {
      if (pctOver3 === maxOver) targetDigit = 3;
      else if (pctOver2 === maxOver) targetDigit = 2;
    } else {
      if (pctUnder6 === maxUnder) targetDigit = 6;
      else if (pctUnder7 === maxUnder) targetDigit = 7;
      else targetDigit = 8;
    }

    return {
      strength,
      text: isOver ? `Over ${targetDigit}: ${strength.toFixed(0)}%` : `Under ${targetDigit}: ${strength.toFixed(0)}%`,
      details: { bias: isOver ? 'high' : 'low', targetDigit }
    };
  }

  if (strategy === 'differs') {
    const weakestDigit = analysis.powerIndex.weakest;
    const weakestPct = analysis.digitFrequencies[weakestDigit]?.percentage || 0;
    const strength = 100 - weakestPct;
    return {
      strength,
      text: `Differs ${weakestDigit}: ${strength.toFixed(0)}%`,
      details: { targetDigit: weakestDigit }
    };
  }

  if (strategy === 'matches') {
    const strongestDigit = analysis.powerIndex.strongest;
    const strongestPct = analysis.digitFrequencies[strongestDigit]?.percentage || 0;
    const strength = strongestPct;
    return {
      strength,
      text: `Matches ${strongestDigit}: ${strength.toFixed(0)}%`,
      details: { targetDigit: strongestDigit }
    };
  }

  if (strategy === 'rise_fall') {
    if (lastDigits.length >= 10) {
      const last10 = lastDigits.slice(-10);
      const firstTickValue = last10[0];
      const lastTickValue = last10[last10.length - 1];
      const trend = lastTickValue - firstTickValue;
      const direction = trend > 0 ? 'rise' : 'fall';
      const strength = Math.min(60 + Math.abs(trend) * 100, 75);
      return {
        strength,
        text: `${direction === 'rise' ? 'Rise' : 'Fall'}: ${strength.toFixed(0)}%`,
        details: { bias: direction === 'rise' ? 'high' : 'low' }
      };
    }
  }

  return { strength: 0, text: '-', details: {} as any };
};

const Scanner = observer(() => {
  const store = useStore();
  const { scanner } = store;
  const {
    is_open,
    is_scanning,
    selected_symbols,
    current_signal,
    setScannerVisibility,
    setSelectedSymbols,
    startScanning,
    stopScanning,
    loadBotWithStrategy,
    loadBotAndRun,

    // Automation & selection states
    selected_strategies,
    scan_market_mode,
    single_market_symbol,
    ticks_counter,
    toggleStrategy,
    setScanMarketMode,
    setSingleMarketSymbol,
  } = scanner;

  const [available_symbols, setAvailableSymbols] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'scanner' | 'stats' | 'dollarflipper'>('scanner');
  const [statsStrategy, setStatsStrategy] = useState<'even_odd' | 'over_under' | 'differs' | 'rise_fall' | 'matches'>('even_odd');

  useEffect(() => {
    if (api_base.active_symbols && api_base.active_symbols.length > 0) {
      // Exclude BOOM/CRASH, include Volatility (1HZ, R_) and JUMP indices
      const symbols = api_base.active_symbols.filter((s: any) => {
        const symbolStr = (s.symbol || s.underlying_symbol || '').toUpperCase();
        if (symbolStr.includes('BOOM') || symbolStr.includes('CRASH')) return false;
        if (symbolStr.includes('1HZ15V') || symbolStr.includes('1HZ30V') || symbolStr.includes('1HZ90V')) return false;
        return symbolStr.includes('1HZ') || symbolStr.startsWith('R_') || symbolStr.includes('JD') || symbolStr.includes('JUMP');
      });
      setAvailableSymbols(symbols.length > 0 ? symbols : api_base.active_symbols);

      if (selected_symbols.length === 0) {
        const allSyms = (symbols.length > 0 ? symbols : api_base.active_symbols).map((s: any) => s.symbol || s.underlying_symbol);
        setSelectedSymbols(allSyms);
      }
    }
  }, []);

  const handleLoadBotFromStats = (sym: any, strategy: string, statsData: any, analysis: any) => {
    const symbolKey = sym.symbol || sym.underlying_symbol;
    
    scanner.current_signal = {
      symbol: symbolKey,
      strategy: strategy as any,
      confidence: statsData.strength / 100,
      timestamp: Date.now(),
      details: {
        type: strategy as any,
        status: 'TRADE NOW',
        probability: statsData.strength / 100,
        recommendation: statsData.text,
        entryCondition: `Manual trigger from stats tab`,
        targetDigit: statsData.details.targetDigit,
        signalDetails: {
          bias: statsData.details.bias
        }
      },
      analysisResult: analysis
    };
    
    scanner.is_manual_selection = true;
    scanner.loadBotWithStrategy();
  };

  const strategyOptions: { value: string; label: string }[] = [
    { value: 'even_odd', label: 'Even/Odd' },
    { value: 'over_under', label: 'Over/Under' },
    { value: 'matches', label: 'Matches' },
    { value: 'differs', label: 'Differs' },
    { value: 'rise_fall', label: 'Rise/Fall' },
    { value: 'pro_even_odd', label: 'Pro E/O' },
    { value: 'pro_over_under', label: 'Pro O/U' },
    { value: 'pro_differs', label: 'Pro Diff' },
    { value: 'under_7', label: 'Under 7' },
    { value: 'over_2', label: 'Over 2' },
    { value: 'super', label: 'Super' },
  ];

  return (
    <React.Fragment>
      {is_open && (
        <DraggableResizeWrapper
          boundary=".main"
          header={localize('AI Market Scanner')}
          onClose={setScannerVisibility}
          modalWidth={530}
          modalHeight={660}
          minWidth={530}
          minHeight={580}
          enableResizing
        >
          <div className="scanner-container minimal-scanner" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '16px' }}>
            
            {/* Custom Premium Sub Tabs */}
            <div className="scanner-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '12px', flexShrink: 0 }}>
              <button 
                className={classNames('tab-btn', { active: activeTab === 'scanner' })} 
                onClick={() => setActiveTab('scanner')}
                style={{ flex: 1, padding: '8px 12px', background: activeTab === 'scanner' ? 'rgba(79, 143, 255, 0.12)' : 'transparent', color: activeTab === 'scanner' ? '#4f8fff' : 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                {localize('Scanner Settings')}
              </button>
              <button 
                className={classNames('tab-btn', { active: activeTab === 'stats' })} 
                onClick={() => setActiveTab('stats')}
                style={{ flex: 1, padding: '8px 12px', background: activeTab === 'stats' ? 'rgba(79, 143, 255, 0.12)' : 'transparent', color: activeTab === 'stats' ? '#4f8fff' : 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                {localize('Signals Stats')}
              </button>
              <button 
                className={classNames('tab-btn', { active: activeTab === 'dollarflipper' })} 
                onClick={() => setActiveTab('dollarflipper')}
                style={{ flex: 1, padding: '8px 12px', background: activeTab === 'dollarflipper' ? 'rgba(79, 143, 255, 0.12)' : 'transparent', color: activeTab === 'dollarflipper' ? '#4f8fff' : 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                {localize('Dollarflipper')}
              </button>
            </div>

            <div className="scanner-scroll-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px', marginBottom: '12px' }}>
              {activeTab === 'scanner' ? (
                <React.Fragment>
                  {/* Market Selection Section */}
                  <div className="section-card">
                    <div className="section-header">
                      <span className="section-title">{localize('Markets')}</span>
                      <div className="mode-toggle">
                        <button
                          className={classNames('mode-btn', { active: scan_market_mode === 'multi' })}
                          onClick={() => setScanMarketMode('multi')}
                        >
                          {localize('All Markets')}
                        </button>
                        <button
                          className={classNames('mode-btn', { active: scan_market_mode === 'single' })}
                          onClick={() => setScanMarketMode('single')}
                        >
                          {localize('Single')}
                        </button>
                      </div>
                    </div>

                    {scan_market_mode === 'single' ? (
                      <div className="market-select-wrapper">
                        <select
                          className="market-select"
                          value={single_market_symbol}
                          onChange={(e) => setSingleMarketSymbol(e.target.value)}
                        >
                          {available_symbols.map((sym: any) => (
                            <option key={sym.symbol || sym.underlying_symbol} value={sym.symbol || sym.underlying_symbol}>
                              {sym.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <p className="scan-info-text">
                        {localize('Scanning all volatility indices and jump markets')}
                      </p>
                    )}
                  </div>

                  {/* Strategies Selection Section */}
                  <div className="section-card">
                    <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                      {localize('Select Strategies')}
                    </span>
                    <div className="strategy-grid">
                      {strategyOptions.map(opt => {
                        const isSelected = selected_strategies.includes(opt.value as any);
                        return (
                          <button
                            key={opt.value}
                            className={classNames('strategy-checkbox', { active: isSelected })}
                            onClick={() => toggleStrategy(opt.value as any)}
                          >
                            <span className="check-indicator">{isSelected ? '✓' : ''}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Automation & Risk Parameters Card */}
                  <div className="section-card">
                    <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                      {localize('Trading & Automation Settings')}
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Stake ($)')}</label>
                        <input 
                          type="number" 
                          value={scanner.stake} 
                          onChange={(e) => scanner.stake = parseFloat(e.target.value) || 0}
                          style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Martingale Multiplier')}</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={scanner.martingale_multiplier} 
                          onChange={(e) => scanner.martingale_multiplier = parseFloat(e.target.value) || 0}
                          style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Take Profit ($)')}</label>
                        <input 
                          type="number" 
                          value={scanner.take_profit} 
                          onChange={(e) => scanner.take_profit = parseFloat(e.target.value) || 0}
                          style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Stop Loss ($)')}</label>
                        <input 
                          type="number" 
                          value={scanner.stop_loss} 
                          onChange={(e) => scanner.stop_loss = parseFloat(e.target.value) || 0}
                          style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ gridColumn: '1 / span 2', marginTop: '4px' }}>
                        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Trade Type')}</label>
                        <select
                          value={scanner.selected_trade_type}
                          onChange={(e) => scanner.selected_trade_type = e.target.value}
                          style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                        >
                          <option value="both">{localize('All Trade Types')}</option>
                          <option value="over_under">{localize('Over/Under Only')}</option>
                          <option value="even_odd">{localize('Even/Odd Only')}</option>
                          <option value="matches_differs">{localize('Matches/Differs Only')}</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={scanner.alternate_after_losses} 
                          onChange={(e) => scanner.alternate_after_losses = e.target.checked}
                          style={{ width: '14px', height: '14px', accentColor: '#4f8fff' }}
                        />
                        {localize('Alternate Strategy on Loss')}
                      </label>

                      {scanner.alternate_after_losses && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '22px' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{localize('Switch strategy after')}</span>
                          <input 
                            type="number" 
                            value={scanner.loss_threshold} 
                            onChange={(e) => scanner.loss_threshold = parseInt(e.target.value) || 1}
                            style={{ width: '50px', padding: '4px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '11px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>{localize('losses')}</span>
                        </div>
                      )}

                      {/* AI Full Automation Integration */}
                      <div style={{
                        background: scanner.is_auto_trading ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${scanner.is_auto_trading ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                        borderRadius: '8px',
                        padding: '10px',
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        color: '#cbd5e1',
                        marginTop: '4px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff' }}>
                            🤖 {localize('AI Full Automation')}
                          </span>
                          <button
                            onClick={() => scanner.setFullAiAutomation(!scanner.is_full_ai_automation)}
                            style={{
                              color: scanner.is_full_ai_automation ? '#fff' : '#cbd5e1',
                              fontWeight: 700,
                              fontSize: '10px',
                              background: scanner.is_full_ai_automation ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {scanner.is_full_ai_automation ? localize('ACTIVE') : localize('INACTIVE (Click to Enable)')}
                          </button>
                        </div>
                        {scanner.is_full_ai_automation && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{localize('Auto-Pause Protection')}:</span>
                              <span style={{ fontWeight: 700, color: '#ff444f' }}>
                                {localize('Smart Scan Active (< 60% pause)')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{localize('Trade Type Limitation')}:</span>
                              <span style={{ fontWeight: 700, color: '#4f8fff' }}>
                                {scanner.selected_trade_type === 'both' ? localize('Auto / Both') : scanner.selected_trade_type.replace('_', ' ').toUpperCase() + ' ONLY'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scanning Progress */}
                  <div className="section-card scanning-status">
                    <div className="scanning-info">
                      <span className={classNames('status-dot', { scanning: is_scanning })}></span>
                      <span className="status-message">
                        {is_scanning 
                          ? `${localize('Evaluating ticks (120 ticks window)')}... (${ticks_counter}/25)`
                          : localize('Ready to scan')}
                      </span>
                    </div>
                    <div className="progress-bar-bg">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: is_scanning ? `${(ticks_counter / 25) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>

                  {/* Live Signals Scrollable Area */}
                  <div className="section-card signals-area">
                    <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                      {localize('Active Signals')}
                    </span>
                    {scanner.signals.length === 0 ? (
                      <p className="no-signals-text">
                        {is_scanning ? localize('Scanning for opportunities...') : localize('Click scan to search setups')}
                      </p>
                    ) : (
                      <div className="signals-scroll-list">
                        {scanner.signals.map((sig, idx) => {
                          const isSelected = current_signal && current_signal.symbol === sig.symbol && current_signal.strategy === sig.strategy;
                          const isStrong = sig.confidence >= 0.9;
                          return (
                            <div
                              key={idx}
                              className={classNames('signal-row-item', { active: isSelected, strong: isStrong })}
                              onClick={() => {
                                scanner.current_signal = sig;
                                scanner.is_manual_selection = true;
                              }}
                            >
                              <div className="row-header">
                                <span className="row-symbol">{sig.symbol}</span>
                                <span className="row-strategy">{sig.strategy.replace('_', ' ').toUpperCase()}</span>
                                <span className="row-pct">{(sig.confidence * 100).toFixed(0)}%</span>
                              </div>
                              <p className="row-rec">{sig.details.recommendation}</p>
                              <p className="row-entry">Entry: {sig.details.entryCondition}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ) : activeTab === 'stats' ? (
                /* Signals Stats Sub Tab */
                <div className="section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="section-title" style={{ marginBottom: '8px', display: 'block' }}>
                    {localize('Market Stats (Volatility & Last Digits)')}
                  </span>
                  
                  {/* Strategy Selector Buttons for Stats Tab */}
                  <div className="stats-strategy-selector" style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {[
                      { key: 'even_odd', label: localize('Even Odd') },
                      { key: 'over_under', label: localize('Over Under') },
                      { key: 'differs', label: localize('Differs') },
                      { key: 'rise_fall', label: localize('Rise/Fall') },
                      { key: 'matches', label: localize('Matches') },
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setStatsStrategy(btn.key as any)}
                        style={{
                          background: statsStrategy === btn.key ? 'var(--brand-red-1, #ff444f)' : 'rgba(255, 255, 255, 0.05)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                          <th style={{ padding: '6px 4px' }}>{localize('Index')}</th>
                          <th style={{ padding: '6px 4px' }}>{localize('Last Price')}</th>
                          <th style={{ padding: '6px 4px', textAlign: 'center' }}>{localize('Digit')}</th>
                          <th style={{ padding: '6px 4px', textAlign: 'right' }}>{localize('Stats')}</th>
                          <th style={{ padding: '6px 4px', textAlign: 'right' }}>{localize('Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...available_symbols].map((sym: any) => {
                          const symbolKey = sym.symbol || sym.underlying_symbol;
                          const analysis = scanner.symbol_analysis[symbolKey];
                          const statsData = getStatsForStrategy(analysis, statsStrategy);

                          return {
                            sym,
                            symbolKey,
                            analysis,
                            statsData
                          };
                        })
                        .sort((a, b) => b.statsData.strength - a.statsData.strength)
                        .map(({ sym, symbolKey, analysis, statsData }) => {
                          return (
                            <tr key={symbolKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 600, color: '#cbd5e1' }}>
                                {sym.display_name.replace('Index', '')}
                              </td>
                              <td style={{ padding: '8px 4px', fontFamily: 'monospace' }}>
                                {analysis && analysis.lastQuote !== undefined 
                                  ? analysis.lastQuote.toFixed(sym.display_name.includes('1s') ? 2 : 4) 
                                  : 'Scanning...'}
                              </td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 'bold' }}>
                                {analysis && analysis.lastDigits && analysis.lastDigits.length > 0 ? (
                                  <span style={{ 
                                    background: 'rgba(79, 143, 255, 0.15)', 
                                    color: '#4f8fff', 
                                    padding: '2px 6px', 
                                    borderRadius: '4px' 
                                  }}>
                                    {analysis.lastDigits[analysis.lastDigits.length - 1]}
                                  </span>
                                ) : '-'}
                              </td>
                              <td style={{ padding: '8px 4px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>
                                {statsData.text}
                              </td>
                              <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                {analysis ? (
                                  <button
                                    onClick={() => handleLoadBotFromStats(sym, statsStrategy, statsData, analysis)}
                                    style={{
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      color: '#10b981',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      fontSize: '9px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#10b981';
                                      e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                                      e.currentTarget.style.color = '#10b981';
                                    }}
                                  >
                                    {localize('Load Bot')}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Dollarflipper Sub Tab */
                <div className="section-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="section-title" style={{ color: '#10b981', fontSize: '14px' }}>
                      {localize('Dollarflipper Challenge')}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                      Balance: ${Number(store.client.balance || 0).toFixed(2)}
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Target Profit ($)')}</label>
                      <input 
                        type="number" 
                        value={store.dollarflipper.target_profit} 
                        onChange={(e) => store.dollarflipper.setTargetProfit(parseFloat(e.target.value) || 0)}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Stake % of Capital')}</label>
                      <select
                        value={store.dollarflipper.stake_percentage}
                        onChange={(e) => store.dollarflipper.setStakePercentage(parseFloat(e.target.value) || 2)}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      >
                        <option value="2">2%</option>
                        <option value="3">3%</option>
                        <option value="4">4%</option>
                        <option value="5">5%</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Challenge Days')}</label>
                      <input 
                        type="number" 
                        value={store.dollarflipper.challenge_days} 
                        onChange={(e) => store.dollarflipper.setChallengeDays(parseInt(e.target.value) || 1)}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{localize('Sessions / Day')}</label>
                      <select
                        value={store.dollarflipper.sessions_per_day}
                        onChange={(e) => store.dollarflipper.setSessionsPerDay(parseInt(e.target.value) || 1)}
                        style={{ width: '100%', padding: '6px 8px', background: 'var(--general-section-1, #0f172a)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '12px' }}
                      >
                        <option value="1">1 Session</option>
                        <option value="2">2 Sessions</option>
                        <option value="3">3 Sessions</option>
                        <option value="4">4 Sessions</option>
                        <option value="24">24hrs (Continuous)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginTop: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>{localize('Completed Sessions:')}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                        {store.dollarflipper.completed_sessions} / {store.dollarflipper.challenge_days * store.dollarflipper.sessions_per_day}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          background: '#10b981', 
                          width: `${Math.min(100, (store.dollarflipper.completed_sessions / (store.dollarflipper.challenge_days * store.dollarflipper.sessions_per_day)) * 100)}%` 
                        }} 
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginTop: 'auto' }}>
                    {localize('Note: Dollarflipper automatically limits trades to Over (1,2,3) and Under (6,7,8) predictions to maintain high probability win rates.')}
                  </p>

                  <button
                    onClick={() => {
                      if (store.dollarflipper.is_running) {
                        store.dollarflipper.stopDollarflipper();
                      } else {
                        store.dollarflipper.startDollarflipper();
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: store.dollarflipper.is_running ? 'rgba(239, 68, 68, 0.15)' : '#10b981',
                      color: store.dollarflipper.is_running ? '#ef4444' : '#fff',
                      border: store.dollarflipper.is_running ? '1px solid #ef4444' : 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginTop: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {store.dollarflipper.is_running ? localize('Stop Dollarflipper') : localize('Start Compounding Challenge')}
                  </button>
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="footer-actions" style={{ flexShrink: 0, marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-normal-1, rgba(255,255,255,0.08))' }}>
              <button
                className="action-btn scan-btn"
                onClick={is_scanning ? stopScanning : startScanning}
              >
                {is_scanning ? localize('Stop') : localize('Scan Again')}
              </button>
              <button
                className="action-btn load-btn"
                onClick={loadBotWithStrategy}
                disabled={!current_signal}
              >
                {localize('Load Bot')}
              </button>
              <button
                className="action-btn run-btn"
                onClick={loadBotAndRun}
                disabled={!current_signal}
              >
                {localize('Load and Run')}
              </button>
            </div>
          </div>
        </DraggableResizeWrapper>
      )}
    </React.Fragment>
  );
});

export default Scanner;
