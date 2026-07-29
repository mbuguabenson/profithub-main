import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { Orbit } from 'lucide-react';
import './floating-market-hunter.scss';

const MarketHunterPro = lazy(() => import('../../pages/market-hunter-pro'));

// ─── Draggable hook for FAB ──────────────────────────────────────────────────
function useDraggable(initialPos: { x: number; y: number }) {
    const [pos, setPos] = useState(initialPos);
    const dragging = useRef(false);
    const offset = useRef({ x: 0, y: 0 });
    const ref = useRef<HTMLDivElement>(null);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        dragging.current = true;
        offset.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        };
        e.preventDefault();
    }, [pos]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!dragging.current) return;
            const newX = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - offset.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y));
            setPos({ x: newX, y: newY });
        };
        const onUp = () => { dragging.current = false; };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, []);

    return { pos, ref, onMouseDown };
}

const FloatingMarketHunter = () => {
    return (
        <Suspense fallback={null}>
            <MarketHunterPro />
        </Suspense>
    );
};

export default FloatingMarketHunter;

