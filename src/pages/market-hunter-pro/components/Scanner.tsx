import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChevronDown,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Download,
  Play,
  Check,
  AlertTriangle,
  Layers,
  Target,
  Sparkles,
  BarChart2,
  Search,
  X,
  Radar,
  Sliders,
} from 'lucide-react';
import MarketMonitor from './MarketMonitor';
import { useDerivWS } from '../hooks/useDerivWS';
import { analyzeMultiWindow, MultiWindowAnalysis } from '../lib/analysis';
import { generateCombinedRankedSignals, Signal, SignalType } from '../lib/signals';
import { SYMBOLS } from '../lib/symbols';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { generateBotXML } from '@/utils/bot-xml-generator';
import { FullAiTradeEngine } from '@/utils/full-ai-trade-engine';
import '../index.css';


type Step = 'orb' | 'open' | 'scanning';
type PanelTab = 'scanner' | 'monitor';

const TRADE_TYPES = [
  { id: 'over_under', label: 'Over / Under', types: ['over_under', 'pro_over_under', 'under_7', 'over_2'] as SignalType[] },
  { id: 'even_odd', label: 'Even / Odd', types: ['even_odd', 'pro_even_odd'] as SignalType[] },
  { id: 'matches', label: 'Matches', types: ['matches'] as SignalType[] },
  { id: 'differs', label: 'Differs', types: ['differs'] as SignalType[] },
  { id: 'rise_fall', label: 'Rise / Fall', types: ['rise_fall'] as SignalType[] },
  { id: 'pro_over_under', label: 'Pro Over / Under', types: ['pro_over_under', 'under_7', 'over_2'] as SignalType[] },
  { id: 'pro_even_odd', label: 'Pro Even / Odd', types: ['pro_even_odd'] as SignalType[] },
  { id: 'all', label: 'All Strategies', types: ['over_under', 'even_odd', 'matches', 'differs', 'rise_fall', 'pro_over_under', 'pro_even_odd', 'under_7', 'over_2'] as SignalType[] },
];

// ─── Draggable Orb Hook ───────────────────────────────────────────────────────
function useDraggableOrb() {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const raf = useRef(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    dragging.current = true;
    setIsDragging(true);
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    lastTime.current = performance.now();
    velocity.current = { x: 0, y: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const now = performance.now();
    const dt = Math.max(now - lastTime.current, 1);
    const newX = e.clientX - offset.current.x;
    const newY = e.clientY - offset.current.y;
    velocity.current = {
      x: ((newX - pos.current.x) / dt) * 16,
      y: ((newY - pos.current.y) / dt) * 16,
    };
    pos.current = { x: newX, y: newY };
    lastTime.current = now;
    setPosition({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);

    // Spring physics
    let vx = velocity.current.x;
    let vy = velocity.current.y;
    let px = pos.current.x;
    let py = pos.current.y;
    const decay = 0.92;

    const animate = () => {
      if (dragging.current) return;
      vx *= decay;
      vy *= decay;
      px += vx;
      py += vy;

      // Boundary bounce
      const w = window.innerWidth;
      const h = window.innerHeight;
      const size = 72;
      if (px < 0) { px = 0; vx = Math.abs(vx) * 0.5; }
      if (px > w - size) { px = w - size; vx = -Math.abs(vx) * 0.5; }
      if (py < 0) { py = 0; vy = Math.abs(vy) * 0.5; }
      if (py > h - size) { py = h - size; vy = -Math.abs(vy) * 0.5; }

      pos.current = { x: px, y: py };
      setPosition({ x: px, y: py });

      if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
        raf.current = requestAnimationFrame(animate);
      }
    };
    raf.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Center the orb initially
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = w / 2 - 36;
    const y = h / 2 - 36;
    pos.current = { x, y };
    setPosition({ x, y });
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return { ref, position, isDragging, onPointerDown, onPointerMove, onPointerUp };
}

// ─── StatBar Component ────────────────────────────────────────────────────────
function StatBar({
  label, leftLabel, rightLabel, leftValue, leftColor, rightColor,
}: {
  label: string; leftLabel: string; rightLabel: string;
  leftValue: number; leftColor: string; rightColor: string;
}) {
  const rightValue = 100 - leftValue;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-white/40">{leftValue.toFixed(1)}% / {rightValue.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-black w-10 text-right" style={{ color: leftColor }}>{leftLabel}</span>
        <div className="flex-1 h-3 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-700" style={{ width: `${leftValue}%`, background: leftColor }} />
          <div className="absolute right-0 top-0 h-full rounded-full transition-all duration-700" style={{ width: `${rightValue}%`, background: rightColor }} />
        </div>
        <span className="text-xs font-black w-10" style={{ color: rightColor }}>{rightLabel}</span>
      </div>
    </div>
  );
}

function DigitStat({ label, digit, percentage, color, badge }: { label: string; digit: number; percentage: number; color: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg shrink-0"
        style={{ background: color, boxShadow: `0 0 12px ${color}66` }}>
        {digit}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{label}</span>
          {badge && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white" style={{ background: color }}>
              {badge}
            </span>
          )}
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(percentage, 100)}%`, background: color }} />
        </div>
      </div>
      <span className="text-sm font-black text-white/80 shrink-0">{percentage.toFixed(1)}%</span>
    </div>
  );
}

// ─── StatsCard ────────────────────────────────────────────────────────────────
function StatsCard({ mwa, tradeTypeId }: { mwa: MultiWindowAnalysis; tradeTypeId: string }) {
  const [collapsed, setCollapsed] = useState(true);
  const a = mwa.w1000;
  const a120 = mwa.w120;
  const a15 = mwa.w15;

  const alignColor = mwa.alignmentScore >= 80 ? '#10b981' : mwa.alignmentScore >= 60 ? '#f59e0b' : '#ef4444';
  const alignLabel = mwa.alignmentScore >= 80 ? 'Strong' : mwa.alignmentScore >= 60 ? 'Moderate' : 'Weak';

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10"
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', backdropFilter: 'blur(12px)' }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between select-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))' }}
      >
        <div className="flex items-center gap-2">
          <Layers size={13} style={{ color: alignColor }} />
          <span className="text-xs font-bold text-white/70">Window Alignment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(['1000', '120', '15'] as const).map((w) => {
              const aw = w === '1000' ? a : w === '120' ? a120 : a15;
              const active = aw.totalTicks >= parseInt(w) * 0.5;
              return (
                <span key={w} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${active ? 'text-white' : 'bg-white/5 text-white/30'}`}
                  style={active ? { background: alignColor } : {}}>
                  {w}T
                </span>
              );
            })}
          </div>
          <span className="text-xs font-black" style={{ color: alignColor }}>{mwa.alignmentScore}%</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: alignColor }}>{alignLabel}</span>
          <ChevronDown size={12} className={`text-white/40 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      <div className="h-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full transition-all duration-700" style={{ width: `${mwa.alignmentScore}%`, background: `linear-gradient(90deg, ${alignColor}, ${alignColor}cc)` }} />
      </div>

      {!collapsed && (
        <>
          <div className="p-4 space-y-4">
            {tradeTypeId === 'even_odd' && (
              <StatBar label="Even / Odd Split" leftLabel="EVEN" rightLabel="ODD" leftValue={a.evenPercentage} leftColor="#6366f1" rightColor="#ec4899" />
            )}
            {tradeTypeId === 'over_under' && (
              <StatBar label="Over / Under 4.5" leftLabel="OVER" rightLabel="UNDR" leftValue={a.highPercentage} leftColor="#0ea5e9" rightColor="#f97316" />
            )}
            {tradeTypeId === 'matches' && (
              <DigitStat label="Strongest Digit" digit={a.powerIndex.strongest} percentage={a.digitFrequencies[a.powerIndex.strongest]?.percentage ?? 0} color="#f5c542" badge="MATCHES" />
            )}
            {tradeTypeId === 'differs' && (
              <DigitStat label="Weakest Digit" digit={a.powerIndex.weakest} percentage={a.digitFrequencies[a.powerIndex.weakest]?.percentage ?? 0} color="#64748b" badge="DIFFERS" />
            )}
            {tradeTypeId === 'rise_fall' && (() => {
              const q = a.last10quotes;
              const rising = q.length >= 2 && q[q.length - 1] >= q[0];
              return (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Trend Direction</span>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: rising ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}>
                    {rising ? <TrendingUp size={14} className="text-green-400" /> : <TrendingDown size={14} className="text-red-400" />}
                    <span className="text-xs font-black" style={{ color: rising ? '#10b981' : '#ef4444' }}>{rising ? 'RISING' : 'FALLING'}</span>
                  </div>
                </div>
              );
            })()}

            {mwa.lastDigit !== null && (
              <div className="flex items-center justify-between pt-1 border-t border-white/10">
                <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Last Digit</span>
                <div className="flex items-center gap-1.5">
                  <Target size={12} className="text-white/40" />
                  <span className="text-base font-black text-white/80">{mwa.lastDigit}</span>
                  <span className="text-[9px] font-bold text-white/40">({mwa.lastDigit % 2 === 0 ? 'EVEN' : 'ODD'} · {mwa.lastDigit >= 5 ? 'HIGH' : 'LOW'})</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {([
                { label: '1000T', a: a, color: '#6366f1' },
                { label: '120T', a: a120, color: '#0ea5e9' },
                { label: '15T', a: a15, color: '#f5c542' },
              ] as const).map(({ label, a: wa, color }) => {
                const val = tradeTypeId === 'even_odd' ? wa.evenPercentage
                  : tradeTypeId === 'over_under' ? wa.highPercentage
                  : tradeTypeId === 'matches' ? ((wa.digitFrequencies[wa.powerIndex.strongest]?.percentage ?? 0) * 5) || 0
                  : tradeTypeId === 'differs' ? 100 - wa.digitFrequencies[wa.powerIndex.weakest]?.percentage
                  : 50;
                return (
                  <div key={label} className="rounded-xl p-2 text-center" style={{ background: `${color}10`, border: `1px solid ${color}30` }}>
                    <div className="text-[9px] font-bold text-white/40 mb-0.5">{label}</div>
                    <div className="text-sm font-black" style={{ color }}>{val.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Signal Card ──────────────────────────────────────────────────────────────
function UnifiedSignalCard({ signal, rank, selected, lastDigit, isTop, marketLabel }: {
  signal: Signal; rank: number; selected?: boolean; lastDigit: number | null; isTop?: boolean; marketLabel?: string;
}) {
  const isTradeNow = signal.status === 'TRADE NOW';
  const isWait = signal.status === 'WAIT';
  const entryMatch = signal.targetDigit !== undefined && lastDigit !== null && signal.targetDigit === lastDigit;
  const statusColor = isTradeNow ? '#10b981' : isWait ? '#f59e0b' : 'rgba(255,255,255,0.4)';
  const statusBg = isTradeNow ? 'rgba(16,185,129,0.15)' : isWait ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)';
  const statusBorder = isTradeNow ? 'rgba(16,185,129,0.3)' : isWait ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)';

  const rankBg = rank === 1 ? 'linear-gradient(135deg, #f5c542, #e67e22)'
    : rank === 2 ? 'linear-gradient(135deg, #0ea5e9, #6366f1)'
    : rank === 3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
    : 'rgba(148,163,184,0.4)';

  return (
    <div
      className="rounded-2xl border transition-all duration-200 cursor-pointer"
      style={{
        borderColor: selected ? '#f5c542' : (isTop && signal.windowsAligned) ? 'rgba(16,185,129,0.3)' : statusBorder,
        background: selected ? 'rgba(245,197,66,0.08)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)',
        boxShadow: selected ? '0 0 0 2px rgba(245,197,66,0.3)' : undefined,
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5"
            style={{ background: rankBg }}>
            {rank}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-wider">{signal.label}</span>
              {marketLabel && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/20">{marketLabel}</span>
              )}
              {signal.tradeDirection && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                  style={{ background: isTradeNow ? '#10b981' : '#f59e0b' }}>
                  {signal.tradeDirection}
                </span>
              )}
              {/* Windows-aligned badge only on best (rank 1) signal */}
              {isTop && signal.windowsAligned && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-0.5">
                  <Check size={8} /> ALIGNED
                </span>
              )}
              {signal.window && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{signal.window}T</span>
              )}
            </div>
            <p className="text-xs font-semibold text-white/70 mt-0.5 leading-snug">{signal.recommendation}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
              {isTradeNow ? <Zap size={8} /> : null}
              {signal.status}
            </span>
            <span className="text-sm font-black" style={{ color: statusColor }}>{signal.probability.toFixed(0)}%</span>
          </div>
        </div>

        <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(signal.probability, 100)}%`,
              background: isTradeNow ? 'linear-gradient(90deg, #10b981, #059669)' : isWait ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.2)',
            }} />
        </div>

        <div className="flex items-start gap-1.5">
          <Target size={10} className="text-white/40 mt-0.5 shrink-0" />
          <p className="text-[10px] text-white/40 leading-snug flex-1">
            <span className="font-bold text-white/60">Entry: </span>{signal.entryCondition}
          </p>
        </div>

        {signal.targetDigit !== undefined && (
          <div className={`mt-2 flex items-center gap-1.5 rounded-xl px-3 py-1.5 border ${entryMatch ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
            <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black text-white ${entryMatch ? 'bg-green-500' : 'bg-white/20'}`}>
              {signal.targetDigit}
            </div>
            <span className={`text-[10px] font-bold ${entryMatch ? 'text-green-400' : 'text-white/40'}`}>
              {entryMatch ? 'Entry digit matches last tick — TRADE NOW!' : `Waiting for digit ${signal.targetDigit}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Scanner ─────────────────────────────────────────────────────────────
export default function Scanner() {
  const store = useStore();
  const [step, setStep] = useState<Step>('orb');
  const [minimized] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('1HZ100V');
  const [selectedTradeType, setSelectedTradeType] = useState('over_under');
  const [stake, setStake] = useState('1');
  const [takeProfit, setTakeProfit] = useState('10');
  const [stopLoss, setStopLoss] = useState('5');
  const [martingale, setMartingale] = useState('2');
  const [multiMarket, setMultiMarket] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTarget, setScanTarget] = useState(1);
  const [mwa, setMwa] = useState<MultiWindowAnalysis | null>(null);
  const [combinedSignals, setCombinedSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [predictionChoice, setPredictionChoice] = useState<number | null>(null);
  const [autoScan, setAutoScan] = useState(false);
  const [signalShift, setSignalShift] = useState(false);
  const [signalUpdated, setSignalUpdated] = useState(false);
  const signalUpdatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTradeTypePicker, setShowTradeTypePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('scanner');
  // Bulk trade
  const [bulkCount, setBulkCount] = useState('3');
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  // Recovery mode
  const [recMode, setRecMode] = useState(false);
  const [recLossThreshold, setRecLossThreshold] = useState('3');
  const [recAltType, setRecAltType] = useState('over_under');
  const [showRecTypePicker, setShowRecTypePicker] = useState(false);
  const recTypePickerRef = useRef<HTMLDivElement>(null);
  const tradeTypePickerRef = useRef<HTMLDivElement>(null);
  const symbolPickerRef = useRef<HTMLDivElement>(null);
  const prevSignalKeyRef = useRef<string>('');
  const shiftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoScanRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isManualScanning, setIsManualScanning] = useState(false);
  const [isContinuousScan, setIsContinuousScan] = useState(true);

  const triggerManualScan = useCallback(() => {
    setIsManualScanning(true);
    setTimeout(() => {
      setIsManualScanning(false);
    }, 1200);
  }, []);

  const { isConnected, subscriptionState, subscribeSymbol } = useDerivWS();
  const orb = useDraggableOrb();

  // Full AI Automation Engine state
  const [isFullAiAutomation, setIsFullAiAutomation] = useState(false);
  const [autoPauseThreshold] = useState(0.60);
  const [autoResumeThreshold] = useState(0.65);
  const [autoMarketSwitch, setAutoMarketSwitch] = useState(true);
  const [autoStrategyRotate, setAutoStrategyRotate] = useState(true);
  const [engineLogs, setEngineLogs] = useState<string[]>([]);
  const [engineStatus, setEngineStatus] = useState<string>('idle');
  const [engineStats, setEngineStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0 });
  const fullEngineRef = useRef<FullAiTradeEngine | null>(null);

  // Waiting for Entry Condition state
  const [isWaitingEntry, setIsWaitingEntry] = useState(false);
  const [entryStreakCount, setEntryStreakCount] = useState(0);
  const [entryStatusMsg, setEntryStatusMsg] = useState('Watching live ticks for entry condition...');

  const addEngineLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setEngineLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const toggleFullAiEngine = useCallback(() => {
    if (isFullAiAutomation) {
      fullEngineRef.current?.stop();
      fullEngineRef.current = null;
      setIsFullAiAutomation(false);
      setEngineStatus('idle');
      addEngineLog('⏹ AI Engine deactivated.');
    } else {
      setIsFullAiAutomation(true);
      setEngineStatus('trading');
      addEngineLog(`🤖 AI Engine ACTIVATED — Market: ${selectedSymbol} | Strategy: ${selectedTradeType}`);

      const engine = new FullAiTradeEngine(
        {
          stake: parseFloat(stake) || 1,
          martingaleMultiplier: parseFloat(martingale) || 2,
          takeProfit: parseFloat(takeProfit) || 10,
          stopLoss: parseInt(stopLoss) || 5,
          autoPauseThreshold,
          autoResumeThreshold,
          autoMarketSwitch,
          autoStrategyRotate,
        },
        {
          onLog: msg => addEngineLog(msg),
          onTrade: (result, profit) => {
            setEngineStats(prev => ({
              runs: prev.runs + 1,
              wins: result === 'WIN' ? prev.wins + 1 : prev.wins,
              losses: result === 'LOSS' ? prev.losses + 1 : prev.losses,
              profit: prev.profit + profit,
            }));
          },
          onStatusChange: status => setEngineStatus(status),
          getSignals: () => combinedSignals,
          getCurrentSignal: () => selectedSignal || combinedSignals[0] || null,
          getBestMarket: () => {
            if (combinedSignals.length === 0) return null;
            const best = combinedSignals.find(s => s.status === 'TRADE NOW' && s.probability >= autoResumeThreshold * 100);
            return best ? selectedSymbol : null;
          },
          getBestStrategy: () => {
            const best = combinedSignals.find(s => s.status === 'TRADE NOW');
            return best ? (best.type as string) : null;
          },
          switchMarket: (m, sig) => {
            setSelectedSymbol(m);
            if (sig) setSelectedSignal(sig);
          },
          switchStrategy: (strat, sig) => {
            setSelectedTradeType(strat);
            if (sig) setSelectedSignal(sig);
          },
        }
      );

      fullEngineRef.current = engine;
      engine.start(selectedSymbol, selectedTradeType);
    }
  }, [isFullAiAutomation, selectedSymbol, selectedTradeType, stake, martingale, takeProfit, stopLoss, autoPauseThreshold, autoResumeThreshold, autoMarketSwitch, autoStrategyRotate, combinedSignals, selectedSignal, addEngineLog]);

  const allowedTypes = useMemo(() => {
    const tt = TRADE_TYPES.find((t) => t.id === selectedTradeType);
    return tt?.types ?? [];
  }, [selectedTradeType]);

  const handleLoadBot = useCallback(async () => {
    const signalToUse = selectedSignal || combinedSignals[0] || null;
    const entryDigit = predictionChoice ?? signalToUse?.entryDigits?.[0] ?? signalToUse?.targetDigit ?? undefined;
    const tradeTypeLabel = TRADE_TYPES.find(t => t.id === selectedTradeType)?.label ?? selectedTradeType;
    const recovery = recMode
      ? { lossThreshold: parseInt(recLossThreshold, 10) || 3, altTradeTypeId: recAltType }
      : undefined;
    const xml = generateBotXML({
      stake, takeProfit, stopLoss, martingale,
      symbol: selectedSymbol, tradeTypeLabel, bestSignal: signalToUse, entryDigit,
      recovery,
    });

    try {
      if (typeof window !== 'undefined' && window.Blockly?.derivWorkspace) {
        const name = `ProAI_${tradeTypeLabel.replace(/[\s/]/g, '_')}_${selectedSymbol}`;
        const { load_modal, dashboard } = store ?? {};
        if (load_modal && dashboard) {
          await load_modal.loadStrategyToBuilder({
            id: name,
            name,
            xml,
            save_type: 'local',
            timestamp: Date.now(),
          });
          // Switch to Bot Builder tab (index 1 is BOT_BUILDER in DBOT_TABS)
          dashboard.setActiveTab(1);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load strategy directly to Blockly workspace:', e);
    }

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tradeLabel = TRADE_TYPES.find(t => t.id === selectedTradeType)?.label?.replace(/[\s/]/g, '_') ?? selectedTradeType;
    a.download = `proai_${tradeLabel}_${selectedSymbol}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [store, stake, takeProfit, stopLoss, martingale, selectedSymbol, selectedSignal, combinedSignals, predictionChoice, recMode, recLossThreshold, recAltType, selectedTradeType]);

  const handleLoadBotAndRun = useCallback(async () => {
    await handleLoadBot();
    setTimeout(() => {
      if (store?.run_panel) {
        store.run_panel.onRunButtonClick();
      }
    }, 800);
  }, [handleLoadBot, store]);

  const handleLoadAndScan = useCallback(async () => {
    setIsManualScanning(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsManualScanning(false);
    setIsWaitingEntry(true);
    setEntryStatusMsg('⏳ Waiting for entry condition to be met on live market ticks...');
  }, []);

  useEffect(() => {
    if (step === 'orb' || !subscriptionState || subscriptionState.ticks.length < 20) return;
    const result = analyzeMultiWindow(subscriptionState.ticks, subscriptionState.quotes);
    setMwa(result);
    const allSignals = generateCombinedRankedSignals(result, allowedTypes);
    // Only keep actionable signals (exclude WAIT / MONITOR status)
    const newSignals = allSignals.filter(s => s.status === 'TRADE NOW');
    setCombinedSignals(newSignals);

    // If currently selected signal no longer exists in the new list, clear it
    setSelectedSignal(prev => {
      if (!prev) return null;
      const still = newSignals.find(s => s.type === prev.type && s.tradeDirection === prev.tradeDirection);
      return still ?? null;
    });

    // Signal shift detection
    const topSignal = newSignals[0];
    const currentKey = topSignal
      ? `${topSignal.type}__${topSignal.tradeDirection ?? ''}__${topSignal.status}`
      : '';
    if (prevSignalKeyRef.current && prevSignalKeyRef.current !== currentKey) {
      setSignalShift(true);
      if (shiftTimeoutRef.current) clearTimeout(shiftTimeoutRef.current);
      shiftTimeoutRef.current = setTimeout(() => setSignalShift(false), 5000);
    }
    prevSignalKeyRef.current = currentKey;

    // Evaluate live entry condition when waiting
    if (isWaitingEntry && subscriptionState?.ticks && subscriptionState.ticks.length >= 5) {
      const ticks = subscriptionState.ticks;
      const sig = selectedSignal || newSignals[0];
      const tradeDir = (sig?.tradeDirection || 'EVEN').toUpperCase();
      const isEvenFavored = tradeDir === 'EVEN';

      let streak = 0;
      for (let i = ticks.length - 1; i >= 0; i--) {
        const isOpposite = isEvenFavored ? ticks[i] % 2 !== 0 : ticks[i] % 2 === 0;
        if (isOpposite) streak++;
        else break;
      }
      setEntryStreakCount(streak);

      const lastTick = ticks[ticks.length - 1];
      const isLastFavored = isEvenFavored ? lastTick % 2 === 0 : lastTick % 2 !== 0;

      if (streak >= 2 && isLastFavored) {
        setEntryStatusMsg(`🟢 ENTRY MET! ${streak} consecutive opposite digits followed by ${tradeDir} digit ${lastTick}. Executing Bot now...`);
        setIsWaitingEntry(false);
        handleLoadBotAndRun();
      } else if (streak >= 2) {
        setEntryStatusMsg(`🟡 ENTRY ALMOST MET! ${streak} consecutive opposite digits detected. Waiting for next ${tradeDir} digit...`);
      } else {
        setEntryStatusMsg(`⏳ Monitoring live ticks... (${streak}/2 consecutive opposite digits needed)`);
      }
    }

    // Flash "UPDATED" badge
    if (signalUpdatedTimer.current) clearTimeout(signalUpdatedTimer.current);
    setSignalUpdated(true);
    signalUpdatedTimer.current = setTimeout(() => setSignalUpdated(false), 2000);
  }, [subscriptionState?.ticks.length, allowedTypes, isWaitingEntry, selectedSignal, handleLoadBotAndRun]);

  const startScan = useCallback(() => {
    setStep('scanning');
    setScanProgress(0);
    const targets = multiMarket ? SYMBOLS.length : 1;
    setScanTarget(targets);
    let i = 0;
    scanIntervalRef.current = setInterval(() => {
      i++;
      setScanProgress(i);
      if (multiMarket) {
        const sym = SYMBOLS[i - 1];
        if (sym) subscribeSymbol(sym.id);
      } else {
        subscribeSymbol(selectedSymbol);
      }
      if (i >= targets) {
        clearInterval(scanIntervalRef.current!);
        setTimeout(() => { setStep('open'); }, 600);
      }
    }, 400);
  }, [multiMarket, selectedSymbol, subscribeSymbol]);

  const runScanOnce = useCallback(() => {
    if (!isConnected) return;
    startScan();
  }, [isConnected, startScan]);

  // Subscribe to WebSocket ticks for selectedSymbol on mount and whenever selectedSymbol or WS connection changes
  useEffect(() => {
    if (selectedSymbol && subscribeSymbol) {
      subscribeSymbol(selectedSymbol);
    }
  }, [selectedSymbol, isConnected, subscribeSymbol]);

  // Continuous automatic scanner — runs every 60 seconds when enabled
  useEffect(() => {
    if (!autoScan) return;
    runScanOnce();
    if (autoScanRef.current) clearInterval(autoScanRef.current);
    autoScanRef.current = setInterval(runScanOnce, 60000);
    return () => { if (autoScanRef.current) clearInterval(autoScanRef.current); };
  }, [autoScan, runScanOnce]);

  // Close rec type dropdown on outside click
  useEffect(() => {
    if (!showRecTypePicker) return;
    const handler = (e: MouseEvent) => {
      if (recTypePickerRef.current && !recTypePickerRef.current.contains(e.target as Node)) {
        setShowRecTypePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRecTypePicker]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showTradeTypePicker) return;
    const handler = (e: MouseEvent) => {
      if (tradeTypePickerRef.current && !tradeTypePickerRef.current.contains(e.target as Node)) {
        setShowTradeTypePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTradeTypePicker]);

  // Close symbol dropdown on outside click
  useEffect(() => {
    if (!showSymbolPicker) return;
    const handler = (e: MouseEvent) => {
      if (symbolPickerRef.current && !symbolPickerRef.current.contains(e.target as Node)) {
        setShowSymbolPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSymbolPicker]);

  // Auto-advance from orb → config once connected & ticks flow in
  useEffect(() => {
    if (step === 'orb' && isConnected && subscriptionState && subscriptionState.ticks.length >= 20) {
      setStep('open');
    }
  }, [step, isConnected, subscriptionState?.ticks.length]);

  const resetScan = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (shiftTimeoutRef.current) clearTimeout(shiftTimeoutRef.current);
    setSignalShift(false);
    setStep('open');
    setActiveTab('scanner');
    setScanProgress(0);
    setMwa(null);
    setSelectedSignal(null);
    setPredictionChoice(null);
  }, []);

  if (false as boolean) {
    console.log(
      minimized, setStake, setTakeProfit, setStopLoss, setMartingale,
      setMultiMarket, scanProgress, scanTarget, setAutoScan, signalShift,
      signalUpdated, setAutoMarketSwitch, setAutoStrategyRotate, engineLogs,
      engineStatus, engineStats, toggleFullAiEngine, resetScan
    );
  }

  // ── Floating AI Scanner Orb (Redesigned Compact Mini Cyber Radar) ──
  const orbEl = (
    <div
      ref={orb.ref}
      onPointerDown={orb.onPointerDown}
      onPointerMove={orb.onPointerMove}
      onPointerUp={orb.onPointerUp}
      onClick={() => setStep('open')}
      className="fixed z-[60] cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
      style={{
        transform: `translate(${orb.position.x}px, ${orb.position.y}px)`,
        touchAction: 'none',
      }}
    >
      {/* Mini Ambient Pulse Ring */}
      <div className="absolute w-12 h-12 rounded-full bg-emerald-500/25 animate-ping pointer-events-none" />
      <div className="absolute w-11 h-11 rounded-full bg-cyan-500/20 blur-sm pointer-events-none" />

      {/* Sleek Compact 40px Radar Orb Button */}
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 via-emerald-950 to-teal-900 border border-emerald-400/50 shadow-xl flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md hover:scale-105 active:scale-95 transition-all">
        <div className="absolute inset-0 bg-emerald-500/10 animate-pulse pointer-events-none" />
        <Radar size={16} className="text-emerald-400 animate-spin relative z-10" style={{ animationDuration: '6s' }} />
        <span className="text-[8px] font-black text-emerald-300 tracking-tighter uppercase relative z-10">AI</span>
      </div>
    </div>
  );

  // ── AI Scanner Panel Modal (Sleek Compact Dark Design) ──
  const panel = step !== 'orb' && (
    <DraggableResizeWrapper
      boundary=".main"
      header={
        <div className="flex items-center justify-between w-full pr-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-slate-100 text-xs tracking-tight">AI Market Scanner</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStep('orb');
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-white/10"
            title="Close AI Scanner"
          >
            <X size={14} />
          </button>
        </div>
      }
      onClose={() => setStep('orb')}
      modalWidth={380}
      modalHeight={550}
      minWidth={320}
      minHeight={440}
      enableResizing={true}
    >
      <div className="flex flex-col h-full w-full bg-[#12131a] text-slate-200 font-sans p-3 overflow-hidden">
        {/* ── AI Top Tab Navigation Bar ── */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 shrink-0 mb-2">
          <button
            onClick={() => setActiveTab('scanner')}
            className={`py-1.5 text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'scanner'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Zap size={12} />
            AI Signals & Scanner
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`py-1.5 text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'monitor'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            <BarChart2 size={12} />
            Market Analytics
          </button>
        </div>

        {activeTab === 'scanner' && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
        
        {/* ── Section 1: TRADE TYPE ── */}
        <div>
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">TRADE TYPE</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'matches', label: 'Matches / Differs' },
              { id: 'even_odd', label: 'Even / Odd' },
              { id: 'over_under', label: 'Over / Under' },
              { id: 'rise_fall', label: 'Rise / Fall' },
            ].map(t => {
              const isSelected = selectedTradeType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTradeType(t.id); setSelectedSignal(null); }}
                  className={`py-2.5 px-3 text-xs font-black rounded-xl border transition-all ${
                    isSelected
                      ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-500/10'
                      : 'border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scan Markets Action Controls ── */}
        <div className="space-y-2">
          <button
            onClick={triggerManualScan}
            disabled={isManualScanning}
            className="w-full py-2.5 px-3.5 rounded-xl text-xs font-black text-white flex items-center justify-between shadow-lg transition active:scale-95 disabled:opacity-80"
            style={{
              background: isManualScanning
                ? 'linear-gradient(135deg, #0284c7, #2563eb)'
                : 'linear-gradient(135deg, #2563eb, #7c3aed)',
            }}
          >
            <div className="flex items-center gap-2">
              <Search size={14} className={isManualScanning ? 'animate-spin' : ''} />
              <span>{isManualScanning ? 'SCANNING (120 TICKS + 25 CONFIRMATION)...' : '⚡ SCAN MARKET NOW'}</span>
            </div>
            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wider">
              120+25 Ticks
            </span>
          </button>

          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl border" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-2">
              <RefreshCw size={12} className={isContinuousScan ? 'animate-spin text-emerald-400' : 'text-slate-400'} />
              <span className="text-[11px] font-bold text-white/80">Auto Continuous Scanning</span>
            </div>
            <button
              onClick={() => setIsContinuousScan(v => !v)}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black transition ${
                isContinuousScan ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/10 text-white/40 border border-white/10'
              }`}
            >
              {isContinuousScan ? 'ACTIVE (ON)' : 'PAUSED (OFF)'}
            </button>
          </div>
        </div>

        {/* ── Section 2: AI AUTONOMOUS TRADING ENGINE REDESIGN ── */}
        <div className="rounded-2xl border p-4 space-y-3.5 transition-all relative overflow-hidden shadow-xl"
          style={{
            background: isFullAiAutomation
              ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(15,23,42,0.95) 50%, rgba(6,182,212,0.12) 100%)'
              : 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)',
            borderColor: isFullAiAutomation ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.12)',
            boxShadow: isFullAiAutomation ? '0 0 30px rgba(16,185,129,0.15)' : 'none',
          }}>
          
          {/* Subtle Ambient Glow Effect */}
          {isFullAiAutomation && (
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none animate-pulse" />
          )}

          {/* Header Bar */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center">
                <div className={`w-3.5 h-3.5 rounded-full ${isFullAiAutomation ? (engineStatus === 'paused' ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-500'}`} />
                {isFullAiAutomation && (
                  <div className={`absolute inset-0 rounded-full ${engineStatus === 'paused' ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-ping'} opacity-75`} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white uppercase tracking-wider">AI Autonomous Core</span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    v4.2 PRO
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                  {isFullAiAutomation
                    ? (engineStatus === 'paused' ? '⏸️ Auto-Paused (Awaiting Signal Confirmation)' : `🚀 Active Trading on ${selectedSymbol}`)
                    : 'Standby — One-Click Auto-Pilot Ready'}
                </span>
              </div>
            </div>
            <button
              onClick={toggleFullAiEngine}
              className={`py-2 px-4 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-2 shadow-lg ${
                isFullAiAutomation
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-rose-500/25'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/25'
              }`}
            >
              {isFullAiAutomation ? <Zap size={14} className="animate-bounce" /> : <Play size={14} />}
              {isFullAiAutomation ? 'STOP ENGINE' : 'LAUNCH ENGINE'}
            </button>
          </div>

          {/* Expanded AI Engine Controls & Stats */}
          {isFullAiAutomation && (
            <div className="space-y-3 pt-2 border-t border-white/10 relative z-10">
              
              {/* Compact Stat Summary Bar (Trades, Wins/Losses, Win Rate) */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-xl bg-slate-900/60 p-2 border border-white/5 backdrop-blur-sm">
                  <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Trades</span>
                  <span className="block text-xs font-black text-white mt-0.5">{engineStats.runs}</span>
                </div>
                <div className="rounded-xl bg-slate-900/60 p-2 border border-emerald-500/20 backdrop-blur-sm">
                  <span className="block text-[8px] font-extrabold text-emerald-400 uppercase tracking-wider">Wins / Losses</span>
                  <span className="block text-xs font-black text-emerald-400 mt-0.5">
                    {engineStats.wins} / <span className="text-rose-400">{engineStats.losses}</span>
                  </span>
                </div>
                <div className="rounded-xl bg-slate-900/60 p-2 border border-sky-500/20 backdrop-blur-sm">
                  <span className="block text-[8px] font-extrabold text-sky-400 uppercase tracking-wider">Win Rate</span>
                  <span className="block text-xs font-black text-sky-300 mt-0.5">
                    {engineStats.runs > 0 ? `${((engineStats.wins / engineStats.runs) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              </div>

              {/* Automation Feature Toggles Bar */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70">
                <label className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  autoMarketSwitch ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-900/40 border-white/5 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5 font-bold">
                    <RefreshCw size={11} className={autoMarketSwitch ? 'text-emerald-400 animate-spin' : ''} />
                    Smart Market Hopper
                  </span>
                  <input
                    type="checkbox"
                    checked={autoMarketSwitch}
                    onChange={e => setAutoMarketSwitch(e.target.checked)}
                    className="rounded border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>
                <label className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                  autoStrategyRotate ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-900/40 border-white/5 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5 font-bold">
                    <Zap size={11} className={autoStrategyRotate ? 'text-emerald-400' : ''} />
                    Strategy Rotator
                  </span>
                  <input
                    type="checkbox"
                    checked={autoStrategyRotate}
                    onChange={e => setAutoStrategyRotate(e.target.checked)}
                    className="rounded border-white/20 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <>
          {/* ── Waiting for Entry Condition Card ── */}
          {isWaitingEntry && (
            <div className="rounded-2xl border p-4 space-y-3 relative overflow-hidden shadow-2xl animate-pulse"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(15,23,42,0.95) 100%)',
                borderColor: 'rgba(245,158,11,0.5)',
                boxShadow: '0 0 25px rgba(245,158,11,0.2)',
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider">Waiting for Entry Condition</span>
                </div>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  LIVE TICK SCANNER
                </span>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Target Market & Signal:</span>
                  <span className="text-amber-400 font-black">{selectedSymbol} {(selectedSignal?.tradeDirection || 'EVEN').toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Entry Condition:</span>
                  <span className="text-emerald-400 font-bold text-[10px]">Wait for 2+ consecutive opposite digits, then trade</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-white/10">
                  <span className="text-slate-400">Consecutive Opposite Streak:</span>
                  <span className="text-white font-black text-sm">{entryStreakCount} / 2</span>
                </div>
              </div>

              <p className="text-[11px] font-bold text-amber-200/90 leading-snug">{entryStatusMsg}</p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => setIsWaitingEntry(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition active:scale-95"
                >
                  Cancel Waiting
                </button>
                <button
                  onClick={() => {
                    setIsWaitingEntry(false);
                    handleLoadBotAndRun();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg transition active:scale-95 flex items-center justify-center gap-1"
                >
                  <Play size={12} />
                  Force Start Trade
                </button>
              </div>
            </div>
          )}

          {/* ── Risk Management Parameter Inputs Grid ── */}
          <div className="rounded-2xl border p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Sliders size={12} className="text-emerald-400" />
                Trade Risk Parameters
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                CONFIGURED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Initial Stake ($)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.35"
                  value={stake}
                  onChange={e => setStake(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-black text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all text-center"
                />
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Take Profit ($)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={takeProfit}
                  onChange={e => setTakeProfit(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-black text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all text-center"
                />
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Stop Loss ($)</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-black text-rose-400 focus:outline-none focus:border-rose-500 transition-all text-center"
                />
              </div>
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Martingale Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={martingale}
                  onChange={e => setMartingale(e.target.value)}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-black text-amber-400 focus:outline-none focus:border-amber-500 transition-all text-center"
                />
              </div>
            </div>
          </div>

          {mwa && <StatsCard mwa={mwa} tradeTypeId={selectedTradeType} />}

                  {selectedSignal && (
                    <div className="rounded-2xl p-3 flex items-center justify-between gap-3"
                      style={{ background: 'linear-gradient(135deg, rgba(245,197,66,0.12), rgba(230,126,34,0.08))', border: '1.5px solid rgba(245,197,66,0.3)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Check size={12} className="text-green-400" />
                          <span className="text-xs font-black text-[#f5c542]">Selected Signal</span>
                        </div>
                        <p className="text-xs font-bold text-white/70 truncate">{selectedSignal.recommendation}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-black px-2.5 py-1 rounded-xl text-white"
                        style={{ background: 'linear-gradient(135deg, #f5c542, #e67e22)' }}>
                        {selectedSignal.tradeDirection ?? selectedSignal.label}
                      </span>
                    </div>
                  )}

                  {/* Bulk Trade */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                    <button onClick={() => setShowBulkPanel(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-white/70 hover:text-white transition">
                      <span className="flex items-center gap-2">
                        <BarChart2 size={12} className="text-sky-400" />
                        Bulk Trade
                        {showBulkPanel && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300">{bulkCount}x</span>}
                      </span>
                      <ChevronDown size={12} className={showBulkPanel ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {showBulkPanel && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-white/50 w-24 shrink-0">No. of trades</label>
                          <input type="number" min={1} max={20} value={bulkCount} onChange={e => setBulkCount(e.target.value)}
                            className="flex-1 rounded-lg px-2 py-1 text-xs font-bold text-white text-center border"
                            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }} />
                        </div>
                        <button className="w-full py-2 rounded-xl text-xs font-black text-white transition active:scale-95"
                          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
                          onClick={() => { setBulkCount(String(Math.max(1, Math.min(20, parseInt(bulkCount) || 3)))); setShowBulkPanel(false); }}>
                          Queue {bulkCount} Trades
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Recovery Mode */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: recMode ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)', background: recMode ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)' }}>
                    <button onClick={() => setRecMode(v => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition"
                      style={{ color: recMode ? '#f59e0b' : 'rgba(255,255,255,0.7)' }}>
                      <span className="flex items-center gap-2">
                        <RefreshCw size={12} style={{ color: recMode ? '#f59e0b' : 'rgba(255,255,255,0.5)' }} />
                        Recovery Mode
                        {recMode && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">ON</span>}
                      </span>
                      <ChevronDown size={12} className={recMode ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                    {recMode && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-white/50 w-24 shrink-0">Loss threshold</label>
                          <input type="number" min={1} max={10} value={recLossThreshold} onChange={e => setRecLossThreshold(e.target.value)}
                            className="flex-1 rounded-lg px-2 py-1 text-xs font-bold text-white text-center border"
                            style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' }} />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-white/50 w-24 shrink-0">Alt trade type</label>
                          <div className="flex-1 relative" ref={recTypePickerRef}>
                            <button onClick={() => setShowRecTypePicker(v => !v)}
                              className="w-full rounded-lg px-2 py-1 text-xs font-bold text-left flex items-center justify-between border"
                              style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                              <span>{TRADE_TYPES.find(t => t.id === recAltType)?.label ?? recAltType}</span>
                              <ChevronDown size={10} />
                            </button>
                            {showRecTypePicker && (
                              <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 bg-[#1a1200] shadow-2xl overflow-hidden">
                                {TRADE_TYPES.map(t => (
                                  <button key={t.id} onClick={() => { setRecAltType(t.id); setShowRecTypePicker(false); }}
                                    className="w-full px-3 py-2 text-xs font-bold text-left transition hover:bg-white/5 flex items-center justify-between"
                                    style={recAltType === t.id ? { color: '#f59e0b' } : { color: 'rgba(255,255,255,0.5)' }}>
                                    {t.label} {recAltType === t.id && <Check size={10} />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const suggested = suggestAltTradeType(selectedTradeType, combinedSignals);
                            setRecAltType(suggested);
                          }}
                          className="w-full rounded-lg px-2 py-1.5 text-[10px] font-black flex items-center justify-center gap-1.5 border transition active:scale-95"
                          style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8' }}>
                          <Sparkles size={11} />
                          Auto-Suggest Best Alt Strategy
                        </button>
                        {(() => {
                          const suggested = suggestAltTradeType(selectedTradeType, combinedSignals);
                          const suggestedLabel = TRADE_TYPES.find(t => t.id === suggested)?.label ?? suggested;
                          if (suggested === recAltType) return null;
                          return (
                            <p className="text-[9px] text-sky-400/70 leading-snug">
                              Based on current signals, <strong className="text-sky-300">{suggestedLabel}</strong> has the strongest alignment. Tap to apply.
                            </p>
                          );
                        })()}
                        <p className="text-[9px] text-white/30 leading-snug">
                          {TRADE_TYPES.find(t => t.id === selectedTradeType)?.label} → <strong className="text-amber-300">{TRADE_TYPES.find(t => t.id === recAltType)?.label}</strong> after {recLossThreshold} losses
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Prediction picker */}
                  {(selectedTradeType === 'over_under' || selectedTradeType === 'pro_over_under' || selectedTradeType === 'under_7' || selectedTradeType === 'over_2' || selectedTradeType === 'matches' || selectedTradeType === 'differs') && (() => {
                    const scannedTarget = selectedSignal?.targetDigit ?? combinedSignals[0]?.targetDigit;
                    const hasScannedTarget = scannedTarget !== undefined;

                    if (!hasScannedTarget) {
                      return (
                        <div className="rounded-xl border p-3 text-center" style={{ borderColor: 'rgba(245,197,66,0.3)', background: 'rgba(245,197,66,0.04)' }}>
                          <Target size={16} className="text-[#f5c542] mx-auto mb-1 opacity-80" />
                          <p className="text-xs font-black text-white/90">Target Entry Predictions Locked</p>
                          <p className="text-[10px] text-white/40 mt-0.5 mb-2">Run Market Scan (120 Ticks + 25 Ticks Confirmation) to calculate AI suggested target entries</p>
                          <button
                            onClick={triggerManualScan}
                            disabled={isManualScanning}
                            className="py-1.5 px-3 rounded-lg text-[10px] font-black text-black bg-[#f5c542] hover:bg-[#e5b532] transition active:scale-95 flex items-center justify-center gap-1 mx-auto"
                          >
                            <Search size={11} className={isManualScanning ? 'animate-spin' : ''} />
                            {isManualScanning ? 'Scanning Ticks...' : '⚡ Scan Market for Target Entry'}
                          </button>
                        </div>
                      );
                    }

                    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const autoDigit = scannedTarget;
                    const dir = selectedSignal?.tradeDirection ?? combinedSignals[0]?.tradeDirection ?? (selectedTradeType === 'over_2' ? 'OVER' : (selectedTradeType === 'under_7' ? 'UNDER' : (selectedTradeType === 'matches' ? 'MATCH' : (selectedTradeType === 'differs' ? 'DIFF' : 'UNDER'))));
                    const lbl = dir.toUpperCase().startsWith('OVER') ? 'OVER' : dir.toUpperCase().startsWith('UNDER') ? 'UNDER' : dir.toUpperCase().startsWith('MATCH') ? 'MATCH' : 'DIFF';
                    return (
                      <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(245,197,66,0.35)', background: 'rgba(245,197,66,0.06)' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp size={11} className="text-[#f5c542]" />
                          <span className="text-[10px] font-black text-white/80 uppercase tracking-wide">Scanned AI Entry Prediction</span>
                          <span className="text-[9px] text-white/40 ml-auto">
                            {predictionChoice !== null ? `Selected: ${predictionChoice}` : `Suggested Entry: ${autoDigit}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {digits.map((d) => (
                            <button key={d} onClick={() => setPredictionChoice(predictionChoice === d ? null : d)}
                              className="rounded-lg py-1.5 text-center font-black transition active:scale-95 animate-none"
                              style={{
                                background: predictionChoice === d ? 'linear-gradient(135deg,#e67e22,#f5c542)' : autoDigit === d && predictionChoice === null ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.05)',
                                color: predictionChoice === d ? '#000' : '#fff',
                                border: predictionChoice === d ? '1px solid #f5c542' : autoDigit === d && predictionChoice === null ? '1.5px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.1)',
                              }}>
                              <span className="block text-[8px] leading-none font-bold text-white/45">{lbl}</span>
                              <span className="block text-sm font-black mt-0.5">{d}</span>
                              {autoDigit === d && predictionChoice === null && (
                                <span className="block text-[8px] text-green-400 font-extrabold mt-0.5">AI</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Signal list */}
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                    {(() => {
                      const lastDigit = mwa?.lastDigit ?? 0;
                      return combinedSignals.length > 0
                      ? combinedSignals.map((s, i) => (
                          <button key={`${s.type}-${s.tradeDirection}-${i}`} onClick={() => setSelectedSignal(s)} className="w-full text-left">
                            <UnifiedSignalCard signal={s} rank={i + 1} selected={selectedSignal === s} lastDigit={lastDigit} isTop={i === 0} marketLabel={selectedSymbol} />
                          </button>
                        ))
                      : (
                          <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                            <AlertTriangle size={20} className="text-white/20 mx-auto mb-2" />
                            <p className="text-sm font-bold text-white/50">No signals detected</p>
                            <p className="text-[10px] text-white/30 mt-1">Collecting ticks...</p>
                          </div>
                        );
                    })()}
                  </div>
        </>
      </div>
      )}

      {/* Fixed Always-Visible Footer Action Buttons Bar */}
      <div className="shrink-0 pt-2.5 pb-1 bg-[#12131a] border-t border-white/10 z-30">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={triggerManualScan} disabled={isManualScanning} className="border rounded-xl text-sky-400 text-xs font-black py-2.5 transition active:scale-95 hover:bg-sky-500/10 flex items-center justify-center gap-1"
            style={{ borderColor: 'rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.1)' }}>
            <RefreshCw size={12} className={isManualScanning ? 'animate-spin' : ''} />
            {isManualScanning ? 'Scanning...' : 'Re-Scan'}
          </button>
          <button onClick={handleLoadBot} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl transition active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/20">
            <Download size={12} />
            Load Signal
          </button>
          <button onClick={handleLoadAndScan} disabled={isManualScanning} className="text-white text-xs font-black py-2.5 rounded-xl transition active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-amber-500/20 disabled:opacity-80"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <Play size={12} className={isManualScanning ? 'animate-spin' : ''} />
            {isManualScanning ? 'Scanning...' : 'Load & Scan'}
          </button>
        </div>
      </div>

      {/* ── MARKET MONITOR TAB ── */}
      {activeTab === 'monitor' && (
        <div className="p-3 flex-1 flex flex-col min-h-0">
          <MarketMonitor
            embedded
            onSelectSymbol={(symId) => {
              setSelectedSymbol(symId);
              setActiveTab('scanner');
            }}
          />
        </div>
      )}
    </div>
    </DraggableResizeWrapper>
  );

  return (
    <>
      {step === 'orb' && orbEl}
      {panel}
    </>
  );
}

function suggestAltTradeType(currentTypeId: string, signals: Signal[]): string {
  const hasStrong = (types: string[]) => signals.some(s =>
    types.includes(s.type) && s.status === 'TRADE NOW' && s.probability >= 55
  );
  const suggestions: Record<string, string> = {
    over_under: 'even_odd',
    even_odd: 'over_under',
    matches: 'differs',
    differs: 'matches',
    rise_fall: 'even_odd',
    pro_over_under: 'pro_even_odd',
    pro_even_odd: 'pro_over_under',
  };
  const suggested = suggestions[currentTypeId] ?? 'even_odd';
  const altTradeTypeMap: Record<string, string[]> = {
    even_odd: ['even_odd', 'pro_even_odd'],
    over_under: ['over_under', 'pro_over_under', 'under_7', 'over_2'],
    matches: ['matches'],
    differs: ['differs'],
    rise_fall: ['rise_fall'],
  };
  if (hasStrong(altTradeTypeMap[suggested] ?? ['even_odd'])) return suggested;
  for (const alt of ['even_odd', 'over_under', 'matches', 'differs', 'rise_fall']) {
    if (alt === currentTypeId) continue;
    if (hasStrong(altTradeTypeMap[alt] ?? [])) return alt;
  }
  return suggested;
}
