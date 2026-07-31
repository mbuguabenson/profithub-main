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

export default function RiseFallPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [probThreshold, setProbThreshold] = useState(65);
  const [operator, setOperator] = useState<'>' | '<'>('>' as const);
  const [lastTicks, setLastTicks] = useState(3);
  const [direction, setDirection] = useState<'Rising' | 'Falling'>('Rising');
  const [checkLastTicks, setCheckLastTicks] = useState(false);
  const [activeType, setActiveType] = useState<'CALL' | 'PUT'>('CALL');

  const { state, toggle } = useAutoTrade({
    contractType: activeType,
    config,
    condition: {
      checkProb: true,
      probThreshold,
      probOperator: operator,
      checkLastTicks,
      lastTickCount: lastTicks,
      tickCondition: direction,
    },
    stats,
    ticks,
    buyContract,
    getProbability: (s) => activeType === 'CALL' ? s.rise : s.fall,
    checkCondition: (tks, cond) => {
      const recent = tks.slice(-cond.lastTickCount);
      if (recent.length < 2) return false;
      for (let i = 1; i < recent.length; i++) {
        if (cond.tickCondition === 'Rising' && recent[i].quote <= recent[i - 1].quote) return false;
        if (cond.tickCondition === 'Falling' && recent[i].quote >= recent[i - 1].quote) return false;
      }
      return true;
    },
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Rise/Fall</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      <div className="flex flex-col gap-2">
        <StatBar label="Rise" value={stats.rise} color="bg-green-500" />
        <StatBar label="Fall" value={stats.fall} color="bg-red-400" />
      </div>

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">If</span>
          <select
            value={activeType === 'CALL' ? 'Rise' : 'Fall'}
            onChange={e => setActiveType(e.target.value === 'Rise' ? 'CALL' : 'PUT')}
            className="panel-select"
          >
            <option>Rise</option>
            <option>Fall</option>
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
          <select value={direction} onChange={e => setDirection(e.target.value as 'Rising' | 'Falling')} className="panel-select">
            <option>Rising</option>
            <option>Falling</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="panel-badge-then">Then</span>
          <button
            onClick={() => setActiveType(activeType === 'CALL' ? 'PUT' : 'CALL')}
            className="panel-btn-buy"
          >
            Buy {activeType === 'CALL' ? 'Rise' : 'Fall'}
          </button>
        </div>
      </div>

      {state.lastResult && (
        <div className={state.lastResult === 'win' ? 'panel-result-win' : 'panel-result-loss'}>
          {state.status} | W:{state.wins} L:{state.losses} | P/L: {state.totalProfit.toFixed(2)}
        </div>
      )}

      <TradeControls config={config} onChange={setConfig} onToggle={toggle} isRunning={state.isRunning} />
    </div>
  );
}
