import {
    getCompetitionCurrencyDisplay,
    isSafeCompetitionCurrency,
    normalizeCompetitionCurrency,
    sanitizeLeaderboardEntry,
} from './competitionSafety';

describe('competitionSafety', () => {
    it('preserves Deriv special currency casing', () => {
        expect(normalizeCompetitionCurrency('tusdt')).toBe('tUSDT');
        expect(normalizeCompetitionCurrency('EUSDT')).toBe('eUSDT');
    });

    it('accepts crypto and intl-supported currency codes', () => {
        expect(isSafeCompetitionCurrency('USD')).toBe(true);
        expect(isSafeCompetitionCurrency('tUSDT')).toBe(true);
    });

    it('sanitizes malformed leaderboard amounts without throwing', () => {
        const entry = sanitizeLeaderboardEntry({
            competition_id: 'c1',
            participant_id: 'p1',
            username: 'tester',
            masked_account_id: 'DO****1234',
            account_currency: 'weird-code',
            starting_balance: 'not-a-number' as never,
            current_balance: 120.5,
            adjusted_profit: undefined as never,
            growth_percentage: null,
            current_rank: 1,
            previous_rank: 2,
            last_balance_update_at: null,
        });

        expect(entry.account_currency).toBe('WEIRD-CODE');
        expect(entry.starting_balance).toBeNull();
        expect(entry.current_balance).toBe(120.5);
        expect(entry.adjusted_profit).toBeNull();
        expect(getCompetitionCurrencyDisplay(entry.account_currency)).toBe('WEIRD-CODE');
    });
});
