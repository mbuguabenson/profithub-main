import {
    formatMoney,
    getCurrencyDisplayCode,
    isCryptocurrency,
} from '@/components/shared/utils/currency/currency';

export const formatCompetitionMoney = (amount?: number | null, currency = 'USD') => {
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
        return '--';
    }

    const numericAmount = Number(amount);

    if (isCryptocurrency(currency)) {
        return `${formatMoney(currency, numericAmount, true, 0, 0)} ${getCurrencyDisplayCode(currency)}`;
    }

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(numericAmount);
    } catch {
        return `${formatMoney(currency, numericAmount, true, 0, 0)} ${getCurrencyDisplayCode(currency)}`;
    }
};
