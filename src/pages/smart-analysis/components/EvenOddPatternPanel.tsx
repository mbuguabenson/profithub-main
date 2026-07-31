import { useState } from 'react';
import { PanelStats, TickData } from '../types/deriv';
import { BuyParams, BuyResult } from '../hooks/useDerivWS';
import { useAutoTrade, AutoTradeConfig } from '../hooks/useAutoTrade';
import TradeControls from './TradeControls';
import DigitBadge from './DigitBadge';

interface Props {
  stats: PanelStats;
  ticks: TickData[];
  buyContract: (p: BuyParams) => Promise<BuyResult>;
}

function getLastDigit(price: number) {
  const s = price.toFixed(2);
  return parseInt(s[s.length - 1], 10);
}

export default function EvenOddPatternPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [lastDigitCount, setLastDigitCount] = useState(3);
  const [checkType, setCheckType] = useState('Even');
  const [activeType, setActiveType] = useState<'DIGITEVEN' | 'DIGITODD'>('DIGITEVEN');

  const recentDigits = ticks.slice(-10).map(t => getLastDigit(t.quote));

  const streak = (() => {
    if (!recentDigits.length) return { count: 0, type: '' };
    const lastType = recentDigits[recentDigits.length - 1] % 2 === 0 ? 'Even' : 'Odd';
    let count = 1;
    for (let i = recentDigits.length - 2; i >= 0; i--) {
      const t = recentDigits[i] % 2 === 0 ? 'Even' : 'Odd';
      if (t === lastType) count++;
      else break;
    }
    return { count, type: lastType };
  })();

  const { state, toggle } = useAutoTrade({
    contractType: activeType,
    config,
    condition: {
      checkProb: false,
      probThreshold: 50,
      probOperator: '>',
      checkLastTicks: true,
      lastTickCount: lastDigitCount,
      tickCondition: checkType,
    },
    stats,
    ticks,
    buyContract,
    getProbability: (s) => activeType === 'DIGITEVEN' ? s.even : s.odd,
    checkCondition: (tks, cond) => {
      const digits = tks.slice(-cond.lastTickCount).map(t => getLastDigit(t.quote));
      if (digits.length < cond.lastTickCount) return false;
      return digits.every(d => {
        if (cond.tickCondition === 'Even') return d % 2 === 0;
        return d % 2 !== 0;
      });
    },
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Even/Odd</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div>
        <div className="panel-label mb-1.5">Last Digits Pattern</div>
        <div className="flex gap-1 flex-wrap">
          {recentDigits.map((d, i) => (
            <DigitBadge key={i} digit={d} type={d % 2 === 0 ? 'even' : 'odd'} />
          ))}
        </div>
        <div className="panel-text mt-1">
          E=Even, O=Odd | Current streak: <span className="font-semibold text-gray-700 dark:text-gray-300">{streak.count} {streak.type}</span>
        </div>
      </div>

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">Check if last</span>
          <input type="number" value={lastDigitCount} onChange={e => setLastDigitCount(Number(e.target.value))}
            className="w-10 panel-input-sm" min={1} />
          <span className="panel-text">digits are</span>
          <select value={checkType} onChange={e => setCheckType(e.target.value)} className="panel-select">
            <option>Even</option>
            <option>Odd</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="panel-badge-then">Then</span>
          <button onClick={() => setActiveType(activeType === 'DIGITEVEN' ? 'DIGITODD' : 'DIGITEVEN')}
            className="panel-btn-buy">
            Buy {activeType === 'DIGITEVEN' ? 'Even' : 'Odd'}
          </button>
        </div>
      </div>

      {state.lastResult && (
        <div className={state.lastResult === 'win' ? 'panel-result-win' : 'panel-result-loss'}>
          {state.status} | W:{state.wins} L:{state.losses}
        </div>
      )}

      <TradeControls config={config} onChange={setConfig} onToggle={toggle} isRunning={state.isRunning} />
    </div>
  );
}
