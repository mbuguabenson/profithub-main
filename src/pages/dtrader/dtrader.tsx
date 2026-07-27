import React from 'react';
import { observer } from 'mobx-react-lite';
import IframeWrapper from '@/components/iframe-wrapper/iframe-wrapper';
import { useStore } from '@/hooks/useStore';
import './dtrader.scss';

const DTraderPage: React.FC = observer(() => {
    const { client } = useStore();
    const token = localStorage.getItem('active_token') || localStorage.getItem('token') || localStorage.getItem('deriv_api_token') || '';
    const loginid = client?.loginid || localStorage.getItem('active_loginid') || '';

    // Direct hosted DTrader application URL with session parameter injection
    const dtraderUrl = `https://deriv-dtrader.vercel.app/?token=${encodeURIComponent(token)}&acct=${encodeURIComponent(loginid)}&app_id=1089`;

    return (
        <div className='dtrader-page-container' style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <IframeWrapper
                src={dtraderUrl}
                title='DTrader Terminal'
                className='dtrader-iframe'
            />
        </div>
    );
});

export default DTraderPage;
