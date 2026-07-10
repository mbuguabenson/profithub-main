import { getCurrencyDisplayCode, isCryptocurrency } from '@/components/shared/utils/currency/currency';
import type {
    CompetitionParticipant,
    CompetitionRecord,
    CompetitionResult,
    DerivCompetitionAccount,
    LeaderboardEntry,
    ParticipantSnapshot,
} from '@/features/competition/types/competition.types';

const SPECIAL_CURRENCY_CODES: Record<string, string> = {
    eusdt: 'eUSDT',
    tusdt: 'tUSDT',
};

const DEFAULT_CURRENCY = 'USD';

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const normalizeCompetitionCurrency = (currency?: string | null) => {
    const normalized = normalizeString(currency);
    if (!normalized) {
        return DEFAULT_CURRENCY;
    }

    const specialCurrency = SPECIAL_CURRENCY_CODES[normalized.toLowerCase()];
    if (specialCurrency) {
        return specialCurrency;
    }

    return normalized.toUpperCase();
};

export const isIntlCurrencyCode = (currency: string) => {
    try {
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(1);
        return true;
    } catch {
        return false;
    }
};

export const isSafeCompetitionCurrency = (currency?: string | null) => {
    const normalized = normalizeCompetitionCurrency(currency);
    return isIntlCurrencyCode(normalized) || isCryptocurrency(normalized);
};

export const getCompetitionCurrencyDisplay = (currency?: string | null) => {
    const normalized = normalizeCompetitionCurrency(currency);
    return getCurrencyDisplayCode(normalized) || normalized;
};

export const sanitizeCompetitionAmount = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
};

export const sanitizeCompetitionRecord = (competition: CompetitionRecord): CompetitionRecord => ({
    ...competition,
    currency: competition.currency ? normalizeCompetitionCurrency(competition.currency) : null,
    participants_count: sanitizeCompetitionAmount(competition.participants_count),
    verified_participants_count: sanitizeCompetitionAmount(competition.verified_participants_count),
});

export const sanitizeCompetitionParticipant = (participant: CompetitionParticipant): CompetitionParticipant => ({
    ...participant,
    username: normalizeString(participant.username) || 'unknown_participant',
    username_normalized: participant.username_normalized ? normalizeString(participant.username_normalized) : undefined,
    masked_account_id: participant.masked_account_id ? normalizeString(participant.masked_account_id) : null,
    account_currency: participant.account_currency ? normalizeCompetitionCurrency(participant.account_currency) : null,
});

export const sanitizeCompetitionResult = (result: CompetitionResult): CompetitionResult => ({
    ...result,
    starting_balance: sanitizeCompetitionAmount(result.starting_balance),
    current_balance: sanitizeCompetitionAmount(result.current_balance),
    deposits: sanitizeCompetitionAmount(result.deposits),
    withdrawals: sanitizeCompetitionAmount(result.withdrawals),
    adjusted_profit: sanitizeCompetitionAmount(result.adjusted_profit),
    growth_percentage: sanitizeCompetitionAmount(result.growth_percentage),
    current_rank: sanitizeCompetitionAmount(result.current_rank),
    previous_rank: sanitizeCompetitionAmount(result.previous_rank),
});

export const sanitizeParticipantSnapshot = (snapshot: ParticipantSnapshot): ParticipantSnapshot => ({
    participant: sanitizeCompetitionParticipant(snapshot.participant),
    result: snapshot.result ? sanitizeCompetitionResult(snapshot.result) : null,
});

export const sanitizeLeaderboardEntry = (entry: LeaderboardEntry): LeaderboardEntry => ({
    ...entry,
    username: normalizeString(entry.username) || 'unknown_participant',
    masked_account_id: entry.masked_account_id ? normalizeString(entry.masked_account_id) : null,
    account_currency: entry.account_currency ? normalizeCompetitionCurrency(entry.account_currency) : null,
    starting_balance: sanitizeCompetitionAmount(entry.starting_balance),
    current_balance: sanitizeCompetitionAmount(entry.current_balance),
    adjusted_profit: sanitizeCompetitionAmount(entry.adjusted_profit),
    growth_percentage: sanitizeCompetitionAmount(entry.growth_percentage),
    current_rank: sanitizeCompetitionAmount(entry.current_rank),
    previous_rank: sanitizeCompetitionAmount(entry.previous_rank),
});

export const sanitizeDerivCompetitionAccount = (account: DerivCompetitionAccount): DerivCompetitionAccount => ({
    ...account,
    loginid: normalizeString(account.loginid),
    currency: normalizeCompetitionCurrency(account.currency),
    balance: sanitizeCompetitionAmount(account.balance) ?? undefined,
    current_balance: sanitizeCompetitionAmount(account.current_balance) ?? undefined,
});
