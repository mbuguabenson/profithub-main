import React, { useState, useRef } from 'react';
import classNames from 'classnames';
import Draggable from 'react-draggable';
import './global-ai-orbit.scss';

const GlobalAiOrbit = () => {
    const nodeRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleStart = () => {
        setIsDragging(false);
    };

    const handleDrag = () => {
        setIsDragging(true);
    };

    const handleStop = (e: any, data: any) => {
        if (!isDragging) {
            console.log('AI Orbit Clicked!');
            const event = new CustomEvent('open_ai_trading_engine');
            document.dispatchEvent(event);
        }
        setIsDragging(false);
    };

    return (
        <Draggable
            nodeRef={nodeRef}
            onStart={handleStart}
            onDrag={handleDrag}
            onStop={handleStop}
            bounds="parent"
        >
            <div ref={nodeRef} className={classNames('global-ai-orbit', { 'global-ai-orbit--dragging': isDragging })}>
                <span className='global-ai-orbit__ring'>
                    <span className='global-ai-orbit__text'>AI</span>
                    <span className='global-ai-orbit__dot' />
                </span>
            </div>
        </Draggable>
    );
};

export default GlobalAiOrbit;
