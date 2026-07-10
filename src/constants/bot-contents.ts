type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    MATCHES: 1,
    BOT_BUILDER: 2,
    CHART: 3,
    TRADING_BOTS: 4,
    ANALYSIS_TOOL: 5,
    STRATEGIES: 6,
    COPY_TRADING: 7,
    DTRADER: 8,
    TRADINGVIEW: 9,
    ANALYSIS_PROFITHUB: 10,
    TUTORIAL: 11,
    SIGNALS: 12,
    AUTO_TRADES: 13,
    MANUAL_TRADING: 14,
    SCANNER: 15,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-matches',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-strategies',
    'id-copy-trading',
    'id-dtrader',
    'id-tradingview',
    'id-profihub',
    'id-tutorials',
    'id-signals',
    'id-auto-trades',
    'id-manual-trading',
    'id-scanner',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
