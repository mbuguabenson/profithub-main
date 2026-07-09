import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { api_base } from '@/external/bot-skeleton';
import './scanner.scss';

const Scanner = observer(() => {
  const { scanner } = useStore();
  const {
    is_open,
    is_scanning,
    selected_strategy,
    selected_symbols,
    current_signal,
    setScannerVisibility,
    setSelectedStrategy,
    setSelectedSymbols,
    startScanning,
    stopScanning,
    loadBotWithStrategy,
    loadBotAndRun,
  } = scanner;

  const [available_symbols, setAvailableSymbols] = useState<string[]>([]);

  // Load available symbols
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        if (api_base.active_symbols && api_base.active_symbols.length > 0) {
          const symbols = api_base.active_symbols
            .map((s: any) => s.symbol || s.underlying_symbol)
            .filter(Boolean);
          setAvailableSymbols(symbols);

          if (symbols.length > 0 && selected_symbols.length === 0) {
            // Select all symbols by default
            setSelectedSymbols(symbols);
          }
        }
      } catch (error) {
        console.error('[Scanner] Error fetching symbols:', error);
      }
    };

    fetchSymbols();
  }, []);

  const toggleSymbol = (symbol: string) => {
    const existingIndex = selected_symbols.indexOf(symbol);
    if (existingIndex > -1) {
      setSelectedSymbols(selected_symbols.filter(s => s !== symbol));
    } else {
      setSelectedSymbols([...selected_symbols, symbol]);
    }
  };

  const strategyTabs: { value: string; label: string }[] = [
    { value: 'even_odd', label: 'Even/Odd' },
    { value: 'over_under', label: 'Over/Under' },
    { value: 'matches', label: 'Matches' },
    { value: 'differs', label: 'Differs' },
    { value: 'rise_fall', label: 'Rise/Fall' },
  ];

  return (
    <React.Fragment>
      {is_open && (
        <DraggableResizeWrapper
          boundary=".main"
          header={localize('Entry Scanner')}
          onClose={setScannerVisibility}
          modalWidth={526}
          modalHeight={595}
          minWidth={526}
          minHeight={524}
          enableResizing
        >
          <div className="scanner-container">
            {/* Header Section */}
            <div className="scanner-header">
              <div className="recovery-engine">
                <span className="recovery-icon">ⓘ</span>
                <span className="recovery-text">RECOVERY ENGINE</span>
              </div>
              <div className="scanner-title">
                <h1>Digits Scanner</h1>
                <p>Scans markets and signals entry points</p>
              </div>
              <div className="scanner-icon">
                <svg viewBox="0 0 100 100" width="80" height="80">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="2" opacity="0.2" />
                  <circle cx="50" cy="50" r="30" fill="none" stroke="#fff" strokeWidth="2" opacity="0.4" />
                  <circle cx="50" cy="50" r="20" fill="none" stroke="#fff" strokeWidth="2" opacity="0.6" />
                  <circle cx="50" cy="50" r="8" fill="#4a9eff" />
                  <line x1="50" y1="10" x2="50" y2="30" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="50" y1="70" x2="50" y2="90" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="10" y1="50" x2="30" y2="50" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="70" y1="50" x2="90" y2="50" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="22" y1="22" x2="36" y2="36" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="64" y1="64" x2="78" y2="78" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="78" y1="22" x2="64" y2="36" stroke="#4a9eff" strokeWidth="2" />
                  <line x1="36" y1="64" x2="22" y2="78" stroke="#4a9eff" strokeWidth="2" />
                </svg>
              </div>
            </div>

            {/* Strategy Tabs */}
            <div className="strategy-tabs">
              {strategyTabs.map(tab => (
                <button
                  key={tab.value}
                  className={selected_strategy === tab.value ? 'active' : ''}
                  onClick={() => setSelectedStrategy(tab.value as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">SCAN DEPTH</p>
                <p className="stat-value">10K</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">MODE</p>
                <p className="stat-value">All Markets</p>
              </div>
              <div className="stat-card active">
                <p className="stat-label">SYMBOL COUNT</p>
                <p className="stat-value">{selected_symbols.length}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="info-grid">
              <div className="info-card">
                <p className="info-label">SELECTED MARKETS</p>
                <p className="info-value">
                  {selected_symbols.length > 0
                    ? `${selected_symbols.slice(0, 3).join(', ')}${selected_symbols.length > 3 ? ` +${selected_symbols.length - 3}` : ''}`
                    : 'All Markets'}
                </p>
              </div>
              <div className="info-card">
                <p className="info-label">TRADE TYPE</p>
                <p className="info-value">
                  {current_signal
                    ? current_signal.details.recommendation
                    : 'Waiting for scan'}
                </p>
              </div>
            </div>

            {/* Ready Status */}
            <div className="ready-status">
              <span className="ready-dot"></span>
              <span className="ready-text">
                {is_scanning ? 'Scanning markets...' : 'Ready to scan markets'}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                className="primary-btn"
                onClick={is_scanning ? stopScanning : startScanning}
              >
                {is_scanning ? localize('Stop Scanning') : localize('Deep Scan Markets')}
              </button>
              <button
                className="secondary-btn"
                onClick={loadBotWithStrategy}
                disabled={!current_signal}
              >
                ⋮ Load Scan
              </button>
            </div>

            {/* Signal Found Section (if current signal exists) */}
            {current_signal && (
              <div className="signal-found">
                <h3>
                  <span className="signal-dot"></span>
                  Signal Found
                </h3>
                <div className="signal-details">
                  <p className="signal-rec">
                    {current_signal.details.recommendation}
                  </p>
                  <p className="signal-entry">
                    Entry: {current_signal.details.entryCondition}
                  </p>
                  <div className="confidence-bar-container">
                    <p>Confidence</p>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${(current_signal.confidence * 100).toFixed(0)}%`
                        }}
                      />
                    </div>
                    <p className="confidence-value">
                      {(current_signal.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <p className="signal-symbol">
                    Symbol: {current_signal.symbol}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DraggableResizeWrapper>
      )}
    </React.Fragment>
  );
});

export default Scanner;
