import { useState } from 'react';
import { PanelStats, TickData } from '../types/deriv';
import { BuyParams, BuyResult } from '../hooks/useDerivWS';
import { useAutoTrade, AutoTradeConfig } from '../hooks/useAutoTrade';
import StatBar from './StatBar';
import TradeControls from './TradeControls';

interface Props {
  stats: PanelStats;
  ticks: TickData[];
  buyContract: (p: BuyParams) => Promise<BuyResult>;
}

function getLastDigit(price: number) {
  const s = price.toFixed(2);
  return parseInt(s[s.length - 1], 10);
}

export default function EvenOddProbPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [probThreshold, setProbThreshold] = useState(60);
  const [operator, setOperator] = useState<'>' | '<'>('>' as const);
  const [lastTicks, setLastTicks] = useState(3);
  const [checkLastTicks, setCheckLastTicks] = useState(false);
  const [tickCondition, setTickCondition] = useState('Even');
  const [activeType, setActiveType] = useState<'DIGITEVEN' | 'DIGITODD'>('DIGITEVEN');

  const recommendation = stats.odd > stats.even ? 'ODD' : 'EVEN';
  const recommendationProb = Math.max(stats.odd, stats.even);

  const { state, toggle } = useAutoTrade({
    contractType: activeType,
    config,
    condition: {
      checkProb: true,
      probThreshold,
      probOperator: operator,
      checkLastTicks,
      lastTickCount: lastTicks,
      tickCondition,
    },
    stats,
    ticks,
    buyContract,
    getProbability: (s) => activeType === 'DIGITEVEN' ? s.even : s.odd,
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Even/Odd</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
        <span className="panel-text">Recommendation</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${recommendation === 'ODD' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {recommendation}
          </span>
          <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
            {recommendationProb.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <StatBar label="Even" value={stats.even} color="bg-blue-500" />
        <StatBar label="Odd" value={stats.odd} color="bg-purple-500" />
      </div>

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">If</span>
          <select value={activeType === 'DIGITEVEN' ? 'Even' : 'Odd'} onChange={e => setActiveType(e.target.value === 'Even' ? 'DIGITEVEN' : 'DIGITODD')} className="panel-select">
            <option>Even</option>
            <option>Odd</option>
          </select>
          <span className="panel-text">Prob</span>
          <select value={operator} onChange={e => setOperator(e.target.value as '>' | '<')} className="panel-select-sm">
            <option>&gt;</option>
            <option>&lt;</option>
          </select>
          <input type="number" value={probThreshold} onChange={e => setProbThreshold(Number(e.target.value))}
            className="w-12 panel-input" />
          <span className="panel-text">%</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={checkLastTicks} onChange={e => setCheckLastTicks(e.target.checked)} className="w-3 h-3" />
            <span className="panel-text">and last</span>
          </label>
          <input type="number" value={lastTicks} onChange={e => setLastTicks(Number(e.target.value))}
            className="w-10 panel-input-sm" min={1} />
          <span className="panel-text">ticks are</span>
          <select value={tickCondition} onChange={e => setTickCondition(e.target.value)} className="panel-select">
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
