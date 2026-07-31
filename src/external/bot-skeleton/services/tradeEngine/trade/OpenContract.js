import { getRoundedNumber } from '@/components/shared';
import { api_base } from '../../api/api-base';
import { contract as broadcastContract, contractStatus } from '../utils/broadcast';
import { openContractReceived, sell } from './state/actions';
import { tradeLockManager } from '@/services/trade-lock-manager';
import { tradeQueueWorker } from '@/services/trade-queue-worker';
import { martingaleManager } from '@/services/martingale-manager';

export default Engine =>
    class OpenContract extends Engine {
        observeOpenContract() {
            if (!api_base.api) return;
            if (!this.processedSoldContractIds) {
                this.processedSoldContractIds = new Set();
            }
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'proposal_open_contract') {
                    const contract = data.proposal_open_contract;
                    const contractId = String(contract?.contract_id || '');

                    if (!contract || !this.expectedContractId(contractId)) {
                        return;
                    }

                    this.setContractFlags(contract);

                    this.data.contract = contract;

                    broadcastContract({ accountID: api_base.account_info.loginid, ...contract });

                    if (this.isSold) {
                        // 🛡️ Prevent duplicate sold event processing for the same contract
                        if (this.processedSoldContractIds.has(contractId)) {
                            return;
                        }
                        this.processedSoldContractIds.add(contractId);

                        if (this.processedSoldContractIds.size > 100) {
                            const firstItem = this.processedSoldContractIds.values().next().value;
                            if (firstItem) this.processedSoldContractIds.delete(firstItem);
                        }

                        this.contractId = '';
                        if (this.watchdog_timer) clearTimeout(this.watchdog_timer);
                        if (this.transaction_recovery_timeout) clearTimeout(this.transaction_recovery_timeout);

                        const profit = Number(contract.sell_price || 0) - Number(contract.buy_price || 0);
                        const isWin = profit > 0;
                        martingaleManager.processContractResult(contractId, isWin);

                        tradeLockManager.releaseLock(contractId);
                        tradeQueueWorker.onContractCompleted(contractId);

                        this.updateTotals(contract);
                        contractStatus({
                            id: 'contract.sold',
                            data: contract.transaction_ids?.sell ?? contract.transaction_id ?? '',
                            contract,
                        });

                        const resolveAfter = this.afterPromise;
                        this.afterPromise = null;
                        if (resolveAfter) {
                            resolveAfter();
                        }

                        this.store.dispatch(sell());
                    } else {
                        this.store.dispatch(openContractReceived());
                    }
                }
            });
            api_base.pushSubscription(subscription);
        }

        waitForAfter() {
            return new Promise(resolve => {
                this.afterPromise = resolve;
            });
        }

        setContractFlags(contract) {
            const { is_expired, is_valid_to_sell, is_sold, entry_tick } = contract;

            this.isSold = Boolean(is_sold);
            this.isSellAvailable = !this.isSold && Boolean(is_valid_to_sell);
            this.isExpired = Boolean(is_expired);
            this.hasEntryTick = Boolean(entry_tick);
        }

        expectedContractId(contractId) {
            if (!contractId) return false;
            if (this.contractId && String(contractId) === String(this.contractId)) return true;
            if (this.purchasedContractIds && this.purchasedContractIds.includes(String(contractId))) return true;
            return Boolean(this.contractId);
        }

        getSellPrice() {
            const { bid_price: bidPrice, buy_price: buyPrice, currency } = this.data.contract;
            return getRoundedNumber(Number(bidPrice) - Number(buyPrice), currency);
        }
    };
