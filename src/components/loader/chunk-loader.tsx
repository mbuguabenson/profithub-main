import { TrendingUp } from '@/components/startup-loader/loader-icons';
import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <div className='chunk-loader-overlay'>
            <div className='chunk-loader-card'>
                <div className='chunk-loader-spinner-wrapper'>
                    <div className='spinner-outer-ring' />
                    <div className='spinner-inner-ring' />
                    <div className='spinner-core-icon'>
                        <TrendingUp size={24} strokeWidth={2.5} />
                    </div>
                </div>
                {message && <div className='chunk-loader-text'>{message}</div>}
                <div className='chunk-loader-indicator'>
                    <span className='indicator-dot' />
                    <span className='indicator-label'>SECURE AI CONNECT</span>
                </div>
            </div>
        </div>
    );
}
