import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { Orbit, X, GripVertical } from 'lucide-react';
import './floating-market-hunter.scss';

const MarketHunterPro = lazy(() => import('../../pages/market-hunter-pro'));

// ─── Draggable hook ───────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
const FloatingMarketHunter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isPanelDragging, setIsPanelDragging] = useState(false);

    // FAB button position
    const fab = useDraggable({ x: window.innerWidth - 80, y: window.innerHeight - 160 });

    // Panel position
    const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 880, y: 60 });
    const panelOffset = useRef({ x: 0, y: 0 });

    const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
        setIsPanelDragging(true);
        panelOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
        e.preventDefault();
    }, [panelPos]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isPanelDragging) return;
            const newX = Math.max(0, Math.min(window.innerWidth - 860, e.clientX - panelOffset.current.x));
            const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - panelOffset.current.y));
            setPanelPos({ x: newX, y: newY });
        };
        const onUp = () => setIsPanelDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isPanelDragging]);

    const handleFabClick = useCallback((e: React.MouseEvent) => {
        // Only toggle if not dragging
        const dx = Math.abs(e.clientX - (fab.pos.x + 28));
        const dy = Math.abs(e.clientY - (fab.pos.y + 28));
        if (dx < 10 && dy < 10) {
            setIsOpen(prev => !prev);
        }
    }, [fab.pos]);

    return (
        <>
            {/* ── Floating Orbit Button ──────────────────────────────────────── */}
            <div
                ref={fab.ref}
                className={`fmh-fab${isOpen ? ' fmh-fab--active' : ''}`}
                style={{ left: fab.pos.x, top: fab.pos.y }}
                onMouseDown={fab.onMouseDown}
                onClick={handleFabClick}
                title='Market Hunter Pro'
                role='button'
                aria-label='Open Market Hunter Pro'
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(p => !p); }}
            >
                <Orbit size={26} strokeWidth={1.5} className='fmh-fab__icon' />
                <span className='fmh-fab__pulse' />
            </div>

            {/* ── Floating Panel ─────────────────────────────────────────────── */}
            {isOpen && (
                <div
                    className={`fmh-panel${isPanelDragging ? ' fmh-panel--dragging' : ''}`}
                    style={{ left: panelPos.x, top: panelPos.y }}
                >
                    {/* Panel drag handle + header */}
                    <div
                        className='fmh-panel__header'
                        onMouseDown={handlePanelDragStart}
                    >
                        <GripVertical size={14} className='fmh-panel__grip' />
                        <Orbit size={16} strokeWidth={1.5} className='fmh-panel__orbit-icon' />
                        <span className='fmh-panel__title'>Market Hunter Pro</span>
                        <button
                            className='fmh-panel__close'
                            onClick={() => setIsOpen(false)}
                            aria-label='Close Market Hunter Pro'
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Panel content */}
                    <div className='fmh-panel__body'>
                        <Suspense fallback={
                            <div className='fmh-panel__loading'>
                                <Orbit size={32} strokeWidth={1} className='fmh-panel__loading-icon' />
                                <span>Loading Market Hunter Pro...</span>
                            </div>
                        }>
                            <MarketHunterPro />
                        </Suspense>
                    </div>
                </div>
            )}
        </>
    );
};

export default FloatingMarketHunter;
