import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { motion } from 'framer-motion';
import Cookies from 'js-cookie';
import classNames from 'classnames';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import './UltimateWelcomePage.scss';

// Typing effect words
const TYPING_WORDS = [
    'AI Powered',
    'Digit Trading',
    'Automation',
    'Risk Management',
    'Market Analysis'
];

export const UltimateWelcomePage = observer(({ handleTabChange: _handleTabChange }: { handleTabChange: (active_number: number) => void }) => {
    const store = useStore();
    if (!store) return null;
    const { dashboard, load_modal, quick_strategy, client, scanner } = store;
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { setActiveTab } = dashboard;
    const { setFormVisibility } = quick_strategy;
    const { isDesktop } = useDevice();

    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');
    const [typedText, setTypedText] = useState('');
    const [wordIndex, setWordIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeMarketsCount, setActiveMarketsCount] = useState(0);
    const [botTemplatesCount, setBotTemplatesCount] = useState(0);
    const [activityIndex, setActivityIndex] = useState(0);

    const activityLogs = [
        localize('Connected to Deriv'),
        localize('Market data synchronized'),
        localize('Ready to build bot'),
        localize('AI Engine Online')
    ];

    // Determine Greeting & Username
    useEffect(() => {
        const hours = new Date().getHours();
        if (hours < 12) setGreeting(localize('Morning'));
        else if (hours < 18) setGreeting(localize('Afternoon'));
        else setGreeting(localize('Evening'));

        try {
            const infoCookie = Cookies.get('client_information');
            if (infoCookie) {
                const info = JSON.parse(infoCookie);
                if (info.first_name) {
                    setUserName(info.first_name);
                    return;
                }
            }
            const email = localStorage.getItem('client_email') || '';
            if (email) {
                setUserName(email.split('@')[0]);
                return;
            }
        } catch (e) {
            console.error('Failed to parse name info:', e);
        }
        setUserName('Trader');
    }, []);

    // Typing Effect Logic
    useEffect(() => {
        let typingTimeout: NodeJS.Timeout;
        const currentWord = TYPING_WORDS[wordIndex];
        const typingSpeed = isDeleting ? 40 : 80;

        if (!isDeleting && typedText === currentWord) {
            typingTimeout = setTimeout(() => setIsDeleting(true), 1500);
        } else if (isDeleting && typedText === '') {
            setIsDeleting(false);
            setWordIndex((prev) => (prev + 1) % TYPING_WORDS.length);
        } else {
            typingTimeout = setTimeout(() => {
                setTypedText(
                    isDeleting
                        ? currentWord.substring(0, typedText.length - 1)
                        : currentWord.substring(0, typedText.length + 1)
                );
            }, typingSpeed);
        }

        return () => clearTimeout(typingTimeout);
    }, [typedText, isDeleting, wordIndex]);

    // Statistics Counter Animation
    useEffect(() => {
        let startTime: number | null = null;
        const duration = 2000; // 2 seconds

        const animateCounters = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Ease out quad formula
            const easeProgress = progress * (2 - progress);

            setActiveMarketsCount(Math.floor(easeProgress * 120));
            setBotTemplatesCount(Math.floor(easeProgress * 350));

            if (progress < 1) {
                requestAnimationFrame(animateCounters);
            }
        };

        requestAnimationFrame(animateCounters);
    }, []);

    // Activity Log Fading sequence
    useEffect(() => {
        if (activityIndex < activityLogs.length - 1) {
            const timer = setTimeout(() => {
                setActivityIndex(prev => prev + 1);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [activityIndex]);

    // Card Callbacks
    const openFileLoader = () => {
        toggleLoadModal();
        setActiveTabIndex(isDesktop ? 1 : 0);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openGoogleDriveDialog = () => {
        toggleLoadModal();
        setActiveTabIndex(isDesktop ? 2 : 1);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openBotBuilder = () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const openQuickStrategy = () => {
        setActiveTab(DBOT_TABS.BOT_BUILDER);
        setFormVisibility(true);
    };

    return (
        <div className='ultimate-landing'>
            {/* Ambient Background Graphics */}
            <div className='ultimate-landing__bg-glow ultimate-landing__bg-glow--primary' />
            <div className='ultimate-landing__bg-glow ultimate-landing__bg-glow--secondary' />

            <div className='ultimate-landing__grid-overlay'>
                {/* SVG Animated Grid */}
                <svg width='100%' height='100%' xmlns='http://www.w3.org/2000/svg' className='ultimate-landing__grid-svg'>
                    <defs>
                        <pattern id='grid-pattern' width='60' height='60' patternUnits='userSpaceOnUse'>
                            <path d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(255, 255, 255, 0.02)' strokeWidth='1' />
                        </pattern>
                    </defs>
                    <rect width='100%' height='100%' fill='url(#grid-pattern)' />
                </svg>
            </div>

            {/* Floating Candlestick animations for depth */}
            <div className='ultimate-landing__candles'>
                <div className='candle candle--green candle-1' />
                <div className='candle candle--red candle-2' />
                <div className='candle candle--green candle-3' />
                <div className='candle candle--red candle-4' />
            </div>



            {/* Redesigned Premium Two-Column Layout Grid */}
            <div className='ultimate-landing__layout-grid'>
                {/* Left Column: Welcome & Action Cards */}
                <div className='ultimate-landing__left-col'>
                    <div className='ultimate-landing__hero' style={{ textAlign: 'left', marginTop: '0px' }}>
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className='ultimate-landing__welcome'
                            style={{ marginBottom: '16px' }}
                        >
                            <h2 className='welcome-greeting' style={{ fontSize: '1.4rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                                {localize('Good')} {greeting} {userName} 👋
                            </h2>
                            <h3 className='welcome-subtitle' style={{ fontSize: '2.4rem', fontWeight: 800, margin: '6px 0' }}>
                                {localize('Welcome back to Ultimate Traders.')}
                            </h3>
                        </motion.div>

                        {/* Animated Typing Title */}
                        <motion.h1 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className='ultimate-landing__title'
                            style={{ fontSize: '2.1rem', fontWeight: 800, marginBottom: '12px' }}
                        >
                            {localize('Build Intelligent')}
                            <span className='typing-text' style={{ color: 'var(--brand-red-1, #ff444f)' }}> {typedText}</span>
                            <span className='typing-cursor'>|</span>
                        </motion.h1>

                        <p className='ultimate-landing__subtitle' style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.5)', maxWidth: '640px', margin: '0 0 20px' }}>
                            {localize('Import an existing bot, create one from scratch, or launch an intelligent strategy powered by AI.')}
                        </p>
                    </div>

                    {/* Bot Action Cards Grid */}
                    <div className='ultimate-landing__cards-container' style={{ margin: '0 auto 20px', width: '100%' }}>
                        <div className='ultimate-landing__cards-grid'>
                            {/* Card 1: Local Computer Import */}
                            <motion.div
                                whileHover={{ y: -6, scale: 1.01 }}
                                className='ultimate-landing__card card--blue'
                                onClick={openFileLoader}
                                style={{ padding: '24px 20px', borderRadius: '16px' }}
                            >
                                <div className='card__icon' style={{ fontSize: '26px', marginBottom: '12px' }}>📂</div>
                                <h3 className='card__title' style={{ fontSize: '16px' }}>{localize('My Computer')}</h3>
                                <p className='card__description' style={{ fontSize: '12px', margin: '0 0 16px' }}>
                                    {localize('Import saved trading bots from your local computer.')}
                                </p>
                                <div className='card__arrow'>→</div>
                                <div className='card__glow' />
                            </motion.div>

                            {/* Card 2: Google Drive Import */}
                            <motion.div
                                whileHover={{ y: -6, scale: 1.01 }}
                                className='ultimate-landing__card card--green'
                                onClick={openGoogleDriveDialog}
                                style={{ padding: '24px 20px', borderRadius: '16px' }}
                            >
                                <div className='card__icon' style={{ fontSize: '26px', marginBottom: '12px' }}>☁️</div>
                                <h3 className='card__title' style={{ fontSize: '16px' }}>{localize('Google Drive')}</h3>
                                <p className='card__description' style={{ fontSize: '12px', margin: '0 0 16px' }}>
                                    {localize('Open bots stored securely inside Google Drive.')}
                                </p>
                                <div className='card__arrow'>→</div>
                                <div className='card__glow' />
                            </motion.div>

                            {/* Card 3: Bot Builder */}
                            <motion.div
                                whileHover={{ y: -6, scale: 1.01 }}
                                className='ultimate-landing__card card--emerald'
                                onClick={openBotBuilder}
                                style={{ padding: '24px 20px', borderRadius: '16px' }}
                            >
                                <div className='card__circuit-glow' />
                                <div className='card__icon' style={{ fontSize: '26px', marginBottom: '12px' }}>🤖</div>
                                <h3 className='card__title' style={{ fontSize: '16px' }}>{localize('Bot Builder')}</h3>
                                <p className='card__description' style={{ fontSize: '12px', margin: '0 0 16px' }}>
                                    {localize('Create powerful automated trading bots visually.')}
                                </p>
                                <div className='card__arrow'>→</div>
                                <div className='card__glow' />
                            </motion.div>

                            {/* Card 4: Quick Strategy */}
                            <motion.div
                                whileHover={{ y: -6, scale: 1.01 }}
                                className='ultimate-landing__card card--purple'
                                onClick={openQuickStrategy}
                                style={{ padding: '24px 20px', borderRadius: '16px' }}
                            >
                                <div className='card__icon' style={{ fontSize: '26px', marginBottom: '12px' }}>⚡</div>
                                <h3 className='card__title' style={{ fontSize: '16px' }}>{localize('Quick Strategy')}</h3>
                                <p className='card__description' style={{ fontSize: '12px', margin: '0 0 16px' }}>
                                    {localize('Launch ready-made trading strategies instantly.')}
                                </p>
                                <div className='card__arrow'>→</div>
                                <div className='card__glow' />
                            </motion.div>
                        </div>
                    </div>

                    {/* Premium CTA Buttons */}
                    <div className='ultimate-landing__cta' style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            onClick={openBotBuilder}
                            className='cta-btn cta-btn--primary'
                            style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px' }}
                        >
                            {localize('Start Trading')} <span className='arrow'>→</span>
                        </motion.button>
                        <button 
                            onClick={openQuickStrategy} 
                            className='cta-btn cta-btn--secondary'
                            style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '13px' }}
                        >
                            {localize('Explore Features')}
                        </button>
                    </div>
                </div>

                {/* Right Column: Live AI Feed & Account Command Center */}
                <div className='ultimate-landing__right-col'>
                    {/* Live Account Status Widget */}
                    <div className='ultimate-landing__right-widget widget--account'>
                        <h4 className='widget-title'>👤 {localize('Account Command Center')}</h4>
                        <div className='account-center-info'>
                          <div className='info-item'>
                            <span className='info-label'>{localize('Account Balance')}</span>
                            <span className='info-value'>
                              {client.is_logged_in 
                                ? `${client.balance} ${client.currency || 'USD'}`
                                : '0.00 USD'}
                            </span>
                          </div>
                          <div className='info-item'>
                            <span className='info-label'>{localize('Account Type')}</span>
                            <span className='info-value info-value--type'>
                              {client.is_logged_in 
                                ? (client.is_virtual ? 'Demo (Virtual)' : 'Real Account')
                                : 'Not Logged In'}
                            </span>
                          </div>
                        </div>
                    </div>

                    {/* Live AI Market Scanner Widget */}
                    <div className='ultimate-landing__right-widget widget--scanner'>
                        <div className='widget-header'>
                          <h4 className='widget-title'>⚡ {localize('Live AI Scanner Feed')}</h4>
                          <span className={classNames('scanner-status-dot', { active: scanner.is_scanning })} />
                        </div>

                        <div className='scanner-feed-actions' style={{ marginBottom: '12px' }}>
                          {!scanner.is_scanning ? (
                            <button 
                              onClick={() => scanner.startScanning()}
                              className='scanner-control-btn scanner-control-btn--start'
                            >
                              🚀 Start AI Market Scanner
                            </button>
                          ) : (
                            <button 
                              onClick={() => scanner.stopScanning()}
                              className='scanner-control-btn scanner-control-btn--stop'
                            >
                              🛑 Stop Scanner (Scanning Live)
                            </button>
                          )}
                        </div>

                        <div className='welcome-signals-list'>
                          {scanner.signals.length === 0 ? (
                            <p className='scanner-empty-text'>
                              {scanner.is_scanning 
                                ? localize('Scanning markets for setups...') 
                                : localize('Start the scanner to stream setups in real-time.')}
                            </p>
                          ) : (
                            scanner.signals.slice(0, 3).map((sig, idx) => (
                              <div key={idx} className='welcome-signal-card' onClick={() => {
                                scanner.current_signal = sig;
                                scanner.is_manual_selection = true;
                                scanner.loadBotWithStrategy();
                              }}>
                                <div className='welcome-signal-card__header'>
                                  <span className='welcome-signal-card__symbol'>{sig.symbol}</span>
                                  <span className='welcome-signal-card__strategy'>{sig.strategy.replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <p className='welcome-signal-card__rec'>{sig.details.recommendation}</p>
                                <div className='welcome-signal-card__footer'>
                                  <span className='welcome-signal-card__pct'>{(sig.confidence * 100).toFixed(0)}% CONF</span>
                                  <span className='welcome-signal-card__action'>Load Setup →</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Trading Statistics Strip */}
            <div className='ultimate-landing__stats-container'>
                <div className='ultimate-landing__stats-strip'>
                    <div className='stat-card'>
                        <div className='stat-card__number'>{activeMarketsCount}+</div>
                        <div className='stat-card__label'>{localize('Active Markets')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number'>{botTemplatesCount}+</div>
                        <div className='stat-card__label'>{localize('Bot Templates')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number'>{localize('Live')}</div>
                        <div className='stat-card__label'>{localize('AI Signals')}</div>
                    </div>
                    <div className='stat-divider' />
                    <div className='stat-card'>
                        <div className='stat-card__number connected-status'>
                            {localize('Connected')} <span className='dot' />
                        </div>
                        <div className='stat-card__label'>{localize('System Status')}</div>
                    </div>
                </div>
            </div>

            {/* Premium Minimal Glass Footer */}
            <footer className='ultimate-landing__footer'>
                <div className='footer-content'>
                    <div className='footer-left'>
                        {localize('Powered by Deriv API')}
                    </div>
                    <div className='footer-center'>
                        <span className='deriv-icon-glow' />
                        {localize('Ultimate Traders AI')} • {localize('Version 2.0')}
                    </div>
                    <div className='footer-right'>
                        {localize('Secure • Fast • Intelligent')}
                    </div>
                </div>
            </footer>
        </div>
    );
});

export default UltimateWelcomePage;
