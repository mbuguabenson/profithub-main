import './chunk-loader.scss';

export default function ChunkLoader({ message }: { message?: string }) {
    const textToDisplay = message ? message.replace(/^Please wait,\s*/i, '').replace(/\.\.\.$/, '').toUpperCase() : 'LOADING';

    return (
        <div className='chunk-loader-overlay'>
            <div className='chunk-loader-card'>
                <div className='loader'>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='text'><span>{textToDisplay}</span></div>
                    <div className='line' />
                </div>
            </div>
        </div>
    );
}

