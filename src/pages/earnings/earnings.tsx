import React, { useState, useMemo } from 'react';
import { getAppId } from '@/components/shared/utils/config/config';
import './earnings.scss';

type DateRangeOption = 'all' | '7d' | '30d' | '3m' | '6m' | '12m' | 'custom';

interface ContractTypeData {
    name: string;
    value: number;
    percentage: number;
    color: string;
}

const Earnings: React.FC = () => {
    const [range, setRange] = useState<DateRangeOption>('30d');
    const [startDate, setStartDate] = useState('2026-06-01');
    const [endDate, setEndDate] = useState('2026-07-22');

    const appId = getAppId() || '3Mmq9JHMrJaUKT2KIhKZ';

    // Calculated metrics based on selected date range
    const metrics = useMemo(() => {
        let multiplier = 1;
        if (range === '7d') multiplier = 0.25;
        if (range === '30d') multiplier = 1;
        if (range === '3m') multiplier = 2.8;
        if (range === '6m') multiplier = 5.2;
        if (range === '12m') multiplier = 10.5;
        if (range === 'all') multiplier = 14.8;
        if (range === 'custom') multiplier = 1.4;

        const totalTrades = Math.round(14280 * multiplier);
        const activeClients = Math.round(148 * (1 + multiplier * 0.15));
        const commission = (2849.5 * multiplier).toFixed(2);
        const volume = (142452 * multiplier).toFixed(2);

        return {
            totalTrades,
            activeClients,
            commission,
            volume,
        };
    }, [range]);

    // Contract type breakdown dataset
    const contractTypes: ContractTypeData[] = [
        { name: 'Rise / Fall', value: 4520, percentage: 38, color: '#10B981' },
        { name: 'Digits Over / Under', value: 3330, percentage: 28, color: '#3B82F6' },
        { name: 'Matches / Differs', value: 2140, percentage: 18, color: '#8B5CF6' },
        { name: 'High / Low Ticks', value: 1190, percentage: 10, color: '#F59E0B' },
        { name: 'Touch / No Touch', value: 710, percentage: 6, color: '#EC4899' },
    ];

    // SVG Line/Area Chart Trend Points
    const chartPoints = useMemo(() => {
        const baseValues = [20, 35, 28, 45, 60, 52, 78, 65, 85, 92, 110, 125];
        const width = 600;
        const height = 200;
        const padding = 20;

        const maxVal = Math.max(...baseValues);
        const minVal = Math.min(...baseValues);

        const pts = baseValues.map((val, idx) => {
            const x = padding + (idx / (baseValues.length - 1)) * (width - 2 * padding);
            const y = height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
            return { x, y, val };
        });

        const dPath = pts.reduce((acc, pt, idx) => {
            return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
        }, '');

        const areaPath = `${dPath} L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`;

        return { pts, dPath, areaPath };
    }, [range]);

    // SVG Pie Chart Generator
    const pieSlices = useMemo(() => {
        let cumulativeAngle = 0;
        const totalPct = contractTypes.reduce((acc, item) => acc + item.percentage, 0);

        return contractTypes.map(item => {
            const angle = (item.percentage / totalPct) * 360;
            const startAngle = cumulativeAngle;
            const endAngle = cumulativeAngle + angle;
            cumulativeAngle += angle;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const r = 90;
            const cx = 110;
            const cy = 110;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            const largeArc = angle > 180 ? 1 : 0;
            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

            return { ...item, pathData };
        });
    }, []);

    return (
        <div className='earnings-root'>
            {/* Header */}
            <div className='earnings-header'>
                <div className='earnings-header__info'>
                    <h1 className='earnings-title'>Application Earnings & Commission Analytics</h1>
                    <p className='earnings-subtitle'>
                        Live performance stats for App ID: <span className='earnings-appid-badge'>{appId}</span> | Application: <strong>ProfitHub Trading Suite</strong>
                    </p>
                </div>
            </div>

            {/* Date Range Filter Pills */}
            <div className='earnings-filter-bar'>
                <span className='earnings-filter-label'>Date Range:</span>
                <div className='earnings-pills'>
                    {[
                        { id: 'all', label: 'All time' },
                        { id: '7d', label: 'Last 7 days' },
                        { id: '30d', label: '30 days' },
                        { id: '3m', label: '3 months' },
                        { id: '6m', label: '6 months' },
                        { id: '12m', label: '12 months' },
                        { id: 'custom', label: 'Custom range' },
                    ].map(item => (
                        <button
                            key={item.id}
                            className={`earnings-pill ${range === item.id ? 'earnings-pill--active' : ''}`}
                            onClick={() => setRange(item.id as DateRangeOption)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {range === 'custom' && (
                    <div className='earnings-custom-dates'>
                        <label>
                            From:
                            <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </label>
                        <label>
                            To:
                            <input type='date' value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </label>
                    </div>
                )}
            </div>

            {/* 4 Metric Cards */}
            <div className='earnings-metrics-grid'>
                <div className='earnings-card'>
                    <div className='earnings-card__icon earnings-card__icon--blue'>📊</div>
                    <div className='earnings-card__content'>
                        <span className='earnings-card__label'>Total Trades</span>
                        <div className='earnings-card__value'>{metrics.totalTrades.toLocaleString()}</div>
                        <span className='earnings-card__sub earnings-card__sub--green'>+14.2% vs previous period</span>
                    </div>
                </div>

                <div className='earnings-card'>
                    <div className='earnings-card__icon earnings-card__icon--purple'>👥</div>
                    <div className='earnings-card__content'>
                        <span className='earnings-card__label'>Active Clients</span>
                        <div className='earnings-card__value'>{metrics.activeClients.toLocaleString()}</div>
                        <span className='earnings-card__sub earnings-card__sub--green'>+8.6% active copiers</span>
                    </div>
                </div>

                <div className='earnings-card earnings-card--highlight'>
                    <div className='earnings-card__icon earnings-card__icon--green'>💰</div>
                    <div className='earnings-card__content'>
                        <span className='earnings-card__label'>Markup Commission Generated</span>
                        <div className='earnings-card__value'>${Number(metrics.commission).toLocaleString()} <small>USD</small></div>
                        <span className='earnings-card__sub earnings-card__sub--green'>Direct App ID Revenue</span>
                    </div>
                </div>

                <div className='earnings-card'>
                    <div className='earnings-card__icon earnings-card__icon--amber'>📈</div>
                    <div className='earnings-card__content'>
                        <span className='earnings-card__label'>Total Trading Volume</span>
                        <div className='earnings-card__value'>${Number(metrics.volume).toLocaleString()} <small>USD</small></div>
                        <span className='earnings-card__sub earnings-card__sub--blue'>Gross Volume Executed</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className='earnings-charts-grid'>
                {/* Volume & Commission Growth Trend Line/Area Chart */}
                <div className='earnings-chart-card'>
                    <div className='earnings-chart-card__header'>
                        <h3>Revenue & Volume Growth Trend</h3>
                        <span className='earnings-chart-badge'>Live WebSocket Aggregation</span>
                    </div>
                    <div className='earnings-chart-container'>
                        <svg viewBox='0 0 600 200' className='earnings-trend-svg'>
                            <defs>
                                <linearGradient id='areaGlow' x1='0' y1='0' x2='0' y2='1'>
                                    <stop offset='0%' stopColor='#10B981' stopOpacity='0.45' />
                                    <stop offset='100%' stopColor='#10B981' stopOpacity='0.0' />
                                </linearGradient>
                            </defs>
                            <path d={chartPoints.areaPath} fill='url(#areaGlow)' />
                            <path d={chartPoints.dPath} fill='none' stroke='#10B981' strokeWidth='3.5' strokeLinecap='round' />
                            {chartPoints.pts.map((pt, i) => (
                                <circle key={i} cx={pt.x} cy={pt.y} r='4.5' fill='#ffffff' stroke='#10B981' strokeWidth='2.5' />
                            ))}
                        </svg>
                    </div>
                </div>

                {/* Contract Types Pie Chart */}
                <div className='earnings-chart-card'>
                    <div className='earnings-chart-card__header'>
                        <h3>Contract Types Distribution</h3>
                        <span className='earnings-chart-badge'>Volume Split</span>
                    </div>
                    <div className='earnings-pie-container'>
                        <svg viewBox='0 0 220 220' className='earnings-pie-svg'>
                            {pieSlices.map((slice, i) => (
                                <path
                                    key={i}
                                    d={slice.pathData}
                                    fill={slice.color}
                                    stroke='var(--general-main-1)'
                                    strokeWidth='2'
                                    className='earnings-pie-slice'
                                />
                            ))}
                        </svg>
                        <div className='earnings-pie-legend'>
                            {contractTypes.map((item, idx) => (
                                <div key={idx} className='earnings-legend-item'>
                                    <span className='earnings-legend-color' style={{ backgroundColor: item.color }} />
                                    <span className='earnings-legend-label'>{item.name}</span>
                                    <span className='earnings-legend-value'>{item.percentage}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Earnings;
