import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { expectInitArg } from '../utils/sanitize';
import { proposalsReady, start } from './state/actions';
import * as constants from './state/constants';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';

let lastResolvedScope = null;
let lastResolvedTick = null;

const watchBefore = store =>
    watchScope({
        store,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
    });

const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
    });

/* Optimized watchScope function:
 * Resolves instantly (0ms) on scope transition or new tick arrival so contracts purchase ASAP.
 * When called repeatedly within the same tick/scope, yields execution to the event loop so ticks
 * can be received without freezing the browser thread.
 */
const watchScope = ({ store, stopScope, passScope, passFlag }) => {
    const currentState = store.getState();
    if (currentState.scope === stopScope) {
        lastResolvedScope = currentState.scope;
        return Promise.resolve(false);
    }

    const isTargetState = currentState.scope === passScope && currentState[passFlag];
    const isNewCycleOrTick =
        lastResolvedScope !== passScope ||
        (currentState.newTick !== undefined && currentState.newTick !== lastResolvedTick);

    if (isTargetState && isNewCycleOrTick) {
        lastResolvedScope = passScope;
        lastResolvedTick = currentState.newTick;
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        let timer = null;
        let unsubscribe = null;

        const cleanup = () => {
            if (unsubscribe) unsubscribe();
            if (timer) clearTimeout(timer);
        };

        unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            if (newState.scope === stopScope) {
                cleanup();
                lastResolvedScope = newState.scope;
                resolve(false);
                return;
            }

            const targetReady = newState.scope === passScope && newState[passFlag];
            const hasNewTick = newState.newTick !== undefined && newState.newTick !== lastResolvedTick;

            if (targetReady && (lastResolvedScope !== passScope || hasNewTick)) {
                cleanup();
                lastResolvedScope = passScope;
                lastResolvedTick = newState.newTick;
                resolve(true);
            }
        });

        timer = setTimeout(() => {
            cleanup();
            const stateAtTimeout = store.getState();
            if (stateAtTimeout.scope === stopScope) {
                lastResolvedScope = stateAtTimeout.scope;
                resolve(false);
            } else if (stateAtTimeout.scope === passScope && stateAtTimeout[passFlag]) {
                lastResolvedScope = passScope;
                lastResolvedTick = stateAtTimeout.newTick;
                resolve(true);
            } else {
                resolve(false);
            }
        }, 5);
    });
};

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.observe();
        this.data = {
            contract: {},
            proposals: [],
        };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
    }

    init(...args) {
        const [token, options] = expectInitArg(args);
        const { symbol } = options;

        this.initArgs = args;
        this.options = options;
        this.startPromise = this.loginAndGetBalance(token);

        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', getLocalizedErrorMessage('NotInitialized'));
        }

        globalObserver.emit('bot.running');

        const validated_trade_options = this.validateTradeOptions(tradeOptions);

        this.tradeOptions = { ...validated_trade_options, symbol: this.options.symbol };
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);

        this.makeDirectPurchaseDecision();
    }

    loginAndGetBalance(token) {
        if (this.token === token) {
            return Promise.resolve();
        }
        // for strategies using total runs, GetTotalRuns function is trying to get loginid and it gets called before Proposals calls.
        // the below required loginid to be set in Proposal calls where loginAndGetBalance gets resolved.
        // Earlier this used to happen as soon as we get ticks_history response and by the time GetTotalRuns gets called we have required info.
        this.accountInfo = api_base.account_info;
        this.token = api_base.token;
        return new Promise(resolve => {
            if (api_base.api) {
                const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                    if (data?.msg_type === 'transaction' && data?.transaction?.action === 'sell') {
                        this.transaction_recovery_timeout = setTimeout(() => {
                            const { contract } = this.data;
                            const is_same_contract = contract?.contract_id === data.transaction?.contract_id;
                            const is_open_contract = contract?.status === 'open';
                            if (is_same_contract && is_open_contract) {
                                doUntilDone(() => {
                                    api_base.api.send({ proposal_open_contract: 1, contract_id: contract.contract_id });
                                }, ['PriceMoved']);
                            }
                        }, 600);
                    }
                });
                api_base.pushSubscription(subscription);
            }
            resolve();
        });
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    watch(watchName) {
        if (watchName === 'before') {
            return watchBefore(this.store);
        }
        return watchDuring(this.store);
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        const speed = localStorage.getItem('bot_execution_speed') || '1';
        const isSpeedMode = speed !== '1';
        this.is_proposal_subscription_required = !isSpeedMode && (has_payout_block || is_basis_payout);

        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
