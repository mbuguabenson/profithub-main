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
    SIGNALS: 6,
    COPY_TRADING: 7,
    TRADINGVIEW: 8,
    SMART_TRADING: 9,
    SMART_ANALYSIS: 10,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-trading-bots',
    'id-analysis-tool',
    'id-automated',
    'id-signals',
    'id-copy-trading',
    'id-tradingview',
    'id-smart-trading',
    'id-smart-analysis',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
