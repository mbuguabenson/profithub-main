import { lazy, Suspense } from 'react';
import './floating-market-hunter.scss';

const MarketHunterPro = lazy(() => import('../../pages/market-hunter-pro'));

const FloatingMarketHunter = () => {
    return (
        <Suspense fallback={null}>
            <MarketHunterPro />
        </Suspense>
    );
};

export default FloatingMarketHunter;

