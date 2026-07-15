import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { addComma, getCurrencyDisplayCode, getDecimalPlaces } from '@/components/shared';
import Text from '@/components/shared_ui/text';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { isDemoAccount } from '@/utils/account-helpers';
import { Localize, localize } from '@deriv-com/translations';
import { TAccountSwitcher } from './common/types';
import AccountInfoWrapper from './account-info-wrapper';
import './account-switcher.scss';

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const { accountList, activeLoginid } = useApiBase();
    const { client, run_panel } = useStore() ?? {};

    const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'KES'>(() => {
        return (localStorage.getItem('converter_display_currency') as 'USD' | 'KES') || 'USD';
    });
    const [rate, setRate] = useState<number>(() => {
        return parseFloat(localStorage.getItem('converter_kes_rate') || '129.5');
    });

    // Reset balance state
    const [isResettingBalance, setIsResettingBalance] = useState(false);
    const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const handleSync = () => {
            setDisplayCurrency((localStorage.getItem('converter_display_currency') as 'USD' | 'KES') || 'USD');
            setRate(parseFloat(localStorage.getItem('converter_kes_rate') || '129.5'));
        };
        window.addEventListener('currency_changed', handleSync);
        return () => window.removeEventListener('currency_changed', handleSync);
    }, []);

    const toggleDisplayCurrency = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = displayCurrency === 'USD' ? 'KES' : 'USD';
        localStorage.setItem('converter_display_currency', next);
        window.dispatchEvent(new Event('currency_changed'));
    };

    const is_bot_running = run_panel?.is_running || api_base.is_running;
    const isSingleAccount = !accountList || accountList.length <= 1;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const toggleDropdown = useCallback(() => {
        if (is_bot_running || isSingleAccount) return;
        setIsOpen(prev => !prev);
    }, [is_bot_running, isSingleAccount]);

    const handleAccountSelect = useCallback(
        (loginid: string) => {
            localStorage.setItem('active_loginid', loginid);
            client?.checkAndRegenerateWebSocket();
            setIsOpen(false);
        },
        [client]
    );

    // Reset demo balance handler
    const handleResetBalance = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isResettingBalance || !api_base.api) return;

        setIsResettingBalance(true);
        setResetMessage(null);

        try {
            const response = await api_base.api.send({ topup_virtual: 1 });
            if (response?.error) {
                setResetMessage({
                    type: 'error',
                    text: response.error.message || localize('Failed to reset balance'),
                });
            } else {
                setResetMessage({
                    type: 'success',
                    text: localize('Balance reset to 10,000.00 USD'),
                });
                // Refresh account data
                client?.checkAndRegenerateWebSocket();
            }
        } catch (error: any) {
            setResetMessage({
                type: 'error',
                text: error?.message || localize('Failed to reset balance'),
            });
        } finally {
            setIsResettingBalance(false);
            // Auto-clear message after 3 seconds
            setTimeout(() => setResetMessage(null), 3000);
        }
    }, [isResettingBalance, client]);

    const formattedAccounts = useMemo(() => {
        if (!accountList) return [];
        return accountList
            .map(account => {
                const accCurr = account.currency || 'USD';
                const balanceNum = Number(account.balance ?? 0);
                const displayBal =
                    displayCurrency === 'KES' && accCurr === 'USD'
                        ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
                              balanceNum * rate
                          )
                        : addComma(balanceNum.toFixed(getDecimalPlaces(accCurr)));
                const displayCurr =
                    displayCurrency === 'KES' && accCurr === 'USD' ? 'KES' : getCurrencyDisplayCode(accCurr);

                return {
                    loginid: account.loginid,
                    currency: account.currency ? displayCurr : '',
                    balance: displayBal,
                    isVirtual: isDemoAccount(account.loginid),
                    isActive: account.loginid === activeLoginid,
                };
            })
            .sort((a, b) => (a.isActive ? -1 : b.isActive ? 1 : 0));
    }, [accountList, activeLoginid, displayCurrency, rate]);

    if (!activeAccount) return null;

    const { currency, isVirtual, balance } = activeAccount;
    const showChevron = !isSingleAccount && !is_bot_running;

    return (
        <div className='acc-info__wrapper' ref={wrapperRef}>
            <AccountInfoWrapper>
                <div
                    data-testid='dt_acc_info'
                    id='dt_core_account-info_acc-info'
                    role={showChevron ? 'button' : undefined}
                    tabIndex={showChevron ? 0 : -1}
                    aria-expanded={showChevron ? isOpen : undefined}
                    aria-haspopup={showChevron ? 'listbox' : undefined}
                    className={classNames('acc-info', {
                        'acc-info--is-virtual': isVirtual,
                        'acc-info--interactive': showChevron,
                    })}
                    onClick={toggleDropdown}
                    onKeyDown={e => {
                        if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggleDropdown();
                        }
                    }}
                >
                    {/* Modern account badge */}
                    <div className='acc-info__badge'>
                        <span className={classNames('acc-info__badge-dot', {
                            'acc-info__badge-dot--demo': isVirtual,
                            'acc-info__badge-dot--real': !isVirtual,
                        })} />
                    </div>
                    <div className='acc-info__content'>
                        <div className='acc-info__account-type-header'>
                            <span className={classNames('acc-info__type-pill', {
                                'acc-info__type-pill--demo': isVirtual,
                                'acc-info__type-pill--real': !isVirtual,
                            })}>
                                {isVirtual ? localize('Demo') : localize('Real')}
                            </span>
                            {showChevron && (
                                <span
                                    className={classNames('acc-info__select-arrow', {
                                        'acc-info__select-arrow--invert': isOpen,
                                    })}
                                >
                                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                                        <path
                                            d='M2 4L6 8L10 4'
                                            stroke='currentColor'
                                            strokeWidth='1.5'
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                        />
                                    </svg>
                                </span>
                            )}
                        </div>
                        {(typeof balance !== 'undefined' || !currency) && (
                            <div className='acc-info__balance-section'>
                                <p
                                    data-testid='dt_balance'
                                    className={classNames('acc-info__balance', {
                                        'acc-info__balance--no-currency': !currency && !isVirtual,
                                    })}
                                >
                                    {!currency ? (
                                        <Localize i18n_default_text='No currency assigned' />
                                    ) : (
                                        (() => {
                                            const accCurr = currency || 'USD';
                                            if (displayCurrency === 'KES' && accCurr === 'USD') {
                                                const balanceNum = parseFloat(balance.replace(/,/g, '')) || 0;
                                                const converted = balanceNum * rate;
                                                return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(converted)} KES`;
                                            }
                                            return `${balance} ${getCurrencyDisplayCode(accCurr)}`;
                                        })()
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </AccountInfoWrapper>
            {isOpen && (
                <div className='acc-dropdown' role='listbox'>
                    <div className='acc-dropdown__header'>
                        <span className='acc-dropdown__header-title'>
                            <Localize i18n_default_text='Switch Account' />
                        </span>
                    </div>
                    {formattedAccounts.map(account => (
                        <div
                            key={account.loginid}
                            role='option'
                            aria-selected={account.isActive}
                            tabIndex={0}
                            className={classNames('acc-dropdown__account', {
                                'acc-dropdown__account--selected': account.isActive,
                                'acc-dropdown__account--virtual': account.isVirtual,
                            })}
                            onClick={() => !account.isActive && handleAccountSelect(account.loginid)}
                            onKeyDown={e => {
                                if (!account.isActive && (e.key === 'Enter' || e.key === ' ')) {
                                    e.preventDefault();
                                    handleAccountSelect(account.loginid);
                                }
                            }}
                        >
                            <div className='acc-dropdown__account-row'>
                                <span className={classNames('acc-dropdown__status-dot', {
                                    'acc-dropdown__status-dot--demo': account.isVirtual,
                                    'acc-dropdown__status-dot--real': !account.isVirtual,
                                })} />
                                <div className='acc-dropdown__account-details'>
                                    <Text
                                        size='xxxs'
                                        className={classNames('acc-dropdown__account-type', {
                                            'acc-dropdown__account-type--virtual': account.isVirtual,
                                        })}
                                    >
                                        {account.isVirtual ? (
                                            <Localize i18n_default_text='Demo' />
                                        ) : (
                                            <Localize i18n_default_text='Real' />
                                        )}
                                    </Text>
                                    <Text size='xs' weight='bold' className='acc-dropdown__balance'>
                                        {account.currency ? (
                                            `${account.balance} ${getCurrencyDisplayCode(account.currency)}`
                                        ) : (
                                            <Localize i18n_default_text='No currency assigned' />
                                        )}
                                    </Text>
                                </div>
                                {account.isActive && (
                                    <span className='acc-dropdown__active-check'>
                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
                                            <polyline points='20 6 9 17 4 12' />
                                        </svg>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    {/* Reset Demo Balance Button — only for demo accounts */}
                    {isVirtual && (
                        <div className='acc-dropdown__reset-section'>
                            <button
                                className={classNames('acc-dropdown__reset-btn', {
                                    'acc-dropdown__reset-btn--loading': isResettingBalance,
                                })}
                                onClick={handleResetBalance}
                                disabled={isResettingBalance}
                            >
                                {isResettingBalance ? (
                                    <>
                                        <svg className='acc-dropdown__reset-spinner' viewBox='0 0 24 24' width='14' height='14'>
                                            <circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeDasharray='31.416' strokeDashoffset='10' fill='none' />
                                        </svg>
                                        <Localize i18n_default_text='Resetting...' />
                                    </>
                                ) : (
                                    <>
                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                                            <path d='M1 4v6h6' />
                                            <path d='M3.51 15a9 9 0 102.13-9.36L1 10' />
                                        </svg>
                                        <Localize i18n_default_text='Reset Demo Balance' />
                                    </>
                                )}
                            </button>
                            {resetMessage && (
                                <div className={classNames('acc-dropdown__reset-msg', {
                                    'acc-dropdown__reset-msg--success': resetMessage.type === 'success',
                                    'acc-dropdown__reset-msg--error': resetMessage.type === 'error',
                                })}>
                                    {resetMessage.text}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default AccountSwitcher;
