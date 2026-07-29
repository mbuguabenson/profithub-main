import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, recoverFromError, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful, sell } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';
import { observer as globalObserver } from '../../../utils/observer';

let delayIndex = 0;
let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        purchase(contract_type) {
            // Prevent calling purchase twice
            const speed = localStorage.getItem('bot_execution_speed') || '1';
            const isSpeedMode = speed !== '1';
            const isBulkEnabled = (this.purchase_block_allow_bulk === 'yes') || (window.scanner_store?.is_bulk_trades_enabled);
            if (!isBulkEnabled && this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            if (isSpeedMode) {
                const now = Date.now();
                const lastPurchase = this.lastPurchaseTime || 0;
                const symbol = this.symbol || this.tradeOptions?.symbol || (this.trade_option && this.trade_option.underlying_symbol) || '';
                const is1sMarket = symbol && (symbol.startsWith('1HZ') || symbol.includes('1s') || symbol.includes('1S'));
                const minDelay = speed === '3' ? 10 : (is1sMarket ? 500 : 1000);
                if (now - lastPurchase < minDelay) {
                    return Promise.resolve();
                }
                this.lastPurchaseTime = now;
            }

            // 🛡️ Virtual Hook Execution Check
            const storedVh = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vh_config') || 'null') : null;
            const vhConfig = (typeof window !== 'undefined' && window.__VH__) || storedVh || (window.scanner_store?.is_virtual_hook_enabled ? {
                enabled: true,
                consecutive_virtual_losses: window.scanner_store.virtual_loss_threshold || 1,
            } : null);

            if (vhConfig?.enabled) {
                if (typeof window.__vh_current_losses_cnt === 'undefined') window.__vh_current_losses_cnt = 0;
                const threshold = Math.max(1, Number(vhConfig.consecutive_virtual_losses || vhConfig.consecutiveLosses || 1));

                if (window.__vh_current_losses_cnt < threshold) {
                    window.__vh_current_losses_cnt++;
                    const currentStep = window.__vh_current_losses_cnt;

                    log(LogTypes.WARN, {
                        message: `🛡️ [VIRTUAL HOOK ACTIVE] Virtual Trade Step ${currentStep}/${threshold} simulated (Virtual Loss). Real balance protected!`
                    });

                    contractStatus({
                        id: 'contract.purchase_received',
                        data: `VIRTUAL_TX_${Date.now()}`,
                        buy: {
                            transaction_id: `VIRTUAL_TX_${Date.now()}`,
                            buy_price: 0,
                        },
                    });

                    // Advance DBot state engine smoothly so the strategy loop continues
                    return new Promise(resolve => {
                        setTimeout(() => {
                            this.store.dispatch(purchaseSuccessful());
                            if (this.afterPromise) {
                                this.afterPromise();
                            }
                            resolve();
                        }, 600);
                    });
                } else {
                    // Threshold met -> reset counter and execute REAL trade on Deriv!
                    window.__vh_current_losses_cnt = 0;
                    log(LogTypes.INFO, {
                        message: `🔥 [VIRTUAL HOOK TRIGGERED] Virtual loss threshold reached (${threshold}/${threshold})! Executing REAL trade on Deriv!`
                    });
                }
            }

            const onSuccess = response => {
                const { buy } = response;

                contractStatus({
                    id: 'contract.purchase_received',
                    data: buy.transaction_id,
                    buy,
                });

                this.contractId = buy.contract_id;
                this.store.dispatch(purchaseSuccessful());

                if (this.is_proposal_subscription_required) {
                    this.renewProposalsOnPurchase();
                }

                if (api_base.api && buy.contract_id) {
                    try {
                        api_base.api.send({
                            proposal_open_contract: 1,
                            contract_id: buy.contract_id,
                            subscribe: 1,
                        });
                    } catch {}
                }

                // 🛡️ POC Watchdog Recovery Timer: Auto-poll contract completion if stream is delayed
                const purchasedContractId = buy.contract_id;
                const watchdogDuration = (Number(this.tradeOptions?.duration || 5) * 1100) + 1000;

                const watchdogTimer = setTimeout(async () => {
                    if (this.contractId === purchasedContractId && !this.isSold) {
                        try {
                            const res = await api_base.api?.send({
                                proposal_open_contract: 1,
                                contract_id: purchasedContractId,
                            });
                            if (res && res.proposal_open_contract) {
                                const poc = res.proposal_open_contract;
                                if (poc.is_sold) {
                                    this.data.contract = poc;
                                    this.setContractFlags(poc);
                                    if (this.afterPromise) this.afterPromise();
                                    this.store.dispatch(sell());
                                }
                            }
                        } catch {}
                    }
                }, watchdogDuration);

                delayIndex = 0;
                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo?.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            const bulkCount = isBulkEnabled ? Math.max(1, Math.min(10, Number(this.purchase_block_bulk_count || window.scanner_store?.bulk_trades_count || 2))) : 1;

            if (bulkCount > 1) {
                log(LogTypes.INFO, { message: `🚀 [BULK TRADES] Placing ${bulkCount} parallel contracts simultaneously on Deriv...` });
                const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);

                try {
                    globalObserver.emit('replicator.purchase', {
                        mode: 'parameters',
                        request: trade_option,
                        tradeOptions: this.tradeOptions,
                        contract_type,
                        account_id: this.accountInfo?.loginid,
                    });
                } catch {}

                const reqs = [];
                for (let i = 0; i < bulkCount; i++) {
                    reqs.push(api_base.api.send(trade_option).catch(err => ({ error: err })));
                }

                this.isSold = false;
                contractStatus({
                    id: 'contract.purchase_sent',
                    data: this.tradeOptions.amount,
                });

                return Promise.all(reqs).then(responses => {
                    const validResponses = responses.filter(r => r && r.buy && !r.error);

                    validResponses.forEach((res) => {
                        const { buy } = res;
                        contractStatus({
                            id: 'contract.purchase_received',
                            data: buy.transaction_id,
                            buy,
                        });
                        log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                        info({
                            accountID: this.accountInfo?.loginid,
                            totalRuns: this.updateAndReturnTotalRuns(),
                            transaction_ids: { buy: buy.transaction_id },
                            contract_type,
                            buy_price: buy.buy_price,
                        });
                    });

                    if (validResponses.length > 0) {
                        this.contractId = validResponses[0].buy.contract_id;
                        this.store.dispatch(purchaseSuccessful());
                        return validResponses[0];
                    }

                    const errObj = responses.find(r => r && r.error);
                    const errMsg = errObj?.error?.message || errObj?.error || 'Bulk trade purchase failed';
                    log(LogTypes.ERROR, { message: `❌ [BULK TRADES FAILED] ${errMsg}` });

                    this.store.dispatch(purchaseSuccessful());
                    if (this.afterPromise) {
                        this.afterPromise();
                    }
                    return null;
                }).catch(err => {
                    log(LogTypes.ERROR, { message: `❌ [BULK TRADES ERROR] ${err?.message || err}` });
                    this.store.dispatch(purchaseSuccessful());
                    if (this.afterPromise) {
                        this.afterPromise();
                    }
                    return null;
                });
            }

            const trade_option = tradeOptionToBuy(contract_type, this.tradeOptions);

            let selectedProposal = null;
            if (this.is_proposal_subscription_required) {
                try {
                    selectedProposal = this.selectProposal(contract_type);
                } catch (propErr) {
                    console.warn('[Purchase] Proposal selection failed, falling back to parameters:', propErr);
                }
            }

            if (selectedProposal && selectedProposal.id) {
                const { id, askPrice } = selectedProposal;

                try {
                    globalObserver.emit('replicator.purchase', {
                        mode: 'proposal_id',
                        request: { buy: id, price: askPrice },
                        tradeOptions: this.tradeOptions,
                        contract_type,
                        account_id: this.accountInfo?.loginid,
                    });
                } catch {}

                const action = () => api_base.api.send({ buy: id, price: askPrice });
                this.isSold = false;

                contractStatus({
                    id: 'contract.purchase_sent',
                    data: askPrice,
                });

                return action().then(onSuccess).catch(err => {
                    console.warn('[Purchase] Proposal purchase failed, retrying with parameters:', err);
                    const paramAction = () => api_base.api.send(trade_option);
                    return paramAction().then(onSuccess).catch(paramErr => {
                        const errMsg = paramErr?.error?.message || paramErr?.message || 'Purchase failed';
                        log(LogTypes.ERROR, { message: `❌ [PURCHASE FAILED] ${errMsg}` });
                        this.store.dispatch(purchaseSuccessful());
                        if (this.afterPromise) {
                            this.afterPromise();
                        }
                    });
                });
            }

            try {
                globalObserver.emit('replicator.purchase', {
                    mode: 'parameters',
                    request: trade_option,
                    tradeOptions: this.tradeOptions,
                    contract_type,
                    account_id: this.accountInfo?.loginid,
                });
            } catch {}

            const action = () => api_base.api.send(trade_option);
            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: this.tradeOptions.amount,
            });

            return action().then(onSuccess).catch(err => {
                const errMsg = err?.error?.message || err?.message || 'Purchase failed';
                log(LogTypes.ERROR, { message: `❌ [PURCHASE FAILED] ${errMsg}` });
                this.store.dispatch(purchaseSuccessful());
                if (this.afterPromise) {
                    this.afterPromise();
                }
            });
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
