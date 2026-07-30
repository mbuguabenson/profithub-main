import { Signal, SignalStatus } from '../lib/signals';
import { Zap, Clock, MinusCircle } from 'lucide-react';

const statusConfig: Record<SignalStatus, { color: string; bgAccent: string; icon: React.ReactNode }> = {
  'TRADE NOW': {
    color: '#10b981',
    bgAccent: 'rgba(16, 185, 129, 0.1)',
    icon: <Zap size={12} style={{ color: '#10b981' }} />,
  },
  WAIT: {
    color: '#f59e0b',
    bgAccent: 'rgba(245, 158, 11, 0.1)',
    icon: <Clock size={12} style={{ color: '#f59e0b' }} />,
  },
  NEUTRAL: {
    color: '#94a3b8',
    bgAccent: 'rgba(148, 163, 184, 0.08)',
    icon: <MinusCircle size={12} style={{ color: '#64748b' }} />,
  },
};

type Props = {
  signal: Signal;
  compact?: boolean;
};

export function SignalCard({ signal, compact = false }: Props) {
  const cfg = statusConfig[signal.status];
  const barWidth = Math.min(signal.probability, 100);

  return (
    <div
      style={{
        background: '#181825',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        borderRadius: '16px',
        padding: '14px 16px',
        boxShadow: '6px 6px 14px #0a0a12, -6px -6px 14px #22223a',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(241,245,249,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {signal.label}
            </span>
            {signal.tradeDirection && (
              <span
                style={{
                  background: '#1c1c2e',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '10px',
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  boxShadow: 'inset 2px 2px 4px #0a0a12, inset -2px -2px 4px #22223a',
                }}
              >
                {signal.tradeDirection}
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.4, margin: 0 }}>
            {signal.recommendation}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 900,
              padding: '3px 10px',
              borderRadius: '10px',
              color: cfg.color,
              background: '#1c1c2e',
              border: `1px solid ${cfg.color}22`,
              boxShadow: '3px 3px 6px #0a0a12, -3px -3px 6px #22223a',
              whiteSpace: 'nowrap',
            }}
          >
            {cfg.icon}
            {signal.status}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 900, color: '#f1f5f9' }}>
            {signal.probability.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Neumorphic probability bar */}
      <div
        style={{
          width: '100%',
          height: '6px',
          borderRadius: '6px',
          background: '#1c1c2e',
          boxShadow: 'inset 2px 2px 4px #0a0a12, inset -2px -2px 4px #22223a',
          overflow: 'hidden',
          marginBottom: compact ? 0 : '10px',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: '6px',
            transition: 'all 0.5s',
            width: `${barWidth}%`,
            background:
              signal.status === 'TRADE NOW'
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : signal.status === 'WAIT'
                ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                : '#64748b',
            boxShadow: `0 0 8px ${cfg.color}44`,
          }}
        />
      </div>

      {!compact && (
        <p style={{ fontSize: '10px', color: 'rgba(241,245,249,0.35)', lineHeight: 1.5, margin: 0 }}>
          <span style={{ fontWeight: 700, color: 'rgba(241,245,249,0.5)' }}>Entry:</span> {signal.entryCondition}
        </p>
      )}
    </div>
  );
}
