import { useEffect, useState } from 'react';
import { useDerivWS } from './hooks/useDerivWS';
import { childAuthManager } from './lib/auth-sync';
import Header from './components/Header';
import RiseFallPanel from './components/RiseFallPanel';
import EvenOddProbPanel from './components/EvenOddProbPanel';
import EvenOddPatternPanel from './components/EvenOddPatternPanel';
import OverUnderProbPanel from './components/OverUnderProbPanel';
import OverUnderPatternPanel from './components/OverUnderPatternPanel';
import MatchesDiffersPanel from './components/MatchesDiffersPanel';
import './index.css';

type Theme = 'light' | 'dark';

export default function App() {
  const {
    status,
    currentPrice,
    ticks,
    stats,
    balance,
    currency,
    accountId,
    connect,
    setSymbol,
    symbol,
    tickCount,
    setTickCount,
    buyContract,
  } = useDerivWS();

  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    childAuthManager.onThemeChange((t) => setTheme(t));
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const initial = hash.get('theme') || query.get('theme');
    if (initial === 'dark' || initial === 'light') setTheme(initial);
  }, []);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
      <Header
        symbol={symbol}
        onSymbolChange={setSymbol}
        tickCount={tickCount}
        onTickCountChange={setTickCount}
        currentPrice={currentPrice}
        status={status}
        onReconnect={connect}
        balance={balance}
        currency={currency}
        accountId={accountId}
      />

      <div className="p-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <RiseFallPanel stats={stats} ticks={ticks} buyContract={buyContract} />
          <EvenOddProbPanel stats={stats} ticks={ticks} buyContract={buyContract} />
          <EvenOddPatternPanel stats={stats} ticks={ticks} buyContract={buyContract} />
          <OverUnderProbPanel stats={stats} ticks={ticks} buyContract={buyContract} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <OverUnderPatternPanel stats={stats} ticks={ticks} buyContract={buyContract} />
          <MatchesDiffersPanel stats={stats} ticks={ticks} buyContract={buyContract} />
        </div>

        {ticks.length === 0 && status !== 'disconnected' && (
          <div className="flex items-center justify-center mt-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading tick data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
