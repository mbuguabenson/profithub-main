import { useEffect, useRef, useState, useCallback } from 'react';
import { TickData, DigitStats, PanelStats, ContractSettlement } from '../types/deriv';
import { childAuthManager } from '../lib/auth-sync';
import { getAppId, getSocketURL } from '@/components/shared/utils/config/config';

const DEFAULT_APP_ID = '1089';
const HISTORY_COUNT = 120;

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'authorized';

export interface BuyParams {
  contractType: string;
  stake: number;
  duration: number;
  barrier?: number;
}

export interface BuyResult {
  success: boolean;
  contractId?: number;
  error?: string;
  settlement?: ContractSettlement;
}

interface UseDerivWSReturn {
  status: WSStatus;
  currentPrice: number | null;
  ticks: TickData[];
  stats: PanelStats;
  balance: number | null;
  currency: string;
  accountId: string | null;
  connect: () => void;
  disconnect: () => void;
  buyContract: (params: BuyParams) => Promise<BuyResult>;
  setSymbol: (symbol: string) => void;
  symbol: string;
  tickCount: number;
  setTickCount: (n: number) => void;
}

type ProposalResolver = (r: { id: string; error?: string }) => void;
type BuyResolver = (r: BuyResult) => void;
type SettlementCallback = (result: ContractSettlement) => void;

function computeStats(ticks: TickData[], count: number): PanelStats {
  const recent = ticks.slice(-count);
  const lastDigits = recent.map(t => {
    const s = t.quote.toFixed(2);
    return parseInt(s[s.length - 1], 10);
  });

  let rise = 0;
  let fall = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].quote > recent[i - 1].quote) rise++;
    else if (recent[i].quote < recent[i - 1].quote) fall++;
  }
  const total = recent.length > 1 ? recent.length - 1 : 1;

  let even = 0;
  let odd = 0;
  lastDigits.forEach(d => {
    if (d % 2 === 0) even++;
    else odd++;
  });
  const dTotal = lastDigits.length || 1;

  let over5 = 0;
  let under5 = 0;
  lastDigits.forEach(d => {
    if (d > 5) over5++;
    else if (d < 5) under5++;
  });

  const freq: number[] = new Array(10).fill(0);
  lastDigits.forEach(d => freq[d]++);
  const digitFrequency: DigitStats[] = freq.map((c, i) => ({
    digit: i,
    count: c,
    percentage: dTotal > 0 ? (c / dTotal) * 100 : 0,
  }));

  return {
    rise: total > 0 ? (rise / total) * 100 : 0,
    fall: total > 0 ? (fall / total) * 100 : 0,
    even: dTotal > 0 ? (even / dTotal) * 100 : 0,
    odd: dTotal > 0 ? (odd / dTotal) * 100 : 0,
    over: dTotal > 0 ? (over5 / dTotal) * 100 : 0,
    under: dTotal > 0 ? (under5 / dTotal) * 100 : 0,
    digitFrequency,
  };
}

export function useDerivWS(): UseDerivWSReturn {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [symbol, setSymbolState] = useState('R_10');
  const [tickCount, setTickCount] = useState(HISTORY_COUNT);
  const [stats, setStats] = useState<PanelStats>({
    rise: 0, fall: 0, even: 0, odd: 0, over: 0, under: 0,
    digitFrequency: Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 })),
  });

  const tokenRef = useRef<string | null>(null);
  const appIdRef = useRef<string>(DEFAULT_APP_ID);
  const symbolRef = useRef(symbol);
  const pendingProposals = useRef(new Map<number, ProposalResolver>());
  const pendingBuys = useRef(new Map<number, BuyResolver>());
  const contractSubs = useRef(new Map<number, SettlementCallback>());
  const reqIdRef = useRef(1);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((obj: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(obj));
    }
  }, []);

  const subscribeToSymbol = useCallback((sym: string) => {
    send({ forget_all: 'ticks' });
    send({
      ticks_history: sym,
      adjust_start_time: 1,
      count: HISTORY_COUNT,
      end: 'latest',
      start: 1,
      style: 'ticks',
      subscribe: 1,
    });
  }, [send]);

  const connect = useCallback(async () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setStatus('connecting');
    setTicks([]);
    setCurrentPrice(null);

    let wsUrl = await getSocketURL();
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `wss://${wsUrl}/websockets/v3?app_id=${getAppId() || appIdRef.current}`;
    }

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      if (tokenRef.current) {
        send({ authorize: tokenRef.current });
      } else {
        subscribeToSymbol(symbolRef.current);
      }
    };

    socket.onmessage = (evt) => {
      const data = JSON.parse(evt.data);

      if (data.msg_type === 'authorize') {
        if (data.error) {
          childAuthManager.requestReauth();
          return;
        }
        setStatus('authorized');
        setAccountId(data.authorize?.loginid ?? null);
        setCurrency(data.authorize?.currency ?? 'USD');
        send({ balance: 1, subscribe: 1 });
        subscribeToSymbol(symbolRef.current);
      }

      if (data.msg_type === 'balance') {
        setBalance(parseFloat(data.balance?.balance ?? '0'));
      }

      if (data.msg_type === 'history') {
        const prices: TickData[] = (data.history?.prices ?? []).map(
          (p: number, i: number) => ({
            epoch: data.history.times[i],
            quote: p,
            symbol: symbolRef.current,
          })
        );
        setTicks(prices);
        if (prices.length > 0) setCurrentPrice(prices[prices.length - 1].quote);
        setStats(computeStats(prices, prices.length));
      }

      if (data.msg_type === 'tick') {
        const tick: TickData = {
          epoch: data.tick.epoch,
          quote: data.tick.quote,
          symbol: data.tick.symbol,
        };
        setTicks(prev => {
          const next = [...prev, tick].slice(-HISTORY_COUNT);
          setStats(computeStats(next, next.length));
          return next;
        });
        setCurrentPrice(tick.quote);
      }

      if (data.msg_type === 'proposal') {
        const reqId = data.req_id;
        const resolve = pendingProposals.current.get(reqId);
        if (resolve) {
          if (data.error) {
            resolve({ id: '', error: data.error.message });
          } else {
            resolve({ id: data.proposal?.id ?? '' });
          }
          pendingProposals.current.delete(reqId);
        }
      }

      if (data.msg_type === 'buy') {
        const reqId = data.req_id;
        const resolve = pendingBuys.current.get(reqId);
        if (resolve) {
          if (data.error) {
            resolve({ success: false, error: data.error.message });
          } else {
            const contractId = data.buy?.contract_id;
            resolve({ success: true, contractId });
          }
          pendingBuys.current.delete(reqId);
        }
      }

      if (data.msg_type === 'proposal_open_contract') {
        const contract = data.proposal_open_contract;
        const contractId = contract?.contract_id;
        const callback = contractSubs.current.get(contractId);
        if (callback && contract?.is_sold === 1) {
          const settlement: ContractSettlement = {
            contractId,
            isWin: contract.status === 'won',
            profit: parseFloat(contract.profit ?? '0'),
            payout: parseFloat(contract.payout ?? '0'),
            status: contract.status,
          };
          callback(settlement);
          contractSubs.current.delete(contractId);
          send({ forget: contract.id });
          childAuthManager.notifyTradeExecuted({
            contract_id: contractId,
            ...settlement,
            contract_type: contract.contract_type,
            entry_spot: contract.entry_spot,
            exit_spot: contract.exit_spot,
            purchase_price: parseFloat(contract.buy_price ?? '0'),
            symbol: contract.underlying,
          });
        }
      }
    };

    socket.onerror = () => setStatus('disconnected');
    socket.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(() => connect(), 5000);
    };
  }, [send, subscribeToSymbol]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    ws.current?.close();
    ws.current = null;
    setStatus('disconnected');
  }, []);

  const setSymbol = useCallback((sym: string) => {
    symbolRef.current = sym;
    setSymbolState(sym);
    setTicks([]);
    setCurrentPrice(null);
    setStats({
      rise: 0, fall: 0, even: 0, odd: 0, over: 0, under: 0,
      digitFrequency: Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 })),
    });
    subscribeToSymbol(sym);
  }, [subscribeToSymbol]);

  const buyContract = useCallback((params: BuyParams): Promise<BuyResult> => {
    return new Promise((resolve) => {
      const contractMap: Record<string, string> = {
        CALL: 'CALL', PUT: 'PUT',
        DIGITEVEN: 'DIGITEVEN', DIGITODD: 'DIGITODD',
        DIGITOVER: 'DIGITOVER', DIGITUNDER: 'DIGITUNDER',
        DIGITMATCH: 'DIGITMATCH', DIGITDIFF: 'DIGITDIFF',
      };

      const proposalParams: Record<string, unknown> = {
        proposal: 1,
        amount: params.stake,
        basis: 'stake',
        contract_type: contractMap[params.contractType] ?? params.contractType,
        currency: currency,
        duration: params.duration,
        duration_unit: 't',
        symbol: symbolRef.current,
      };

      if (params.barrier !== undefined) {
        proposalParams.barrier = String(params.barrier);
      }

      const proposalReqId = reqIdRef.current++;
      pendingProposals.current.set(proposalReqId, (proposalResult) => {
        if (proposalResult.error || !proposalResult.id) {
          resolve({ success: false, error: proposalResult.error ?? 'No proposal ID' });
          return;
        }

        const buyReqId = reqIdRef.current++;
        pendingBuys.current.set(buyReqId, (buyResult) => {
          if (!buyResult.success || !buyResult.contractId) {
            resolve(buyResult);
            return;
          }
          contractSubs.current.set(buyResult.contractId, (settlement) => {
            resolve({ ...buyResult, settlement });
          });
          send({
            proposal_open_contract: 1,
            contract_id: buyResult.contractId,
            subscribe: 1,
          });
        });

        send({
          buy: proposalResult.id,
          price: params.stake,
          req_id: buyReqId,
        });

        setTimeout(() => {
          if (pendingBuys.current.has(buyReqId)) {
            pendingBuys.current.delete(buyReqId);
            resolve({ success: false, error: 'Buy timed out' });
          }
        }, 30000);
      });

      send({ ...proposalParams, req_id: proposalReqId });

      setTimeout(() => {
        if (pendingProposals.current.has(proposalReqId)) {
          pendingProposals.current.delete(proposalReqId);
          resolve({ success: false, error: 'Proposal timed out' });
        }
      }, 15000);
    });
  }, [send, currency]);

  // Auth-sync: listen for INIT_AUTH / ACCOUNT_CHANGED from parent host
  useEffect(() => {
    childAuthManager.onAuthSync((payload) => {
      tokenRef.current = payload.token;
      if (payload.currency) setCurrency(payload.currency);
      if (ws.current?.readyState === WebSocket.OPEN) {
        send({ authorize: payload.token });
      }
    });
  }, [send]);

  // Initialize from URL hash / query params, then connect
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const token = hash.get('token') || query.get('token1') || query.get('token');
    const appId = hash.get('app_id') || query.get('app_id');
    if (token) tokenRef.current = token;
    if (appId) appIdRef.current = appId;

    connect();
    childAuthManager.signalReady();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, []);

  return {
    status,
    currentPrice,
    ticks,
    stats,
    balance,
    currency,
    accountId,
    connect,
    disconnect,
    buyContract,
    setSymbol,
    symbol,
    tickCount,
    setTickCount,
  };
}
