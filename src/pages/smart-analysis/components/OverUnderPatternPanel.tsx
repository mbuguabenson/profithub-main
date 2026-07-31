import { useState } from 'react';
import { PanelStats, TickData } from '../types/deriv';
import { BuyParams, BuyResult } from '../hooks/useDerivWS';
import { useAutoTrade, AutoTradeConfig } from '../hooks/useAutoTrade';
import TradeControls from './TradeControls';
import DigitBadge from './DigitBadge';
import DigitFrequencyChart from './DigitFrequencyChart';

interface Props {
  stats: PanelStats;
  ticks: TickData[];
  buyContract: (p: BuyParams) => Promise<BuyResult>;
}

function getLastDigit(price: number) {
  const s = price.toFixed(2);
  return parseInt(s[s.length - 1], 10);
}

export default function OverUnderPatternPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [barrier, setBarrier] = useState(5);
  const [lastDigitCount, setLastDigitCount] = useState(3);
  const [checkType, setCheckType] = useState('Over');
  const [activeType, setActiveType] = useState<'DIGITOVER' | 'DIGITUNDER'>('DIGITOVER');

  const recentDigits = ticks.slice(-10).map(t => getLastDigit(t.quote));

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
      barrierDigit: barrier,
    },
    stats,
    ticks,
    buyContract,
    getProbability: (s) => activeType === 'DIGITOVER' ? s.over : s.under,
    checkCondition: (tks, cond) => {
      const digits = tks.slice(-cond.lastTickCount).map(t => getLastDigit(t.quote));
      if (digits.length < cond.lastTickCount) return false;
      const b = cond.barrierDigit ?? 5;
      return digits.every(d => {
        if (cond.tickCondition === 'Over') return d > b;
        if (cond.tickCondition === 'Under') return d < b;
        return d === b;
      });
    },
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Over/Under</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div>
        <div className="panel-label mb-1.5">Last Digits Pattern</div>
        <div className="flex gap-1 flex-wrap">
          {recentDigits.map((d, i) => (
            <DigitBadge key={i} digit={d} barrier={barrier} />
          ))}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">O=Over (&gt;{barrier}), E=Equal (={barrier}), U=Under (&lt;{barrier})</div>
      </div>

      <DigitFrequencyChart data={stats.digitFrequency} />

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">Check if last</span>
          <input type="number" value={lastDigitCount} onChange={e => setLastDigitCount(Number(e.target.value))}
            className="w-10 panel-input-sm" min={1} />
          <span className="panel-text">digits are</span>
          <select value={checkType} onChange={e => setCheckType(e.target.value)} className="panel-select">
            <option>Over</option>
            <option>Under</option>
            <option>Equal</option>
          </select>
          <input type="number" value={barrier} onChange={e => setBarrier(Number(e.target.value))}
            className="w-10 panel-input-sm" min={0} max={9} />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="panel-badge-then">Then</span>
          <button onClick={() => setActiveType(activeType === 'DIGITOVER' ? 'DIGITUNDER' : 'DIGITOVER')}
            className="panel-btn-buy">
            Buy {activeType === 'DIGITOVER' ? 'Over' : 'Under'}
          </button>
          <span className="panel-text">digit {barrier}</span>
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
