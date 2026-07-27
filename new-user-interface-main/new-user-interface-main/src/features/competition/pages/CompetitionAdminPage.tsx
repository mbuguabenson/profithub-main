import { observer } from 'mobx-react-lite';
import { useCompetition } from '@/features/competition/hooks/useCompetition';
import '../styles/competition.scss';

const adminActions = [
    { id: 'open_registration', label: 'Open Registration' },
    { id: 'lock', label: 'Lock' },
    { id: 'start', label: 'Start Competition' },
    { id: 'pause', label: 'Pause' },
    { id: 'end', label: 'End' },
];

const CompetitionAdminPage = observer(() => {
    const { competition, isLoading, isJoining, error, runAdminAction } = useCompetition();

    return (
        <div className='competition-page competition-page--admin'>
            <section className='competition-card competition-page__hero'>
                <div className='competition-page__hero-copy'>
                    <span className={`competition-status competition-status--${competition?.status || 'draft'}`}>
                        {competition?.status || 'draft'}
                    </span>
                    <h1>Competition Admin</h1>
                    <p>Move the event through registration, lock, live, pause, and end states from one screen.</p>
                </div>
            </section>

            <section className='competition-card competition-admin'>
                <div className='competition-section-heading'>
                    <div>
                        <h2>Actions</h2>
                        <p>Start snapshots every verified participant balance into the immutable starting balance.</p>
                    </div>
                </div>

                <div className='competition-admin__actions'>
                    {adminActions.map(action => (
                        <button
                            key={action.id}
                            type='button'
                            className='competition-button competition-button--primary'
                            disabled={!competition?.id || isJoining}
                            onClick={() => competition?.id && void runAdminAction(competition.id, action.id)}
                        >
                            {isJoining ? 'Working...' : action.label}
                        </button>
                    ))}
                </div>

                {error ? <p className='competition-feedback competition-feedback--error'>{error}</p> : null}
                {isLoading ? <p>Loading competition details...</p> : null}
            </section>
        </div>
    );
});

export default CompetitionAdminPage;
