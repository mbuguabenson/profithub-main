import React from 'react';

const TradingView: React.FC = () => {
    return (
        <iframe
            id='trading-view-tab-iframe'
            style={{
                width: '100%',
                height: 'calc(100vh - 80px)',
                border: 'none',
                background: '#0e0e0e',
            }}
            src='https://smartcharts.deriv.com/'
            title='TradingView Charts'
            allow='fullscreen'
        />
    );
};

export default TradingView;
