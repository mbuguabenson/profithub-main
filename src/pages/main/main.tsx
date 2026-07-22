import React, { lazy, Suspense, useEffect, useState, useMemo } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSiteConfig } from '@/utils/supabase-copy';
import ChunkLoader from '@/components/loader/chunk-loader';
import { generateOAuthURL } from '@/components/shared';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import Dialog from '@/components/shared_ui/dialog';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import Tabs from '@/components/shared_ui/tabs/tabs';
import TradingViewModal from '@/components/trading-view-chart/trading-view-modal';
import ProfihubModal from '@/components/profihub-analysis/profihub-modal';
import ProToolAiModal from '@/components/protool-ai/protool-ai-modal';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { api_base, updateWorkspaceName } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { isDbotRTL } from '@/external/bot-skeleton/utils/workspace';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { disableUrlParameterApplication, enableUrlParameterApplication, setupTradeTypeChangeListener } from '@/utils/blockly-url-param-handler';
import { checkAndShowTradeTypeModal, getModalState, handleTradeTypeCancel, handleTradeTypeConfirm, resetUrlParamProcessing, setModalStateChangeCallback } from '@/utils/trade-type-modal-handler';
import TradeTypeConfirmationModal from '@/components/trade-type-confirmation-modal';
import {
    LabelPairedChartLineCaptionRegularIcon,
    LabelPairedObjectsColumnCaptionRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { LegacyChartsIcon, LegacyGuide1pxIcon, LegacyIndicatorsIcon } from '@deriv/quill-icons/Legacy';
import { Localize, localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import RunPanel from '../../components/run-panel';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import RunStrategy from '../dashboard/run-strategy';
import Scanner from '../bot-builder/scanner/scanner';
import './main.scss';

const ChartWrapper = lazy(() => import('../chart/chart-wrapper'));

const TradingView = lazy(() => import('../tradingview'));
const AnalysisTools = lazy(() => import('../analysis-tool'));
const CopyTrading = lazy(() => import('../copy-trading'));
const Signals = lazy(() => import('../signals'));
const AutoTrades = lazy(() => import('../auto-trades/auto-trades'));
const ScannerPage = lazy(() => import('../scanner/scanner'));
import TradingBots from '../free-bots/trading-bots';

const SmartTrading = lazy(() => import('../smart-trading'));
const ManualTrading = lazy(() => import('../manual-trading'));
const EasyTool = lazy(() => import('../easy-tool'));
const Marketkiller = lazy(() => import('../marketkiller'));
const MultiTrader = lazy(() => import('../multi-trader'));
const SignalCentrePage = lazy(() => import('../smart-trading/components/signal-centre-tab'));
const MarketHunterPro = lazy(() => import('../market-hunter-pro'));
const AICompoundingEngine = lazy(() => import('../ai-compounding-engine/ai-compounding-engine'));



const AppWrapper = observer(() => {
    const { connectionStatus } = useApiBase();
    const store = useStore();

    // Guard: store is null during async initialization — prevents MobX crash on active_tab
    if (!store) return null;

    const { dashboard, load_modal, run_panel, quick_strategy, summary_card, blockly_store } = store;
    const { is_loading } = blockly_store;
    const {
        active_tab,
        active_tour,
        is_chart_modal_visible,
        is_trading_view_modal_visible,
        setActiveTab,
        setWebSocketState,
        setActiveTour,
        setTourDialogVisibility,
    } = dashboard;
    const { dashboard_strategies } = load_modal;
    const {
        is_dialog_open,
        is_drawer_open,
        dialog_options,
        onCancelButtonClick,
        onCloseDialog,
        onOkButtonClick,
        stopBot,
    } = run_panel;
    const { is_open } = quick_strategy;
    const { cancel_button_text, ok_button_text, title, message, dismissable, is_closed_on_cancel } = dialog_options as {
        [key: string]: string;
    };
    const { clear } = summary_card;
    const { DASHBOARD, BOT_BUILDER } = DBOT_TABS;
    const init_render = React.useRef(true);
    const pollTimeoutId = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const hash = [
        'dashboard',
        'bot_builder',
        'chart',
        'trading_bots',
        'analysis_tool',
        'copy_trading',
        'tradingview',
        'signals',
        'auto_trades',
        'scanner',
        'smart_auto',
        'manual_trading',
        'easy_tool',
        'signal_centre',
        'marketkiller',
        'multi_trader',
        'ai_compounding_engine',
    ];
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();

    const [siteConfig, setSiteConfig] = useState(() => getSiteConfig());

    useEffect(() => {
        const handler = () => {
            setSiteConfig(getSiteConfig());
        };
        window.addEventListener('profithub_config_changed', handler);
        return () => window.removeEventListener('profithub_config_changed', handler);
    }, []);

    const [tradeTypeModalState, setTradeTypeModalState] = useState(getModalState());

    const getTradeTypeModalProps = () => {
        const { tradeTypeData } = tradeTypeModalState;

        return {
            is_visible: tradeTypeModalState.isVisible,
            trade_type_display_name: tradeTypeData?.displayName || '',
            current_trade_type: tradeTypeData?.currentTradeType
                ? `${tradeTypeData.currentTradeType.tradeTypeCategory}/${tradeTypeData.currentTradeType.tradeType}`
                : 'N/A',
            current_trade_type_display_name: tradeTypeData?.currentTradeTypeDisplayName || 'N/A',
            onConfirm: handleTradeTypeConfirm,
            onCancel: handleTradeTypeCancel,
        };
    };

    let tab_value: number | string = active_tab;
    const GetHashedValue = (tab: number) => {
        tab_value = location.hash?.split('#')[1];
        if (!tab_value) return tab;
        return Number(hash.indexOf(String(tab_value)));
    };
    const active_hash_tab = GetHashedValue(active_tab);

    React.useEffect(() => {
        setModalStateChangeCallback(new_state => {
            setTradeTypeModalState(new_state);
        });
    }, [is_loading]);

    React.useEffect(() => {
        resetUrlParamProcessing();
    }, [location.search]);

    React.useEffect(() => {
        if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            const is_bot_running = document.getElementById('db-animation__stop-button') !== null;
            if (is_bot_running) {
                clear();
                stopBot();
                api_base.setIsRunning(false);
                setWebSocketState(false);
            }
        }
    }, [clear, connectionStatus, setWebSocketState, stopBot]);

    React.useEffect(() => {
        if (active_tab === BOT_BUILDER) {
            requestAnimationFrame(() => {
                disableUrlParameterApplication();
                setupTradeTypeChangeListener();

                const handleTradeTypeModal = () => {
                    checkAndShowTradeTypeModal(
                        () => {
                            enableUrlParameterApplication();
                        },
                        () => {}
                    );
                };

                if (!blockly_store.is_loading) {
                    setTimeout(() => {
                        handleTradeTypeModal();
                    }, 500);
                } else {
                    let pollAttempts = 0;
                    const maxPollAttempts = 10;

                    const checkBlocklyLoaded = () => {
                        if (!blockly_store.is_loading) {
                            handleTradeTypeModal();
                            return;
                        }

                        if (pollAttempts < maxPollAttempts) {
                            pollAttempts++;
                            pollTimeoutId.current = setTimeout(checkBlocklyLoaded, 500);
                        }
                    };

                    checkBlocklyLoaded();
                }
            });
        }

        return () => {
            if (pollTimeoutId.current) {
                clearTimeout(pollTimeoutId.current);
                pollTimeoutId.current = null;
            }
        };
    }, [active_tab, is_loading, blockly_store.is_loading]);

    React.useEffect(() => {
        if (is_open) {
            setTourDialogVisibility(false);
        }
        if (init_render.current) {
            setActiveTab(Number(active_hash_tab));
            if (!isDesktop) handleTabChange(Number(active_hash_tab));
            init_render.current = false;
        } else {
            const currentSearch = window.location.search;
            navigate(`${currentSearch}#${hash[active_tab] || hash[0]}`);
        }
        if (active_tour !== '') {
            setActiveTour('');
        }

        const mainElement = document.querySelector('.main__container');
        if ((active_tab === DBOT_TABS.TUTORIAL || run_panel.is_drawer_open) && !isDesktop) {
            document.body.style.overflow = 'hidden';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.add('no-scroll');
            }
        } else {
            document.body.style.overflow = '';
            if (mainElement instanceof HTMLElement) {
                mainElement.classList.remove('no-scroll');
            }
        }
    }, [active_tab, run_panel.is_drawer_open]);

    React.useEffect(() => {
        const trashcan_init_id = setTimeout(() => {
            if (active_tab === BOT_BUILDER && (Blockly as any)?.derivWorkspace?.trashcan) {
                const trashcanY = window.innerHeight - 250;
                let trashcanX;
                if (is_drawer_open) {
                    trashcanX = isDbotRTL() ? 380 : window.innerWidth - 460;
                } else {
                    trashcanX = isDbotRTL() ? 20 : window.innerWidth - 100;
                }
                (Blockly as any)?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY);
            }
        }, 100);

        return () => {
            clearTimeout(trashcan_init_id);
        };
    }, [active_tab, is_drawer_open]);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (dashboard_strategies.length > 0) {
            timer = setTimeout(() => {
                updateWorkspaceName();
            });
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    }, [dashboard_strategies, active_tab]);

    const handleTabChange = React.useCallback(
        (tab_index: number) => {
            setActiveTab(tab_index);
            const el_id = TAB_IDS[tab_index];
            if (el_id) {
                const el_tab = document.getElementById(el_id);
                setTimeout(() => {
                    el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }, 10);
            }
        },
        [active_tab]
    );

    const handleLoginGeneration = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) {
            window.location.replace(oauthUrl);
        } else {
            console.error('Failed to generate OAuth URL');
        }
    };

    const allTabDescriptors = useMemo(() => [
        {
            key: 'dashboard',
            id: 'id-dbot-dashboard',
            label: (
                <>
                    <LabelPairedObjectsColumnCaptionRegularIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Dashboard' />
                </>
            ),
            content: <Dashboard handleTabChange={handleTabChange} />
        },
        {
            key: 'bot_builder',
            id: 'id-bot-builder',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Bot Builder' />
                </>
            ),
            content: null
        },
        {
            key: 'chart',
            id: is_chart_modal_visible || is_trading_view_modal_visible ? 'id-charts--disabled' : 'id-charts',
            label: (
                <>
                    <LabelPairedChartLineCaptionRegularIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Charts' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading chart...')} />}>
                    <ChartWrapper show_digits_stats={true} />
                </Suspense>
            )
        },
        {
            key: 'trading_bots',
            id: 'id-trading-bots',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Trading Bots' />
                </>
            ),
            content: <TradingBots />
        },
        {
            key: 'analysis_tool',
            id: 'id-analysis-tool',
            label: (
                <>
                    <LegacyIndicatorsIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Analysis Tool' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Analysis Tool...')} />}>
                    <AnalysisTools />
                </Suspense>
            )
        },
        {
            key: 'copy_trading',
            id: 'id-copy-trading',
            label: (
                <>
                    <LabelPairedObjectsColumnCaptionRegularIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Copy Trading' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Copy Trading...')} />}>
                    <CopyTrading />
                </Suspense>
            )
        },
        {
            key: 'tradingview',
            id: 'id-tradingview',
            label: (
                <>
                    <LegacyChartsIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='TradingView' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading TradingView...')} />}>
                    <TradingView />
                </Suspense>
            )
        },
        {
            key: 'signals',
            id: 'id-signals',
            label: (
                <>
                    <LegacyGuide1pxIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Signals' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Signals...')} />}>
                    <Signals />
                </Suspense>
            )
        },
        {
            key: 'auto_trades',
            id: 'id-auto-trades',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Auto Trades' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Auto Trades...')} />}>
                    <AutoTrades />
                </Suspense>
            )
        },
        {
            key: 'scanner',
            id: 'id-scanner',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='AI Strategy Scanner' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Scanner...')} />}>
                    <ScannerPage />
                </Suspense>
            )
        },
        {
            key: 'smart_auto',
            id: 'id-smart-auto',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='SmartAuto' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading SmartAuto...')} />}>
                    <SmartTrading />
                </Suspense>
            )
        },
        {
            key: 'manual_trading',
            id: 'id-manual-trading',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Manual Trading' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Manual Trading...')} />}>
                    <ManualTrading />
                </Suspense>
            )
        },
        {
            key: 'easy_tool',
            id: 'id-easy-tool',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Easy Tool' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Easy Tool...')} />}>
                    <EasyTool />
                </Suspense>
            )
        },
        {
            key: 'signal_centre',
            id: 'id-signal-centre',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Signal Centre' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Signal Centre...')} />}>
                    <SignalCentrePage />
                </Suspense>
            )
        },
        {
            key: 'marketkiller',
            id: 'id-marketkiller',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Marketkiller' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Marketkiller...')} />}>
                    <Marketkiller />
                </Suspense>
            )
        },
        {
            key: 'multi_trader',
            id: 'id-multi-trader',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#f5c542' />
                    <Localize i18n_default_text='Multi Trader' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading Multi Trader...')} />}>
                    <MultiTrader />
                </Suspense>
            )
        },
        {
            key: 'ai_compounding_engine',
            id: 'id-ai-compounding-engine',
            label: (
                <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height='28px' width='28px' fill='#10b981' />
                    <Localize i18n_default_text='AI Compounding Engine ⭐' />
                </>
            ),
            content: (
                <Suspense fallback={<ChunkLoader message={localize('Please wait, loading AI Compounding Engine...')} />}>
                    <AICompoundingEngine />
                </Suspense>
            )
        }
    ], [is_chart_modal_visible, is_trading_view_modal_visible, handleTabChange]);

    const activeTabsList = useMemo(() => {
        const list = [...allTabDescriptors];
        const configs = siteConfig.tabConfig || [];
        const orderMap = new Map<string, number>();
        const enabledMap = new Map<string, boolean>();

        configs.forEach(c => {
            orderMap.set(c.key, c.order);
            enabledMap.set(c.key, c.enabled);
        });

        return list
            .filter(tab => enabledMap.get(tab.key) !== false)
            .sort((a, b) => {
                const orderA = orderMap.has(a.key) ? orderMap.get(a.key)! : 99;
                const orderB = orderMap.has(b.key) ? orderMap.get(b.key)! : 99;
                return orderA - orderB;
            });
    }, [siteConfig, allTabDescriptors]);

    const currentTabKey = hash[active_hash_tab] ?? hash[0];
    const filteredActiveIndex = Math.max(0, activeTabsList.findIndex(t => t.key === currentTabKey));

    const handleFilteredTabChange = React.useCallback(
        (filteredIndex: number) => {
            const targetTab = activeTabsList[filteredIndex];
            if (targetTab) {
                const globalIndex = hash.indexOf(targetTab.key);
                if (globalIndex > -1) {
                    setActiveTab(globalIndex);
                    window.location.hash = targetTab.key;
                    const el_id = targetTab.id;
                    if (el_id) {
                        const el_tab = document.getElementById(el_id);
                        setTimeout(() => {
                            el_tab?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                        }, 10);
                    }
                }
            }
        },
        [activeTabsList, setActiveTab]
    );

    return (
        <React.Fragment>
            <div className='main'>
                <div
                    className={classNames('main__container', {
                        'main__container--active': active_tour && active_tab === DASHBOARD && !isDesktop,
                    })}
                >
                    <div style={{ height: '100%', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <Tabs active_index={filteredActiveIndex} className='main__tabs' onTabItemClick={handleFilteredTabChange} history={window.history as any} top>
                            {activeTabsList.map(tab => (
                                <div key={tab.key} label={tab.label} id={tab.id} style={{ height: '100%', overflowY: 'auto' }}>
                                    {tab.content}
                                </div>
                            ))}
                        </Tabs>
                    </div>
                </div>
            </div>
            <DesktopWrapper>
                <div className='main__run-strategy-wrapper'>
                    {active_tab !== DBOT_TABS.TRADING_BOTS && active_tab !== DBOT_TABS.MANUAL_TRADING && <RunStrategy />}
                    {active_tab !== DBOT_TABS.MANUAL_TRADING && <RunPanel />}
                </div>
                <ChartModal />
                <TradingViewModal />
                <ProfihubModal />
                <ProToolAiModal />
            </DesktopWrapper>
            <MobileWrapper>
                {!is_open && active_tab !== DBOT_TABS.MANUAL_TRADING && <RunPanel />}
            </MobileWrapper>

            <Dialog
                cancel_button_text={cancel_button_text || localize('Cancel')}
                className='dc-dialog__wrapper--fixed'
                confirm_button_text={ok_button_text || localize('Ok')}
                has_close_icon
                is_mobile_full_width={false}
                is_visible={is_dialog_open}
                onCancel={onCancelButtonClick || undefined}
                onClose={onCloseDialog}
                onConfirm={onOkButtonClick || onCloseDialog}
                portal_element_id='modal_root'
                title={title}
                login={handleLoginGeneration}
                dismissable={dismissable as unknown as boolean}
                is_closed_on_cancel={is_closed_on_cancel as unknown as boolean}
            >
                {message}
            </Dialog>
            <TradeTypeConfirmationModal
                is_visible={getTradeTypeModalProps().is_visible}
                trade_type_display_name={getTradeTypeModalProps().trade_type_display_name}
                current_trade_type={getTradeTypeModalProps().current_trade_type}
                current_trade_type_display_name={getTradeTypeModalProps().current_trade_type_display_name}
                onConfirm={getTradeTypeModalProps().onConfirm}
                onCancel={getTradeTypeModalProps().onCancel}
            />
            <Scanner />
            <Suspense fallback={null}>
                <MarketHunterPro />
            </Suspense>
        </React.Fragment>
    );
});

export default AppWrapper;
