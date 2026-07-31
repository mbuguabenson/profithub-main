import { AutoTradeConfig } from '../hooks/useAutoTrade';

interface Props {
  config: AutoTradeConfig;
  onChange: (c: AutoTradeConfig) => void;
  onToggle: () => void;
  isRunning: boolean;
}

export default function TradeControls({ config, onChange, onToggle, isRunning }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {(['stake', 'ticks', 'martingale'] as const).map((field) => (
          <div key={field} className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider capitalize">{field}</label>
            <input
              type="number"
              value={config[field]}
              onChange={e => onChange({ ...config, [field]: parseFloat(e.target.value) || 0 })}
              step={field === 'stake' ? 0.1 : 1}
              min={field === 'stake' ? 0.35 : 1}
              className="text-sm font-medium text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
        ))}
      </div>

      <button
        onClick={onToggle}
        className={`w-full py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
          isRunning
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-red-500 hover:bg-red-600 text-white border-2 border-red-400'
        }`}
      >
        {isRunning ? 'Stop Auto Trading' : 'Start Auto Trading'}
      </button>
    </div>
  );
}
