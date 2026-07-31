export interface TickData {
  epoch: number;
  quote: number;
  symbol: string;
}

export interface DigitStats {
  digit: number;
  count: number;
  percentage: number;
}

export interface ContractResult {
  id: string;
  type: string;
  profit: number;
  isWin: boolean;
}

export interface ContractSettlement {
  contractId: number;
  isWin: boolean;
  profit: number;
  payout: number;
  status: string;
}

export interface TradingCondition {
  enabled: boolean;
  threshold: number;
  operator: '>' | '<';
  lastTicks: number;
  tickDirection?: 'Rising' | 'Falling';
}

export interface AutoTradeConfig {
  stake: number;
  ticks: number;
  martingale: number;
  condition: TradingCondition;
  isRunning: boolean;
}

export interface PanelStats {
  rise: number;
  fall: number;
  even: number;
  odd: number;
  over: number;
  under: number;
  digitFrequency: DigitStats[];
}

export type ContractType =
  | 'CALL'
  | 'PUT'
  | 'DIGITEVEN'
  | 'DIGITODD'
  | 'DIGITOVER'
  | 'DIGITUNDER'
  | 'DIGITMATCH'
  | 'DIGITDIFF';

export interface DerivSymbol {
  symbol: string;
  display_name: string;
}

export const DERIV_SYMBOLS: DerivSymbol[] = [
  { symbol: 'R_10', display_name: 'Volatility 10 Index' },
  { symbol: 'R_25', display_name: 'Volatility 25 Index' },
  { symbol: 'R_50', display_name: 'Volatility 50 Index' },
  { symbol: 'R_75', display_name: 'Volatility 75 Index' },
  { symbol: 'R_100', display_name: 'Volatility 100 Index' },
  { symbol: '1HZ10V', display_name: 'Volatility 10 (1s) Index' },
  { symbol: '1HZ25V', display_name: 'Volatility 25 (1s) Index' },
  { symbol: '1HZ50V', display_name: 'Volatility 50 (1s) Index' },
  { symbol: '1HZ75V', display_name: 'Volatility 75 (1s) Index' },
  { symbol: '1HZ100V', display_name: 'Volatility 100 (1s) Index' },
];
