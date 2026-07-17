const SUPABASE_URL = 'https://bljwlgebdrgfqcsawygs.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsandsZ2ViZHJnZnFjc2F3eWdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjA5NTgsImV4cCI6MjA4MzI5Njk1OH0.vgcxmT6mR62LbynwhS177biIwZCqr-GR9kIigr5HLO4';

export interface CopyTraderProfile {
    loginid: string;
    display_name: string;
    description: string;
    is_public: boolean;
    win_rate?: number;
    total_trades?: number;
}

export interface CopyRequest {
    id?: string;
    requester_loginid: string;
    requester_token: string;
    provider_loginid: string;
    status: 'pending' | 'accepted' | 'rejected' | 'stopped';
    created_at?: string;
    accepted_at?: string;
}

// Ensure the tables copy_traders and copy_requests are populated/stored.
// Since Supabase REST works on tables via endpoints, let's wrap them in try/catch fetch.

export const publishTraderProfile = async (profile: CopyTraderProfile): Promise<boolean> => {
    try {
        // Upsert or insert via POST with resolution
        const response = await fetch(`${SUPABASE_URL}/rest/v1/copy_traders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(profile),
        });
        return response.ok;
    } catch (e) {
        console.error('Failed to publish trader profile to Supabase:', e);
        return false;
    }
};

export const getPublicTraders = async (): Promise<CopyTraderProfile[]> => {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/copy_traders?is_public=eq.true&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );
        if (!response.ok) return [];
        return await response.json();
    } catch {
        return [];
    }
};

export const getTraderProfile = async (loginid: string): Promise<CopyTraderProfile | null> => {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/copy_traders?loginid=eq.${encodeURIComponent(loginid)}&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data && data.length > 0 ? data[0] : null;
    } catch {
        return null;
    }
};

// Copy Requests

export const requestFollowProvider = async (
    requesterLoginid: string,
    requesterToken: string,
    providerLoginid: string
): Promise<boolean> => {
    try {
        const requestData: CopyRequest = {
            requester_loginid: requesterLoginid,
            requester_token: requesterToken,
            provider_loginid: providerLoginid,
            status: 'pending',
        };

        // First clean up any existing request for the same pair
        await deleteRequest(requesterLoginid, providerLoginid);

        const response = await fetch(`${SUPABASE_URL}/rest/v1/copy_requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(requestData),
        });
        return response.ok;
    } catch (e) {
        console.error('Failed to request follow from Supabase:', e);
        return false;
    }
};

export const deleteRequest = async (requesterLoginid: string, providerLoginid: string): Promise<boolean> => {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/copy_requests?requester_loginid=eq.${encodeURIComponent(
                requesterLoginid
            )}&provider_loginid=eq.${encodeURIComponent(providerLoginid)}`,
            {
                method: 'DELETE',
                headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );
        return response.ok;
    } catch {
        return false;
    }
};

export const getCopyRequestStatus = async (
    requesterLoginid: string,
    providerLoginid: string
): Promise<CopyRequest | null> => {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/copy_requests?requester_loginid=eq.${encodeURIComponent(
                requesterLoginid
            )}&provider_loginid=eq.${encodeURIComponent(providerLoginid)}&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );
        if (!response.ok) return null;
        const data = await response.json();
        return data && data.length > 0 ? data[0] : null;
    } catch {
        return null;
    }
};

// Admin REST operations

export const getPendingRequestsForProvider = async (providerLoginid: string): Promise<CopyRequest[]> => {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/copy_requests?provider_loginid=eq.${encodeURIComponent(
                providerLoginid
            )}&select=*`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );
        if (!response.ok) return [];
        return await response.json();
    } catch {
        return [];
    }
};

export const updateCopyRequestStatus = async (
    requestId: string,
    status: 'accepted' | 'rejected' | 'stopped'
): Promise<boolean> => {
    try {
        const updateData: Partial<CopyRequest> = {
            status,
            ...(status === 'accepted' && { accepted_at: new Date().toISOString() }),
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/copy_requests?id=eq.${requestId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(updateData),
        });
        return response.ok;
    } catch {
        return false;
    }
};

// ─── Chat Messages (localStorage-backed) ─────────────────────────────────────
export interface ChatMessage {
    id: string;
    sender: 'client' | 'admin';
    loginid: string;
    text: string;
    timestamp: number;
}

const CHAT_STORAGE_KEY = 'profithub_chat_messages';

export const sendChatMessage = (msg: Omit<ChatMessage, 'id'>): ChatMessage => {
    const fullMsg: ChatMessage = { ...msg, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
    try {
        const existing: ChatMessage[] = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
        existing.push(fullMsg);
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(existing));
    } catch { /* ignore */ }
    return fullMsg;
};

export const getChatMessages = (loginid?: string): ChatMessage[] => {
    try {
        const all: ChatMessage[] = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
        if (!loginid) return all;
        return all.filter(m => m.loginid === loginid);
    } catch { return []; }
};

export const getChatSessions = (): string[] => {
    try {
        const all: ChatMessage[] = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
        return [...new Set(all.map(m => m.loginid))];
    } catch { return []; }
};

// ─── Frontend Site Configuration (localStorage-backed) ────────────────────────
export interface SiteConfig {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoBase64: string;
    tabConfig: TabConfigItem[];
    disabledTabs: string[];
    maintenanceMode: boolean;
    maintenanceMessage: string;
}

export interface TabConfigItem {
    key: string;
    label: string;
    enabled: boolean;
    order: number;
}

const SITE_CONFIG_KEY = 'profithub_site_config';

export const getDefaultTabConfig = (): TabConfigItem[] => [
    { key: 'dashboard', label: 'Dashboard', enabled: true, order: 0 },
    { key: 'bot_builder', label: 'Bot Builder', enabled: true, order: 1 },
    { key: 'chart', label: 'Charts', enabled: true, order: 2 },
    { key: 'trading_bots', label: 'Trading Bots', enabled: true, order: 3 },
    { key: 'analysis_tool', label: 'Analysis Tool', enabled: true, order: 4 },
    { key: 'copy_trading', label: 'Copy Trading', enabled: true, order: 5 },
    { key: 'tradingview', label: 'TradingView', enabled: true, order: 6 },
    { key: 'tutorials', label: 'Tutorials', enabled: true, order: 7 },
    { key: 'signals', label: 'Signals', enabled: true, order: 8 },
    { key: 'auto_trades', label: 'Auto Trades', enabled: true, order: 9 },
    { key: 'scanner', label: 'AI Strategy Scanner', enabled: true, order: 10 },
    { key: 'smart_auto', label: 'SmartAuto', enabled: true, order: 11 },
    { key: 'manual_trading', label: 'Manual Trading', enabled: true, order: 12 },
    { key: 'easy_tool', label: 'Easy Tool', enabled: true, order: 13 },
    { key: 'signal_centre', label: 'Signal Centre', enabled: true, order: 14 },
    { key: 'marketkiller', label: 'MarketKiller', enabled: true, order: 15 },
    { key: 'multi_trader', label: 'Multi Trader', enabled: true, order: 16 },
];

export const getSiteConfig = (): SiteConfig => {
    try {
        const raw = localStorage.getItem(SITE_CONFIG_KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
        primaryColor: '#f5c542',
        secondaryColor: '#0e0e0e',
        accentColor: '#3b82f6',
        fontFamily: 'Inter',
        logoBase64: '',
        tabConfig: getDefaultTabConfig(),
        disabledTabs: [],
        maintenanceMode: false,
        maintenanceMessage: 'We are currently performing scheduled maintenance. Please check back shortly.',
    };
};

export const saveSiteConfig = (config: Partial<SiteConfig>): void => {
    const current = getSiteConfig();
    const merged = { ...current, ...config };
    localStorage.setItem(SITE_CONFIG_KEY, JSON.stringify(merged));
    // Dispatch event so the main site picks it up in real-time
    window.dispatchEvent(new CustomEvent('profithub_config_changed', { detail: merged }));
};

// ─── Uploaded Bots (localStorage-backed) ──────────────────────────────────────
export interface UploadedBot {
    id: string;
    name: string;
    description: string;
    xml: string;
    uploadedAt: number;
}

const UPLOADED_BOTS_KEY = 'profithub_uploaded_bots';

export const getUploadedBots = (): UploadedBot[] => {
    try { return JSON.parse(localStorage.getItem(UPLOADED_BOTS_KEY) || '[]'); } catch { return []; }
};

export const saveUploadedBot = (bot: Omit<UploadedBot, 'id' | 'uploadedAt'>): void => {
    const bots = getUploadedBots();
    bots.push({ ...bot, id: `bot-${Date.now()}`, uploadedAt: Date.now() });
    localStorage.setItem(UPLOADED_BOTS_KEY, JSON.stringify(bots));
};

export const deleteUploadedBot = (id: string): void => {
    const bots = getUploadedBots().filter(b => b.id !== id);
    localStorage.setItem(UPLOADED_BOTS_KEY, JSON.stringify(bots));
};
