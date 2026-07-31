import { DERIV_SYMBOLS } from '../types/deriv';

interface HeaderProps {
  symbol: string;
  onSymbolChange: (s: string) => void;
  tickCount: number;
  onTickCountChange: (n: number) => void;
  currentPrice: number | null;
  status: string;
  onReconnect: () => void;
  balance: number | null;
  currency: string;
  accountId: string | null;
}

export default function Header({
  symbol, onSymbolChange, tickCount, onTickCountChange,
  currentPrice, status, onReconnect, balance, currency, accountId,
}: HeaderProps) {
  const isConnected = status === 'connected' || status === 'authorized';
  const isAuthorized = status === 'authorized';

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
      <div className="px-4 py-2.5 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Symbol</label>
            <select
              value={symbol}
              onChange={e => onSymbolChange(e.target.value)}
              className="text-sm font-medium text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[180px]"
            >
              {DERIV_SYMBOLS.map(s => (
                <option key={s.symbol} value={s.symbol}>{s.display_name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Ticks</label>
            <input
              type="number"
              value={tickCount}
              onChange={e => onTickCountChange(Math.max(10, parseInt(e.target.value) || 120))}
              className="w-20 text-sm font-medium text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-md px-2 py-1 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={10}
              max={500}
            />
          </div>

          {currentPrice !== null && (
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Price:</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{currentPrice.toFixed(2)}</span>
            </div>
          )}

          {isAuthorized && balance !== null && (
            <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5">
              <span className="text-xs text-green-600 dark:text-green-400 font-bold">$</span>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">Balance:</span>
              <span className="text-sm font-bold text-green-700 dark:text-green-300 tabular-nums">
                {balance.toFixed(2)} {currency}
              </span>
              {accountId && <span className="text-xs text-green-500 dark:text-green-500 ml-1">({accountId})</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' :
              status === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span className={`text-xs font-medium ${
              isConnected ? 'text-green-600 dark:text-green-400' :
              status === 'connecting' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'
            }`}>
              {status === 'authorized' ? 'Authorized' :
               status === 'connected' ? 'Connected' :
               status === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>

          <button
            onClick={onReconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <span>🔄</span>
            Reconnect
          </button>
        </div>
      </div>
    </div>
  );
}
