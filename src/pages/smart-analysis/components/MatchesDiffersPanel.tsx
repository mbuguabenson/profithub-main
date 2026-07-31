import { useState } from 'react';
import { PanelStats, TickData } from '../types/deriv';
import { BuyParams, BuyResult } from '../hooks/useDerivWS';
import { useAutoTrade, AutoTradeConfig } from '../hooks/useAutoTrade';
import TradeControls from './TradeControls';
import DigitFrequencyChart from './DigitFrequencyChart';

interface Props {
  stats: PanelStats;
  ticks: TickData[];
  buyContract: (p: BuyParams) => Promise<BuyResult>;
}

export default function MatchesDiffersPanel({ stats, ticks, buyContract }: Props) {
  const [config, setConfig] = useState<AutoTradeConfig>({ stake: 0.5, ticks: 1, martingale: 1 });
  const [barrier, setBarrier] = useState(5);
  const [probThreshold, setProbThreshold] = useState(55);
  const [operator, setOperator] = useState<'>' | '<'>('>' as const);
  const [activeType, setActiveType] = useState<'DIGITMATCH' | 'DIGITDIFF'>('DIGITMATCH');

  const matchData = stats.digitFrequency.find(d => d.digit === barrier);
  const matchPct = matchData?.percentage ?? 0;
  const differPct = 100 - matchPct;

  const mostFrequent = stats.digitFrequency.reduce((a, b) => a.percentage > b.percentage ? a : b, stats.digitFrequency[0]);

  const { state, toggle } = useAutoTrade({
    contractType: activeType,
    config,
    condition: {
      checkProb: true,
      probThreshold,
      probOperator: operator,
      checkLastTicks: false,
      lastTickCount: 3,
      tickCondition: '',
      barrierDigit: barrier,
    },
    stats,
    ticks,
    buyContract,
    getProbability: () => activeType === 'DIGITMATCH' ? matchPct : differPct,
  });

  return (
    <div className="panel-card">
      <div className="flex items-center justify-between">
        <h3 className="panel-title">Matches/Differs</h3>
        <div className={`w-2 h-2 rounded-full ${state.isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`} />
      </div>

      {mostFrequent && (
        <div className="panel-text">
          Most frequent: <span className="font-bold text-gray-900 dark:text-gray-100">{mostFrequent.digit}</span>{' '}
          <span className="text-gray-400 dark:text-gray-500">({mostFrequent.percentage.toFixed(2)}%)</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="panel-text">Matches {barrier}</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{matchPct.toFixed(2)}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${matchPct}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="panel-text">Differs from {barrier}</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{differPct.toFixed(2)}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, differPct)}%` }} />
          </div>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">Barrier digit {barrier} appears {matchPct.toFixed(2)}% of the time</div>
      </div>

      <DigitFrequencyChart data={stats.digitFrequency} highlightDigit={barrier} highlightColor="bg-pink-500" />

      <div className="panel-inner">
        <div className="panel-label">Trading Condition</div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="panel-badge-if">If</span>
          <select value={activeType === 'DIGITMATCH' ? 'Matches' : 'Differs'} onChange={e => setActiveType(e.target.value === 'Matches' ? 'DIGITMATCH' : 'DIGITDIFF')} className="panel-select">
            <option>Matches</option>
            <option>Differs</option>
          </select>
          <span className="panel-text">Prob for</span>
          <input type="number" value={barrier} onChange={e => setBarrier(Number(e.target.value))}
            className="w-10 panel-input-sm" min={0} max={9} />
          <select value={operator} onChange={e => setOperator(e.target.value as '>' | '<')} className="panel-select-sm">
            <option>&gt;</option>
            <option>&lt;</option>
          </select>
          <input type="number" value={probThreshold} onChange={e => setProbThreshold(Number(e.target.value))}
            className="w-12 panel-input" />
          <span className="panel-text">%</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="panel-badge-then">Then</span>
          <button onClick={() => setActiveType(activeType === 'DIGITMATCH' ? 'DIGITDIFF' : 'DIGITMATCH')}
            className="panel-btn-buy">
            Buy {activeType === 'DIGITMATCH' ? 'Matches' : 'Differs'}
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
