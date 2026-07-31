import { useState, useRef, useCallback } from 'react';
import { BuyParams, BuyResult } from './useDerivWS';
import { PanelStats, TickData, ContractType } from '../types/deriv';

export interface AutoTradeState {
  isRunning: boolean;
  currentStake: number;
  wins: number;
  losses: number;
  totalProfit: number;
  lastResult: 'win' | 'loss' | null;
  status: string;
}

export interface AutoTradeConfig {
  stake: number;
  ticks: number;
  martingale: number;
}

export interface TradeCondition {
  checkProb: boolean;
  probThreshold: number;
  probOperator: '>' | '<';
  checkLastTicks: boolean;
  lastTickCount: number;
  tickCondition: string;
  barrierDigit?: number;
}

interface UseAutoTradeOptions {
  contractType: string;
  config: AutoTradeConfig;
  condition: TradeCondition;
  stats: PanelStats;
  ticks: TickData[];
  buyContract: (p: BuyParams) => Promise<BuyResult>;
  getProbability: (stats: PanelStats) => number;
  checkCondition?: (ticks: TickData[], condition: TradeCondition) => boolean;
}

export function useAutoTrade({
  contractType,
  config,
  condition,
  stats,
  ticks,
  buyContract,
  getProbability,
  checkCondition,
}: UseAutoTradeOptions) {
  const [state, setState] = useState<AutoTradeState>({
    isRunning: false,
    currentStake: config.stake,
    wins: 0,
    losses: 0,
    totalProfit: 0,
    lastResult: null,
    status: 'Idle',
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const configRef = useRef(config);
  configRef.current = config;
  const conditionRef = useRef(condition);
  conditionRef.current = condition;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const ticksRef = useRef(ticks);
  ticksRef.current = ticks;
  const isRunningRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shouldTrade = useCallback((): boolean => {
    const prob = getProbability(statsRef.current);
    const cond = conditionRef.current;

    if (cond.checkProb) {
      const passes = cond.probOperator === '>'
        ? prob > cond.probThreshold
        : prob < cond.probThreshold;
      if (!passes) return false;
    }

    if (cond.checkLastTicks && checkCondition) {
      const passes = checkCondition(ticksRef.current, cond);
      if (!passes) return false;
    }

    return true;
  }, [getProbability, checkCondition]);

  const executeTrade = useCallback(async () => {
    if (!isRunningRef.current) return;
    if (!shouldTrade()) {
      setState(prev => ({ ...prev, status: 'Waiting for condition...' }));
      return;
    }

    const stake = stateRef.current.currentStake;
    setState(prev => ({ ...prev, status: `Buying at stake ${stake.toFixed(2)}...` }));

    const result = await buyContract({
      contractType,
      stake,
      duration: configRef.current.ticks,
      barrier: conditionRef.current.barrierDigit,
    });

    if (result.success && result.settlement) {
      const { isWin, profit } = result.settlement;
      if (isWin) {
        setState(prev => ({
          ...prev,
          wins: prev.wins + 1,
          totalProfit: prev.totalProfit + profit,
          lastResult: 'win',
          currentStake: configRef.current.stake,
          status: `Won! +${profit.toFixed(2)}`,
        }));
      } else {
        const nextStake = stake * configRef.current.martingale;
        setState(prev => ({
          ...prev,
          losses: prev.losses + 1,
          totalProfit: prev.totalProfit + profit,
          lastResult: 'loss',
          currentStake: nextStake,
          status: `Lost ${profit.toFixed(2)}`,
        }));
      }
    } else if (result.success) {
      setState(prev => ({ ...prev, status: 'Contract open, awaiting settlement...' }));
    } else {
      setState(prev => ({ ...prev, status: `Failed: ${result.error ?? 'unknown'}` }));
    }
  }, [contractType, buyContract, shouldTrade]);

  const start = useCallback(() => {
    isRunningRef.current = true;
    setState(prev => ({
      ...prev,
      isRunning: true,
      currentStake: config.stake,
      status: 'Running...',
    }));
    intervalRef.current = setInterval(executeTrade, 3000);
  }, [config.stake, executeTrade]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isRunning: false, status: 'Stopped' }));
  }, []);

  const toggle = useCallback(() => {
    if (stateRef.current.isRunning) stop();
    else start();
  }, [start, stop]);

  return { state, toggle, stop };
}
