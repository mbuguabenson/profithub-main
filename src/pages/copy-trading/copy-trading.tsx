import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import CopyTradingManager from './copy-trading-manager';
import { getGlobalCopyTradingManager } from './copy-trading-manager-singleton';
import Dialog from '@/components/shared_ui/dialog';
import { useStore } from '@/hooks/useStore';
import { getTradeLogs } from './replicator';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import {
    requestFollowProvider,
    getCopyRequestStatus,
    deleteRequest,
} from '@/utils/supabase-copy';
import './copy-trading.scss';

// ─── Token Bridge Utilities ───────────────────────────────────────────────────
const getAccountsList = (): Record<string, string> => {
    try {
        return JSON.parse(localStorage.getItem('accountsList') || '{}');
    } catch {
        return {};
    }
};

const getActiveLoginId = (): string => localStorage.getItem('active_loginid') || '';

const getActiveToken = (): string | null => {
    const list = getAccountsList();
    const id = getActiveLoginId();
    return list[id] || null;
};

const getCopyTokensArray = (): string[] => {
    try {
        return JSON.parse(localStorage.getItem('copyTokensArray') || '[]');
    } catch {
        return [];
    }
};

// ─── Component ────────────────────────────────────────────────────────────────
const CopyTrading = observer(() => {
    const { client, ui } = useStore();
    const htmlContentRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<CopyTradingManager | null>(null);

    // Dynamic theme mode directly from main site UI store
    const isDark = ui.is_dark_mode_on;

    // Active tab
    const [activeTab, setActiveTab] = useState<'dashboard' | 'marketplace' | 'clients' | 'logs' | 'settings'>('dashboard');

    // UI state
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [tutorialUrl, setTutorialUrl] = useState('');
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [demoToRealActive, setDemoToRealActive] = useState(false);
    const [copyTradingActive, setCopyTradingActive] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [successMessage2, setSuccessMessage2] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [tick, setTick] = useState(0);
    void tick;

    // Account info state
    const [loginIdDisplay, setLoginIdDisplay] = useState<string>('Loading...');
    const [balanceDisplay, setBalanceDisplay] = useState<string>('------');
    const [clientsTotal, setClientsTotal] = useState(0);
    const [clientsConnected, setClientsConnected] = useState(0);
    const [copierList, setCopierList] = useState<string[]>([]);

    // Live Trade Logs state
    const [tradeLogs, setTradeLogs] = useState<any[]>([]);

    // Profithubadmin Follow state
    const [adminFollowStatus, setAdminFollowStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected'>('none');
    const [isLoadingAdminStatus, setIsLoadingAdminStatus] = useState(false);
    const [showAccountPublic, setShowAccountPublic] = useState(() => localStorage.getItem('show_account_public') === 'true');
    
    // Copy Trading Terms & Disclaimer states
    const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
    const [termsAccepted1, setTermsAccepted1] = useState(false);
    const [termsAccepted2, setTermsAccepted2] = useState(false);


    // ─── Helpers ──────────────────────────────────────────────────────────────
    const refreshClientList = useCallback(() => {
        const tokens = getCopyTokensArray();
        setCopierList(tokens);
        setClientsTotal(tokens.length);
        const manager = managerRef.current;
        if (manager) {
            const connected = manager.copiers.filter(c => c.status === 'connected').length;
            setClientsConnected(connected);
        } else {
            setClientsConnected(0);
        }
    }, []);

    // ─── Copy Trading Manager Initialization ─────────────────────────────────
    useEffect(() => {
        const autoSyncLoginTokens = async (manager: CopyTradingManager) => {
            const accountsList = getAccountsList();
            const activeToken = getActiveToken();
            let arr = getCopyTokensArray();
            let added = 0;
            Object.values(accountsList).forEach((token: string) => {
                if (token && token !== activeToken && !arr.includes(token)) {
                    arr.push(token);
                    try {
                        const copier = manager.addCopier(token);
                        const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
                        if (isCopyTrading && copier) {
                            void manager.connectCopier(copier.id).catch(() => {});
                        }
                        added++;
                    } catch {
                        /* Ignore */
                    }
                }
            });
            if (added > 0) {
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
            }
            refreshClientList();
        };

        const setupManager = () => {
            const globalManager = getGlobalCopyTradingManager();
            if (globalManager) {
                managerRef.current = globalManager;
                void autoSyncLoginTokens(globalManager);
                return true;
            }
            return false;
        };

        if (!setupManager()) {
            const retryInterval = setInterval(() => {
                if (setupManager()) clearInterval(retryInterval);
            }, 100);

            setTimeout(() => {
                clearInterval(retryInterval);
                if (!managerRef.current) {
                    const m = new CopyTradingManager();
                    managerRef.current = m;
                    void autoSyncLoginTokens(m);
                }
            }, 2000);
        }

        // Sync demo to real & restore state
        const syncTokensToManager = async () => {
            const manager = managerRef.current;
            if (!manager) return;
            await new Promise(resolve => setTimeout(resolve, 150));

            const isDemoToReal = localStorage.getItem('demo_to_real') === 'true';
            if (isDemoToReal) {
                const accounts_list = getAccountsList();
                const key = Object.keys(accounts_list).find(k => !k.startsWith('VR'));
                if (key) manager.setMasterToken(accounts_list[key]);
            }

            const isCopyTrading = localStorage.getItem('iscopyTrading') === 'true';
            const copyTokensArray = getCopyTokensArray();
            for (const token of copyTokensArray) {
                let copier = manager.copiers.find(c => c.token === token);
                if (!copier) {
                    try {
                        copier = manager.addCopier(token);
                    } catch {
                        /* Already exists */
                    }
                }
                if (isCopyTrading && copier && copier.status !== 'connected') {
                    void manager.connectCopier(copier.id).catch(() => {});
                }
            }
            refreshClientList();
        };

        setTimeout(syncTokensToManager, 200);

        setDemoToRealActive(localStorage.getItem('demo_to_real') === 'true');
        setCopyTradingActive(localStorage.getItem('iscopyTrading') === 'true');

        const logInterval = setInterval(() => setTradeLogs(getTradeLogs()), 1000);
        return () => clearInterval(logInterval);
    }, [refreshClientList]);

    // ─── Account Details Poller ───────────────────────────────────────────────
    useEffect(() => {
        const updateAccountDetails = () => {
            const activeId = client.loginid || getActiveLoginId();
            if (activeId) {
                setLoginIdDisplay(activeId.startsWith('VR') ? `Demo: ${activeId}` : activeId);
                const bal = Number(client.balance);
                const curr = client.currency || 'USD';
                if (!isNaN(bal) && bal > 0) {
                    setBalanceDisplay(`${bal.toFixed(2)} ${curr}`);
                } else {
                    const m = managerRef.current;
                    if (m?.master?.balance) {
                        setBalanceDisplay(`${m.master.balance.toFixed(2)} ${curr}`);
                    } else {
                        setBalanceDisplay(`0.00 ${curr}`);
                    }
                }
            } else {
                setLoginIdDisplay('Not Logged In');
                setBalanceDisplay('0.00 USD');
            }
            refreshClientList();
        };

        updateAccountDetails();
        const interval = setInterval(updateAccountDetails, 3000);
        return () => clearInterval(interval);
    }, [client.loginid, client.balance, client.currency, refreshClientList]);

    // ─── Fetch Supabase Admin Follow Status ────────────────────────────────────
    const checkAdminFollowStatus = useCallback(async () => {
        const token = getActiveToken();
        if (!token) return;
        setIsLoadingAdminStatus(true);
        try {
            const req = await getCopyRequestStatus(token);
            if (!req) {
                setAdminFollowStatus('none');
            } else {
                setAdminFollowStatus(req.status as any);
            }
        } catch {
            setAdminFollowStatus('none');
        } finally {
            setIsLoadingAdminStatus(false);
        }
    }, []);

    useEffect(() => {
        void checkAdminFollowStatus();
    }, [checkAdminFollowStatus]);

    // ─── Follow Admin Trigger ──────────────────────────────────────────────────
    const handleFollowAdmin = () => {
        const activeId = getActiveLoginId();
        if (!activeId || activeId.startsWith('VR')) {
            setErrorMessage('Profithubadmin copy trading is only available for Real Deriv accounts (CR/ROT). Please switch to a real account first.');
            setErrorModalVisible(true);
            return;
        }
        setTermsAccepted1(false);
        setTermsAccepted2(false);
        setIsTermsModalOpen(true);
    };

    const handleFollowAdminSubmit = async () => {
        if (!termsAccepted1 || !termsAccepted2) {
            setErrorMessage('You must accept both the Profit Split Agreement and the Risk Disclaimer to proceed.');
            setErrorModalVisible(true);
            return;
        }
        setIsTermsModalOpen(false);

        const token = getActiveToken();
        const loginid = getActiveLoginId();
        if (!token || !loginid) {
            setErrorMessage('Unable to find active account token. Please ensure you are logged in.');
            setErrorModalVisible(true);
            return;
        }

        setIsLoadingAdminStatus(true);
        try {
            const result = await requestFollowProvider(loginid, token, 'Profithubadmin');
            if (result.success) {
                setAdminFollowStatus('pending');
                setSuccessMessage('✅ Request submitted! Awaiting admin approval.');
                setTimeout(() => setSuccessMessage(''), 6000);
            } else {
                setErrorMessage(result.error || 'Failed to submit follow request.');
                setErrorModalVisible(true);
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'An unexpected error occurred while requesting to follow.');
            setErrorModalVisible(true);
        } finally {
            setIsLoadingAdminStatus(false);
        }
    };

    const handleStopFollowAdmin = async () => {
        const token = getActiveToken();
        if (!token) return;
        setIsLoadingAdminStatus(true);
        try {
            const success = await deleteRequest(token);
            if (success) {
                setAdminFollowStatus('none');
                setSuccessMessage('Stopped following Profithubadmin.');
                setTimeout(() => setSuccessMessage(''), 4000);
            }
        } catch {
            setErrorMessage('Failed to stop following provider.');
            setErrorModalVisible(true);
        } finally {
            setIsLoadingAdminStatus(false);
        }
    };

    // ─── Actions ──────────────────────────────────────────────────────────────
    const handleSyncTokens = async () => {
        setIsSyncing(true);
        const manager = managerRef.current;
        if (manager) {
            const accountsList = getAccountsList();
            const activeToken = getActiveToken();
            let arr = getCopyTokensArray();
            let added = 0;
            Object.values(accountsList).forEach((token: string) => {
                if (token && token !== activeToken && !arr.includes(token)) {
                    arr.push(token);
                    try {
                        manager.addCopier(token);
                        added++;
                    } catch {
                        /* Ignore */
                    }
                }
            });
            if (added > 0) {
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
            }
            refreshClientList();
        }
        await new Promise(resolve => setTimeout(resolve, 600));
        setIsSyncing(false);
    };

    const handleDemoToReal = async () => {
        const isDemo = demoToRealActive;
        const manager = managerRef.current;
        if (!manager) {
            setErrorMessage('Copy Trading Engine not initialized. Please refresh.');
            setErrorModalVisible(true);
            return;
        }

        if (!isDemo) {
            const accounts = getAccountsList();
            const realAccountKey = Object.keys(accounts).find(k => !k.startsWith('VR'));

            if (realAccountKey) {
                const realToken = accounts[realAccountKey];
                const loginid = realAccountKey;

                let copier = manager.copiers.find(c => c.token === realToken);
                if (!copier) {
                    try {
                        copier = manager.addCopier(realToken);
                    } catch {
                        /* Ignore */
                    }
                }

                if (copier) {
                    try {
                        await manager.connectCopier(copier.id);
                    } catch {
                        /* Ignore */
                    }
                }

                manager.enableReplication(true);
                localStorage.setItem('demo_to_real', 'true');
                localStorage.setItem('iscopyTrading', 'true');
                setCopyTradingActive(true);

                if (localStorage.getItem('iscopyTrading') === 'true') {
                    try {
                        await manager.connectMaster();
                    } catch {
                        /* Ignore */
                    }
                }

                // Reconnect WebSocket to pick up the swapped/overridden token
                const active = getActiveLoginId();
                if (active && !active.startsWith('VR')) {
                    try {
                        const { clearDerivApiInstance } = await import('@/external/bot-skeleton/services/api/appId');
                        clearDerivApiInstance();
                        void api_base.init(true);
                    } catch (err) {
                        console.error('Error switching connection to Demo:', err);
                    }
                }

                setDemoToRealActive(true);
                setSuccessMessage(`✅ Demo to Real copy trading activated for account ${loginid}`);
                setTimeout(() => setSuccessMessage(''), 6000);
                refreshClientList();
            } else {
                setErrorMessage('No real account (CR/ROT) found in your session. Please make sure you are logged into a real Deriv account or add your real account token.');
                setErrorModalVisible(true);
            }
        } else {
            manager.enableReplication(false);
            localStorage.setItem('demo_to_real', 'false');
            setDemoToRealActive(false);

            if (!copyTradingActive) {
                manager.disconnectMaster();
            }

            setSuccessMessage('⏹️ Demo to Real copy trading deactivated.');
            setTimeout(() => setSuccessMessage(''), 4000);
            refreshClientList();
        }
    };

    const handleStartCopyTrading = async () => {
        const isStart = !copyTradingActive;
        const manager = managerRef.current;
        if (!manager) {
            setErrorMessage('Engine initialization pending. Please try again.');
            setErrorModalVisible(true);
            return;
        }

        if (isStart) {
            const masterToken = getActiveToken();
            if (!masterToken) {
                setErrorMessage('No active session token found. Please log in to your account.');
                setErrorModalVisible(true);
                return;
            }

            const copyTokensArray = getCopyTokensArray();
            if (copyTokensArray.length === 0) {
                setErrorMessage('No client accounts added yet. Please add client tokens or use Auto-Import from Login Session.');
                setErrorModalVisible(true);
                return;
            }

            try {
                manager.setMasterToken(masterToken);
                await manager.connectMaster();

                for (const token of copyTokensArray) {
                    let copier = manager.copiers.find(c => c.token === token);
                    if (!copier) {
                        try {
                            copier = manager.addCopier(token);
                        } catch {
                            /* Ignore */
                        }
                    }
                    if (copier) {
                        try {
                            await manager.connectCopier(copier.id);
                        } catch (connErr: any) {
                            console.warn(`Could not connect client ${copier.id}:`, connErr);
                        }
                    }
                }

                manager.enableReplication(true);
                localStorage.setItem('iscopyTrading', 'true');
                setCopyTradingActive(true);
                setSuccessMessage2(`🚀 Replication live for ${copyTokensArray.length} clients!`);
                setTimeout(() => setSuccessMessage2(''), 8000);
            } catch (err) {
                setErrorMessage(`Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}`);
                setErrorModalVisible(true);
            }
        } else {
            manager.enableReplication(false);
            manager.disconnectMaster();
            manager.copiers.forEach(c => manager.disconnectCopier(c.id));
            localStorage.setItem('iscopyTrading', 'false');
            setCopyTradingActive(false);
            setSuccessMessage2('⏸️ Replication paused');
            setTimeout(() => setSuccessMessage2(''), 6000);
        }
    };

    const handleAddToken = async () => {
        const newToken = tokenInput.trim();
        const manager = managerRef.current;
        if (!manager) {
            setErrorMessage('Manager not active. Please log in first.');
            setErrorModalVisible(true);
            return;
        }
        if (!newToken) return;

        const arr = getCopyTokensArray();
        if (arr.includes(newToken)) {
            setErrorMessage('This token is already in your client list.');
            setErrorModalVisible(true);
        } else {
            try {
                const copier = manager.addCopier(newToken);
                try {
                    await manager.connectCopier(copier.id);
                } catch (connErr: any) {
                    manager.removeCopier(copier.id);
                    throw connErr;
                }

                arr.push(newToken);
                localStorage.setItem('copyTokensArray', JSON.stringify(arr));
                setTokenInput('');
                refreshClientList();
            } catch (e: any) {
                const errMsg = e?.error?.message || e?.message || 'Authorization failed. Make sure the token is valid.';
                setErrorMessage(errMsg);
                setErrorModalVisible(true);
            }
        }
    };

    const handleRemoveToken = (tokenToRemove: string) => {
        const manager = managerRef.current;
        const tokens = getCopyTokensArray().filter(t => t !== tokenToRemove);
        
        if (manager) {
            const copier = manager.copiers.find(c => c.token === tokenToRemove);
            if (copier) manager.removeCopier(copier.id);
        }
        localStorage.setItem('copyTokensArray', JSON.stringify(tokens));
        refreshClientList();
    };

    const handleAutoImportTokens = () => {
        const accountsList = getAccountsList();
        const activeToken = getActiveToken();
        let arr = getCopyTokensArray();
        let added = 0;
        Object.values(accountsList).forEach((token: string) => {
            if (token && token !== activeToken && !arr.includes(token)) {
                arr.push(token);
                if (managerRef.current) {
                    try {
                        const copier = managerRef.current.addCopier(token);
                        if (copyTradingActive && copier) {
                            void managerRef.current.connectCopier(copier.id).catch(() => {});
                        }
                    } catch {
                        /* Ignore */
                    }
                }
                added++;
            }
        });

        if (added > 0) {
            localStorage.setItem('copyTokensArray', JSON.stringify(arr));
            setSuccessMessage2(`✅ Auto-imported ${added} account tokens from your login session!`);
            setTimeout(() => setSuccessMessage2(''), 5000);
            refreshClientList();
        } else {
            setErrorMessage('No additional login tokens found to import.');
            setErrorModalVisible(true);
        }
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccessMessage2('📋 Token copied to clipboard!');
        setTimeout(() => setSuccessMessage2(''), 3000);
    };

    const openTutorial = () => {
        setTutorialUrl('https://www.youtube.com/embed/gsWzKmslEnY');
        setIsTutorialOpen(true);
    };
    const closeTutorial = () => {
        setIsTutorialOpen(false);
        setTutorialUrl('');
    };

    const truncateToken = (t: string) => (t.length > 14 ? `${t.slice(0, 6)}••••${t.slice(-4)}` : t);

    return (
        <div className={`ct2-root ${isDark ? 'ct2-root--dark' : 'ct2-root--light'}`} ref={htmlContentRef}>
            {/* Error Dialog */}
            <Dialog
                is_visible={errorModalVisible}
                title='System Alert'
                confirm_button_text='OK'
                onConfirm={() => setErrorModalVisible(false)}
                onClose={() => setErrorModalVisible(false)}
                portal_element_id='modal_root'
                login={() => {}}
            >
                <div className='ct2-dialog-body'>{errorMessage}</div>
            </Dialog>

            {/* Terms and Conditions Dialog */}
            <Dialog
                is_visible={isTermsModalOpen}
                title='Copy Trading Agreement & Disclaimer'
                confirm_button_text='Accept & Follow'
                cancel_button_text='Decline'
                onConfirm={handleFollowAdminSubmit}
                onCancel={() => setIsTermsModalOpen(false)}
                onClose={() => setIsTermsModalOpen(false)}
                portal_element_id='modal_root'
                login={() => {}}
            >
                <div className='ct2-dialog-body' style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6' }}>
                    <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', color: '#60a5fa', fontWeight: 'bold' }}>Profit Split Agreement (20%)</h4>
                        <p style={{ margin: 0 }}>By continuing, you agree that 20% of net profits earned from copy trading activity will be shared with the master trader. Billings are computed and billed weekly.</p>
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 6px 0', color: '#f87171', fontWeight: 'bold' }}>Risk Disclaimer & Liability Limitation</h4>
                        <p style={{ margin: 0 }}>Trading binary options and digital contracts involves high financial risk. The system replicates trades automatedly. The admin and platform are NOT liable for any trading losses incurred. You copy at your own risk.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type='checkbox'
                                checked={termsAccepted1}
                                onChange={e => setTermsAccepted1(e.target.checked)}
                                style={{ marginTop: '3px' }}
                            />
                            <span>I agree to share 20% of net profits generated by copy trading.</span>
                        </label>
                        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                            <input
                                type='checkbox'
                                checked={termsAccepted2}
                                onChange={e => setTermsAccepted2(e.target.checked)}
                                style={{ marginTop: '3px' }}
                            />
                            <span>I acknowledge the risk disclaimer and agree the admin is not liable for losses.</span>
                        </label>
                    </div>
                </div>
            </Dialog>

            {/* Tutorial Overlay */}
            {isTutorialOpen && (
                <div className='ct2-video-overlay' onClick={closeTutorial}>
                    <div className='ct2-video-wrapper' onClick={e => e.stopPropagation()}>
                        <button className='ct2-video-close' onClick={closeTutorial}>
                            ✕
                        </button>
                        <iframe
                            width='100%'
                            height='100%'
                            src={tutorialUrl}
                            title='Copy Trading Tutorial'
                            frameBorder='0'
                            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                            allowFullScreen
                        />
                    </div>
                </div>
            )}

            {/* ── Animated Background ── */}
            <div className='ct2-bg'>
                <div className='ct2-bg__mesh' />
                <div className='ct2-bg__orb ct2-bg__orb--1' />
                <div className='ct2-bg__orb ct2-bg__orb--2' />
                <div className='ct2-bg__orb ct2-bg__orb--3' />
            </div>

            {/* ── Main Content ── */}
            <div className='ct2-content'>
                {/* ── Hero Banner (Mockup UI) ── */}
                <div className='ct2-hero-banner'>
                    <div className='ct2-hero-banner__left'>
                        <div className='ct2-hero-banner__badge'>
                            <span className='ct2-hero-banner__badge-icon'>✨</span>
                            <span>LIVE COPY TRADING</span>
                            <span className='ct2-hero-banner__badge-sep'>•</span>
                            <span>👤 {loginIdDisplay}</span>
                            <span className='ct2-hero-banner__badge-sep'>•</span>
                            <span style={{ color: '#22c55e' }}>💰 {balanceDisplay}</span>
                        </div>

                        <h2 className='ct2-hero-banner__headline'>Your account, your control.</h2>
                        <h1 className='ct2-hero-banner__title'>
                            Maximize Gains with <span className='ct2-hero-banner__gradient-text'>CopyTrading</span>
                        </h1>

                        <p className='ct2-hero-banner__subtitle'>
                            Mirror trades from your master account to multiple client accounts in real time — automatically and instantly.
                        </p>

                        {/* Stat Pills */}
                        <div className='ct2-hero-banner__stats-bar'>
                            <div className='ct2-stat-pill'>
                                <span className='ct2-stat-pill__value'>{clientsTotal}</span>
                                <span className='ct2-stat-pill__label'>LINKED ACCOUNTS</span>
                            </div>
                            <div className='ct2-stat-pill'>
                                <span className='ct2-stat-pill__status'>
                                    <span className={`ct2-status-dot ${copyTradingActive ? 'ct2-status-dot--active' : ''}`} />
                                    {copyTradingActive ? `Active (${clientsConnected} Connected)` : 'Idle'}
                                </span>
                                <span className='ct2-stat-pill__label'>COPY STATUS</span>
                            </div>
                            <div className='ct2-stat-pill'>
                                <span className='ct2-stat-pill__value'>{tradeLogs.length}</span>
                                <span className='ct2-stat-pill__label'>TRADES REPLICATED</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Radar/Target Emblem & Guide Button */}
                    <div className='ct2-hero-banner__right'>
                        <button
                            className='ct2-btn-glass'
                            onClick={openTutorial}
                            title='Watch Copy Trading Guide'
                        >
                            ▶ Video Guide
                        </button>

                        <div className='ct2-hero-emblem'>
                            <div className='ct2-hero-emblem__ring ct2-hero-emblem__ring--outer' />
                            <div className='ct2-hero-emblem__ring ct2-hero-emblem__ring--inner' />
                            <div className='ct2-hero-emblem__center'>
                                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="6" />
                                    <circle cx="12" cy="12" r="2" />
                                    <line x1="12" y1="2" x2="12" y2="4" />
                                    <line x1="12" y1="20" x2="12" y2="22" />
                                    <line x1="2" y1="12" x2="4" y2="12" />
                                    <line x1="20" y1="12" x2="22" y2="12" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {successMessage && (
                    <div className='ct2-success-banner ct2-success-banner--centered'>{successMessage}</div>
                )}
                {successMessage2 && (
                    <div className='ct2-success-banner ct2-success-banner--centered'>{successMessage2}</div>
                )}

                {/* ── Tab Bar ── */}
                <div className='ct2-tabs'>
                    {(['dashboard', 'marketplace', 'clients', 'logs', 'settings'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`ct2-tab ${activeTab === tab ? 'ct2-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'dashboard' && '📊'}
                            {tab === 'marketplace' && '🛍️'}
                            {tab === 'clients' && '👥'}
                            {tab === 'logs' && '📡'}
                            {tab === 'settings' && '⚙️'}
                            <span>{tab === 'clients' ? 'My Clients' : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                            {tab === 'clients' && clientsTotal > 0 && (
                                <span className='ct2-tab__badge'>{clientsTotal}</span>
                            )}
                            {tab === 'logs' && tradeLogs.length > 0 && (
                                <span className='ct2-tab__badge ct2-tab__badge--pulse'>{tradeLogs.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Dashboard Tab (Matching Mockup Grid) ── */}
                {activeTab === 'dashboard' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-dashboard-grid'>
                            {/* Left Column Stack */}
                            <div className='ct2-dashboard-grid__left'>
                                {/* Card 1: Demo -> Real */}
                                <div className='ct2-card ct2-card--demo-real'>
                                    <div className='ct2-card__header'>
                                        <div className='ct2-card__icon-badge ct2-card__icon-badge--blue'>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                        </div>
                                        <h3 className='ct2-card__title'>Demo → Real</h3>
                                    </div>
                                    <p className='ct2-card__desc'>
                                        Mirror trades from your demo account to your real account automatically.
                                    </p>
                                    <button
                                        className={`ct2-action-btn ${demoToRealActive ? 'ct2-action-btn--danger' : 'ct2-action-btn--gradient-blue'}`}
                                        onClick={handleDemoToReal}
                                    >
                                        {demoToRealActive ? '⏹ Stop Demo → Real' : '▶ Start Demo → Real'}
                                    </button>
                                </div>

                                {/* Card 2: Token Replicator */}
                                <div className='ct2-card ct2-card--token-replicator'>
                                    <div className='ct2-card__header'>
                                        <div className='ct2-card__icon-badge ct2-card__icon-badge--amber'>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                                        </div>
                                        <h3 className='ct2-card__title'>Token Replicator</h3>
                                    </div>
                                    <p className='ct2-card__desc'>
                                        Add client API tokens. When you trade, all linked accounts receive the same trade instantly.
                                    </p>

                                    <div className='ct2-token-input-row'>
                                        <input
                                            type='text'
                                            className='ct2-input-glass'
                                            placeholder='Paste client API token...'
                                            value={tokenInput}
                                            onChange={e => setTokenInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddToken()}
                                        />
                                        <button className='ct2-btn-blue' onClick={handleAddToken}>
                                            Add
                                        </button>
                                        <button className='ct2-btn-glass' onClick={handleSyncTokens} disabled={isSyncing}>
                                            {isSyncing ? '↻ Syncing…' : '🔄 Sync'}
                                        </button>
                                    </div>

                                    <button
                                        className={`ct2-action-btn ${copyTradingActive ? 'ct2-action-btn--danger' : 'ct2-action-btn--gradient-purple'}`}
                                        onClick={handleStartCopyTrading}
                                    >
                                        {copyTradingActive ? 'PAUSE REPLICATION' : '▶ Start Copy Trading'}
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Replicated Accounts */}
                            <div className='ct2-dashboard-grid__right'>
                                <div className='ct2-card ct2-card--replicated-accounts'>
                                    <div className='ct2-card__header'>
                                        <div className='ct2-card__icon-badge ct2-card__icon-badge--purple'>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        </div>
                                        <h3 className='ct2-card__title'>Replicated Accounts</h3>
                                    </div>

                                    {copierList.length === 0 ? (
                                        <div className='ct2-empty-state-card'>
                                            <div className='ct2-empty-state-card__icon'>
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                            </div>
                                            <p className='ct2-empty-state-card__title'>No accounts linked yet.</p>
                                            <p className='ct2-empty-state-card__sub'>Add a client API token or create accounts in settings.</p>
                                        </div>
                                    ) : (
                                        <ul className='ct2-replicated-list'>
                                            {copierList.map((token, i) => {
                                                const copier = managerRef.current?.copiers?.find(c => c.token === token);
                                                const isConnected = copier?.status === 'connected';
                                                return (
                                                    <li key={i} className='ct2-replicated-item'>
                                                        <div className='ct2-replicated-item__info'>
                                                            <span className={`ct2-status-dot ${isConnected ? 'ct2-status-dot--active' : 'ct2-status-dot--orange'}`} />
                                                            <span className='ct2-replicated-item__loginid'>
                                                                {copier?.loginId || truncateToken(token)}
                                                            </span>
                                                            {copier?.balance !== undefined && (
                                                                <span className='ct2-replicated-item__balance'>${Number(copier.balance).toFixed(2)}</span>
                                                            )}
                                                        </div>
                                                        <button className='ct2-btn-remove' onClick={() => handleRemoveToken(token)}>
                                                            Disconnect
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Marketplace Tab ── */}
                {activeTab === 'marketplace' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-glass-card' style={{ maxWidth: '600px', margin: '0 auto' }}>
                            <h3 className='ct2-glass-card__title'>💎 Copy Provider Marketplace</h3>
                            <p className='ct2-glass-card__desc'>
                                Follow premium master accounts to replicate their trades on your real account.
                            </p>

                            <div className='ct2-provider-card'>
                                <div className='ct2-provider-card__header'>
                                    <div className='ct2-provider-card__avatar'>👑</div>
                                    <div className='ct2-provider-card__info'>
                                        <h4 className='ct2-provider-card__name'>Profithubadmin</h4>
                                        <span className='ct2-provider-card__tag'>Verified Official Provider</span>
                                    </div>
                                </div>

                                <div className='ct2-provider-stats'>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>94.8%</span>
                                        <span className='ct2-pstat__lbl'>Historical Win Rate</span>
                                    </div>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>Low</span>
                                        <span className='ct2-pstat__lbl'>Risk Level</span>
                                    </div>
                                    <div className='ct2-pstat'>
                                        <span className='ct2-pstat__val'>24/7</span>
                                        <span className='ct2-pstat__lbl'>Uptime</span>
                                    </div>
                                </div>

                                <div className='ct2-provider-actions'>
                                    {isLoadingAdminStatus ? (
                                        <button className='ct2-btn ct2-btn--ghost' disabled>
                                            Checking status...
                                        </button>
                                    ) : adminFollowStatus === 'none' ? (
                                        <button className='ct2-btn ct2-btn--primary' onClick={handleFollowAdmin}>
                                            Request to Follow Profithubadmin
                                        </button>
                                    ) : adminFollowStatus === 'pending' ? (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--yellow'>⏳ Awaiting Admin Approval</span>
                                            <button className='ct2-btn ct2-btn--ghost' onClick={handleStopFollowAdmin}>
                                                Cancel Request
                                            </button>
                                        </div>
                                    ) : adminFollowStatus === 'accepted' ? (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--green'>🟢 Copying Active</span>
                                            <button className='ct2-btn ct2-btn--danger' onClick={handleStopFollowAdmin}>
                                                Stop Copying
                                            </button>
                                        </div>
                                    ) : (
                                        <div className='ct2-status-group'>
                                            <span className='ct2-badge ct2-badge--red'>❌ Follow Request Rejected</span>
                                            <button className='ct2-btn ct2-btn--primary' onClick={handleFollowAdmin}>
                                                Re-Request
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Clients Tab ── */}
                {activeTab === 'clients' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-clients-layout'>
                            {/* Add Token Form */}
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Add Client Token</h3>
                                <p className='ct2-glass-card__desc'>
                                    Enter the API authorization token of the account to replicate trades into.
                                </p>
                                <div className='ct2-input-row'>
                                    <input
                                        id='tokenInput'
                                        type='text'
                                        className='ct2-input'
                                        placeholder='Enter client auth token...'
                                        value={tokenInput}
                                        onChange={e => setTokenInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddToken()}
                                    />
                                    <button className='ct2-btn ct2-btn--primary' onClick={handleAddToken}>
                                        Add
                                    </button>
                                </div>
                                <div className='ct2-input-row ct2-input-row--mt'>
                                    <button
                                        className='ct2-btn ct2-btn--accent ct2-btn--full'
                                        onClick={handleAutoImportTokens}
                                    >
                                        ⚡ Auto-Import from Login Session
                                    </button>
                                    <button
                                        className='ct2-btn ct2-btn--ghost'
                                        onClick={handleSyncTokens}
                                        disabled={isSyncing}
                                    >
                                        {isSyncing ? '↻ Syncing…' : '↻ Sync'}
                                    </button>
                                </div>

                                {/* My API Token Info Card */}
                                <div className='ct2-token-info-card'>
                                    <h4 className='ct2-token-info-card__title'>🔑 Your API Token</h4>
                                    <p className='ct2-token-info-card__desc'>
                                        Share this token with others so they can configure your account as their target copier.
                                    </p>
                                    <div className='ct2-token-info-card__row'>
                                        <code className='ct2-token-info-card__code'>
                                            {getActiveToken() ? truncateToken(getActiveToken()!) : 'Not Available'}
                                        </code>
                                        {getActiveToken() && (
                                            <button
                                                className='ct2-btn ct2-btn--ghost ct2-btn--sm'
                                                onClick={() => handleCopyToClipboard(getActiveToken()!)}
                                            >
                                                Copy
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                            <input
                                                type='checkbox'
                                                checked={showAccountPublic}
                                                onChange={e => {
                                                    setShowAccountPublic(e.target.checked);
                                                    localStorage.setItem('show_account_public', String(e.target.checked));
                                                    setSuccessMessage2(e.target.checked ? '✅ Account is now visible to other users for copy trading' : '🔒 Account hidden from marketplace');
                                                    setTimeout(() => setSuccessMessage2(''), 5000);
                                                }}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                            />
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-prominent)' }}>
                                                Show my account to other users for copytrading
                                            </span>
                                        </label>
                                    </div>
                                </div>
                                {successMessage2 && (
                                    <div className='ct2-success-banner ct2-success-banner--mt'>{successMessage2}</div>
                                )}
                            </div>

                            {/* Clients List */}
                            <div className='ct2-glass-card'>
                                <div className='ct2-clients-header'>
                                    <h3 className='ct2-glass-card__title'>Client Accounts</h3>
                                    <span className='ct2-clients-count'>{copierList.length} added</span>
                                </div>
                                {copierList.length === 0 ? (
                                    <div className='ct2-empty-state'>
                                        <div className='ct2-empty-state__icon'>👤</div>
                                        <div className='ct2-empty-state__text'>No client accounts configured yet.</div>
                                        <div className='ct2-empty-state__sub'>Add tokens above or use Auto-Import.</div>
                                    </div>
                                ) : (
                                    <ul className='ct2-client-list'>
                                        {copierList.map((token, i) => {
                                            const copier = managerRef.current?.copiers?.find(c => c.token === token);
                                            const isConnected = copier?.status === 'connected';
                                            const isConnecting = copier?.status === 'connecting';
                                            const isError = copier?.status === 'error';

                                            let dotClass = '';
                                            if (isConnected) dotClass = 'ct2-client-dot--green';
                                            else if (isConnecting) dotClass = 'ct2-client-dot--orange';
                                            else if (isError) dotClass = 'ct2-client-dot--red';

                                            let statusClass = '';
                                            if (isConnected) statusClass = 'ct2-client-status--connected';
                                            else if (isConnecting) statusClass = 'ct2-client-status--connecting';
                                            else if (isError) statusClass = 'ct2-client-status--error';

                                            let statusLabel = 'Idle';
                                            if (isConnected) statusLabel = 'Connected';
                                            else if (isConnecting) statusLabel = 'Connecting';
                                            else if (isError) statusLabel = copier?.lastErrorCode ? `Error: ${copier.lastErrorCode}` : 'Error';

                                            return (
                                                <li key={i} className='ct2-client-item'>
                                                    <div className='ct2-client-item__left'>
                                                        <div className={`ct2-client-dot ${dotClass}`} />
                                                        <span className='ct2-client-idx'>#{i + 1}</span>
                                                        <span className='ct2-client-token'>
                                                            {truncateToken(token)}
                                                            {copier?.loginId && ` (${copier.loginId})`}
                                                            {copier?.balance !== undefined && ` - $${Number(copier.balance).toFixed(2)}`}
                                                        </span>
                                                    </div>
                                                    <div className='ct2-client-item__right'>
                                                        <span className={`ct2-client-status ${statusClass}`}>
                                                            {statusLabel}
                                                        </span>
                                                        {isError && (
                                                            <button
                                                                className='ct2-client-del'
                                                                style={{ fontSize: '1.4rem', opacity: 0.6 }}
                                                                onClick={async () => {
                                                                    if (copier) {
                                                                        try {
                                                                            await managerRef.current?.connectCopier(copier.id);
                                                                        } catch (e: any) {
                                                                            setErrorMessage(e?.message || 'Connection failed');
                                                                            setErrorModalVisible(true);
                                                                        }
                                                                    }
                                                                }}
                                                                title={copier?.lastErrorMsg || 'Retry Connection'}
                                                            >
                                                                ↻
                                                            </button>
                                                        )}
                                                        <button
                                                            className='ct2-client-del'
                                                            onClick={() => handleRemoveToken(token)}
                                                            title='Remove'
                                                        >
                                                            🗑
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Logs Tab ── */}
                {activeTab === 'logs' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-terminal'>
                            <div className='ct2-terminal__header'>
                                <span className='ct2-terminal__title'>📡 Live Replication Activity</span>
                                <span
                                    className={`ct2-terminal__badge ${
                                        copyTradingActive ? 'ct2-terminal__badge--live' : ''
                                    }`}
                                >
                                    {copyTradingActive ? '● LIVE' : '○ IDLE'}
                                </span>
                            </div>
                            <div className='ct2-terminal__body'>
                                {tradeLogs.length === 0 ? (
                                    <div className='ct2-terminal__placeholder'>
                                        <div className='ct2-terminal__placeholder-icon'>📡</div>
                                        <div>Awaiting replication events…</div>
                                        <div className='ct2-terminal__placeholder-sub'>
                                            Start copy trading to see activity logs here.
                                        </div>
                                    </div>
                                ) : (
                                    <div className='ct2-terminal__log-scroll'>
                                        {tradeLogs
                                            .slice()
                                            .reverse()
                                            .map((log, i) => (
                                                <div
                                                    key={i}
                                                    className={`ct2-log-line ${
                                                        log.error ? 'ct2-log-line--error' : 'ct2-log-line--success'
                                                    }`}
                                                >
                                                    <span className='ct2-log-time'>
                                                        [{new Date(log.time).toLocaleTimeString()}]
                                                    </span>
                                                    <span className='ct2-log-acct'>({log.accountId}):</span>
                                                    <span className='ct2-log-msg'>
                                                        {log.error
                                                            ? `❌ ${log.error}`
                                                            : `✅ Bought ${log.payload?.contract_type || 'contract'}`}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Settings Tab ── */}
                {activeTab === 'settings' && (
                    <div className='ct2-tab-panel'>
                        <div className='ct2-settings-grid'>
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Replication Mode</h3>
                                <div className='ct2-setting-item'>
                                    <div>
                                        <div className='ct2-setting-item__name'>Demo → Real Sync</div>
                                        <div className='ct2-setting-item__desc'>
                                            Copy trades from your demo account to your real ROT account
                                        </div>
                                    </div>
                                    <button
                                        className={`ct2-toggle ${demoToRealActive ? 'ct2-toggle--on' : ''}`}
                                        onClick={handleDemoToReal}
                                    >
                                        <span className='ct2-toggle__knob' />
                                    </button>
                                </div>
                                <div className='ct2-setting-item'>
                                    <div>
                                        <div className='ct2-setting-item__name'>Copy Trading Engine</div>
                                        <div className='ct2-setting-item__desc'>
                                            Broadcast all executed trades to all connected client accounts
                                        </div>
                                    </div>
                                    <button
                                        className={`ct2-toggle ${copyTradingActive ? 'ct2-toggle--on' : ''}`}
                                        onClick={handleStartCopyTrading}
                                    >
                                        <span className='ct2-toggle__knob' />
                                    </button>
                                </div>
                            </div>
                            <div className='ct2-glass-card'>
                                <h3 className='ct2-glass-card__title'>Token Management</h3>
                                <div className='ct2-setting-btns'>
                                    <button
                                        className='ct2-btn ct2-btn--accent ct2-btn--full'
                                        onClick={handleAutoImportTokens}
                                    >
                                        ⚡ Auto-Import Session Tokens
                                    </button>
                                    <button
                                        className='ct2-btn ct2-btn--ghost ct2-btn--full'
                                        onClick={handleSyncTokens}
                                    >
                                        ↻ Sync from Manager
                                    </button>
                                </div>
                                <p className='ct2-hint'>
                                    Auto-Import reads all account tokens from your current login session and adds them
                                    as copy targets automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Error / Real Account Token Dialog */}
                <Dialog
                    is_visible={errorModalVisible}
                    onConfirm={() => setErrorModalVisible(false)}
                    onCancel={() => setErrorModalVisible(false)}
                    confirm_button_text="Close"
                    title="Account Session Notice"
                >
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ margin: 0, color: '#f8fafc', fontSize: '0.9rem' }}>{errorMessage}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Add Real Account API Token (CR / ROT):</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="password"
                                    placeholder="Paste CR / ROT Deriv Token"
                                    className="ct2-input"
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                />
                                <button
                                    className="ct2-btn ct2-btn--accent"
                                    onClick={() => {
                                        if (tokenInput.trim()) {
                                            localStorage.setItem('active_token', tokenInput.trim());
                                            localStorage.setItem('ace_deriv_token', tokenInput.trim());
                                            setErrorModalVisible(false);
                                            setSuccessMessage('✅ Real Account token saved!');
                                            setTimeout(() => setSuccessMessage(''), 5000);
                                        }
                                    }}
                                >
                                    Save Token
                                </button>
                            </div>
                        </div>
                    </div>
                </Dialog>
            </div>
        </div>
    );
});

export default CopyTrading;
