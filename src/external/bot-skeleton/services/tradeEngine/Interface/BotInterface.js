import { observer as globalObserver } from '../../../utils/observer';
import { createDetails } from '../utils/helpers';

const getBotInterface = tradeEngine => {
    const getDetail = i => createDetails(tradeEngine.data.contract)[i];

    return {
        init: (...args) => tradeEngine.init(...args),
        start: (...args) => tradeEngine.start(...args),
        stop: (...args) => tradeEngine.stop(...args),
        purchase: contract_type => tradeEngine.purchase(contract_type),
        bulkPurchase: (contract_type, count) => {
            tradeEngine.purchase_block_allow_bulk = 'yes';
            tradeEngine.purchase_block_bulk_count = count || 2;
            return tradeEngine.purchase(contract_type);
        },
        changeActiveSymbol: symbol => {
            if (symbol && symbol !== 'disable') {
                tradeEngine.symbol = symbol;
                if (tradeEngine.tradeOptions) {
                    tradeEngine.tradeOptions.symbol = symbol;
                }
                if (tradeEngine.trade_option) {
                    tradeEngine.trade_option.underlying_symbol = symbol;
                }
                if (tradeEngine.options) {
                    tradeEngine.options.symbol = symbol;
                }
                return tradeEngine.watchTicks(symbol);
            }
            return Promise.resolve();
        },
        getAskPrice: contract_type => Number(getProposal(contract_type, tradeEngine).ask_price),
        getPayout: contract_type => Number(getProposal(contract_type, tradeEngine).payout),
        getPurchaseReference: () => tradeEngine.getPurchaseReference(),
        isSellAvailable: () => tradeEngine.isSellAtMarketAvailable(),
        sellAtMarket: () => tradeEngine.sellAtMarket(),
        getSellPrice: () => getSellPrice(tradeEngine),
        isResult: result => getDetail(10) === result,
        isTradeAgain: result => globalObserver.emit('bot.trade_again', result),
        readDetails: i => getDetail(i - 1),
    };
};

const getProposal = (contract_type, tradeEngine) => {
    return tradeEngine.data.proposals.find(
        proposal =>
            proposal.contract_type === contract_type &&
            proposal.purchase_reference === tradeEngine.getPurchaseReference()
    );
};

const getSellPrice = tradeEngine => {
    return tradeEngine.getSellPrice();
};

export default getBotInterface;
