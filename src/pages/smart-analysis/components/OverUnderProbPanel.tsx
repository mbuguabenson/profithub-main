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

export default function OverUnderProbPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [barrier, setBarrier] = useState(5);
  const [probThreshold, setProbThreshold] = useState(55);
  const [operator, setOperator] = useState<'>' | '<'>('>' as const);
  const [lastTicks, setLastTicks] = useState(3);
  const [checkLastTicks, setCheckLastTicks] = useState(false);
  const [tickCondition, setTickCondition] = useState('Over');
  const [activeType, setActiveType] = useState<'DIGITOVER' | 'DIGITUNDER'>('DIGITOVER');

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
      barrierDigit: barrier,
    },
    stats,
    ticks,
    buyContract,
    getProbability: (s) => activeType === 'DIGITOVER' ? s.over : s.under,
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Over/Under</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div className="flex items-center gap-2 panel-text">
        <span>Barrier</span>
        <input type="number" value={barrier} onChange={e => setBarrier(Number(e.target.value))}
          className="w-10 panel-input-sm" min={0} max={9} />
        <span className="text-gray-400 dark:text-gray-500">Under: 0-{barrier - 1}, Equals: {barrier}, Over: {barrier + 1}-9</span>
      </div>

      <div className="flex flex-col gap-2">
        <StatBar label="Over" value={stats.over} color="bg-teal-500" />
        <StatBar label="Under" value={stats.under} color="bg-amber-500" />
      </div>

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">If</span>
          <select value={activeType === 'DIGITOVER' ? 'Over' : 'Under'} onChange={e => setActiveType(e.target.value === 'Over' ? 'DIGITOVER' : 'DIGITUNDER')} className="panel-select">
            <option>Over</option>
            <option>Under</option>
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
          <span className="panel-text">ticks</span>
          <select value={tickCondition} onChange={e => setTickCondition(e.target.value)} className="panel-select">
            <option>Over</option>
            <option>Under</option>
          </select>
          <span className="panel-text">{barrier}</span>
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
