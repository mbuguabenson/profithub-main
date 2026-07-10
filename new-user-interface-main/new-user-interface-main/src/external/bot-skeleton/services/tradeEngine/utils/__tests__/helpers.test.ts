jest.mock('@deriv-com/translations', () => ({
    getInitialLanguage: jest.fn(() => 'EN'),
    Localize: ({ i18n_default_text }: { i18n_default_text: string }) => i18n_default_text,
    localize: jest.fn((text: string) => text),
}));

import { createDetails } from '../helpers';

describe('createDetails', () => {
    it('returns safe empty details before a complete contract exists', () => {
        expect(createDetails()).toEqual(['', 0, 0, 0, '', '', 0, '', 0, 0, '']);
    });

    it('falls back to the contract ID when transaction IDs are omitted', () => {
        expect(
            createDetails({
                buy_price: 1,
                contract_id: 42,
                contract_type: 'CALL',
                currency: 'USD',
                sell_price: 0,
            })
        ).toEqual([42, 1, 0, -1, 'CALL', '', 0, '', 0, 0, 'loss']);
    });

    it('does not report an unfinished contract as a win', () => {
        expect(createDetails({ buy_price: 1, contract_id: 42, sell_price: '' })[10]).toBe('');
    });
});
