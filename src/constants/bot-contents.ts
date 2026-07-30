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
    BOT_BUILDER: 1,
    CHART: 2,
    TRADING_BOTS: 3,
    ANALYSIS_TOOL: 4,
    CIRCLES_ANALYSIS: 5,
    DIGIT_CRACKER: 6,
    SIGNALS: 7,
    AUTO_TRADES: 8,
    SCANNER: 9,
    MANUAL_TRADING: 10,
    MARKETKILLER: 11,
    MULTI_TRADER: 12,
    COPY_TRADING: 13,
    TRADINGVIEW: 14,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-circles-analysis',
    'id-digit-cracker',
    'id-signals',
    'id-auto-trades',
    'id-scanner',
    'id-manual-trading',
    'id-marketkiller',
    'id-multi-trader',
    'id-copy-trading',
    'id-tradingview',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
