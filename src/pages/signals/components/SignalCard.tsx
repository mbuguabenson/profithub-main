import React from 'react';
import clsx from 'clsx';
import { SignalStatus } from '../engine/SignalEngine';
import { SignalWithSymbol } from '../engine/TickSubscriber';
import './SignalCard.scss';

interface SignalCardProps {
    signal: SignalWithSymbol;
    isSuper?: boolean;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, isSuper = false }) => {
    const getStatusClass = (status: SignalStatus) => {
        switch (status) {
            case 'STRONG': return 'status-strong';
            case 'TRADE NOW': return 'status-trade-now';
            case 'WAIT': return 'status-wait';
            case 'NEUTRAL': return 'status-neutral';
            default: return 'status-neutral';
        }
    };

    const getGradientColor = (probability: number) => {
        if (probability >= 90) return 'linear-gradient(135deg, #00C853, #64DD17)';
        if (probability >= 65) return 'linear-gradient(135deg, #FF6D00, #FFD600)';
        if (probability >= 55) return 'linear-gradient(135deg, #2979FF, #40C4FF)';
        return 'linear-gradient(135deg, #757575, #BDBDBD)';
    };

    const formatType = (type: string) => {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    return (
        <div className={clsx('signal-card', isSuper && 'super-signal', getStatusClass(signal.status))}>
            <div className="signal-card__header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 className="signal-card__title">{formatType(signal.type)}</h3>
                    {signal.symbol && (
                        <span style={{ fontSize: '0.75rem', color: '#f5c542', fontWeight: 600 }}>
                            {signal.symbol.toUpperCase()}
                        </span>
                    )}
                </div>
                <span className={clsx('signal-card__badge', getStatusClass(signal.status))}>
                    {signal.status}
                </span>
            </div>
            
            <div className="signal-card__body">
                <div className="signal-card__probability-container">
                    <div 
                        className="signal-card__probability-circle"
                        style={{
                            background: `conic-gradient(from 0deg, var(--circle-fill, #4caf50) ${signal.probability}%, var(--circle-bg, #333) ${signal.probability}%)`
                        }}
                    >
                        <div className="signal-card__probability-inner">
                            <span className="signal-card__probability-text">{signal.probability.toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                <div className="signal-card__details">
                    <p className="signal-card__recommendation">{signal.recommendation}</p>
                    <div className="signal-card__entry-condition">
                        <strong>Entry: </strong> {signal.entryCondition}
                    </div>
                    {signal.targetDigit !== undefined && (
                        <div className="signal-card__target">
                            Target Digit: <span className="signal-card__target-digit">{signal.targetDigit}</span>
                        </div>
                    )}
                </div>
            </div>
            {signal.status === 'TRADE NOW' || signal.status === 'STRONG' ? (
                <div className="signal-card__pulse-effect" />
            ) : null}
        </div>
    );
};
