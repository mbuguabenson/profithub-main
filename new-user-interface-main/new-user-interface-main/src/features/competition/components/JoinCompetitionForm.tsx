import { FormEvent, useState } from 'react';
import { generateOAuthURL } from '@/components/shared';
import type { DerivCompetitionAccount, ParticipantSnapshot } from '@/features/competition/types/competition.types';

type JoinCompetitionFormProps = {
    isLoggedIn: boolean;
    participantSnapshot: ParticipantSnapshot | null;
    availableAccounts: DerivCompetitionAccount[];
    isBusy: boolean;
    onCreateProfile: (username: string) => Promise<void>;
    onConnectAccount: (accountId: string) => Promise<void>;
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const JoinCompetitionForm = ({
    isLoggedIn,
    participantSnapshot,
    availableAccounts,
    isBusy,
    onCreateProfile,
    onConnectAccount,
}: JoinCompetitionFormProps) => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const normalized = username.trim().toLowerCase();

        if (!USERNAME_PATTERN.test(normalized)) {
            setError('Use 3-20 characters with lowercase letters, numbers, or underscores only.');
            return;
        }

        setError('');
        await onCreateProfile(normalized);
    };

    const handleLogin = async () => {
        const oauthUrl = await generateOAuthURL();
        if (oauthUrl) {
            window.location.replace(oauthUrl);
        }
    };

    const needsUsername = !participantSnapshot;
    const needsAccount = participantSnapshot?.participant.registration_status === 'pending';

    return (
        <section className='competition-card competition-join'>
            <div className='competition-section-heading'>
                <div>
                    <h2>Join Competition</h2>
                    <p>Create a username first, then connect one existing real Deriv account.</p>
                </div>
            </div>

            {!isLoggedIn ? (
                <div className='competition-join__login-state'>
                    <p>Log in with your existing Deriv account first, then opt in to the competition.</p>
                    <button type='button' className='competition-button competition-button--primary' onClick={handleLogin}>
                        Log in to join
                    </button>
                </div>
            ) : null}

            {needsUsername ? (
                <form className='competition-join__form' onSubmit={handleSubmit}>
                    <label htmlFor='competition-username'>Competition username</label>
                    <input
                        id='competition-username'
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        placeholder='risk_manager_01'
                    />
                    {error ? <p className='competition-feedback competition-feedback--error'>{error}</p> : null}
                    <button
                        type='submit'
                        className='competition-button competition-button--primary'
                        disabled={isBusy || !isLoggedIn}
                    >
                        {isBusy ? 'Saving...' : 'Create profile'}
                    </button>
                </form>
            ) : null}

            {needsAccount ? (
                <div className='competition-join__accounts'>
                    <p>Select one verified real account. Demo accounts are blocked automatically.</p>
                    <div className='competition-join__account-list'>
                        {availableAccounts.length ? (
                            availableAccounts.map(account => (
                                <button
                                    key={account.loginid}
                                    type='button'
                                    className='competition-account-option'
                                    onClick={() => onConnectAccount(account.loginid)}
                                    disabled={isBusy}
                                >
                                    <strong>{account.loginid}</strong>
                                    <span>{account.currency}</span>
                                </button>
                            ))
                        ) : (
                            <p className='competition-feedback'>No real Deriv accounts are available in this session yet.</p>
                        )}
                    </div>
                </div>
            ) : null}

            {!needsUsername && !needsAccount ? (
                <p className='competition-feedback competition-feedback--success'>
                    Your competition profile is set. You are waiting for the competition to begin.
                </p>
            ) : null}
        </section>
    );
};

export default JoinCompetitionForm;
