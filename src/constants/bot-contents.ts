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
    AUTOMATED: 5,
    CIRCLES_ANALYSIS: 6,
    DIGIT_CRACKER: 7,
    SIGNALS: 8,
    AUTO_TRADES: 9,
    SCANNER: 10,
    MANUAL_TRADING: 11,
    MARKETKILLER: 12,
    MULTI_TRADER: 13,
    COPY_TRADING: 14,
    TRADINGVIEW: 15,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-automated',
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
