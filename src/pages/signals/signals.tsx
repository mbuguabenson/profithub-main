import React from 'react';
import NativeSignalScanner3 from '@/components/scanner-v3';

const Signals: React.FC = () => {
    return (
        <div style={{ height: 'calc(100vh - 12rem)', width: '100%', overflow: 'hidden' }}>
            <NativeSignalScanner3 />
        </div>
    );
};

export default Signals;
