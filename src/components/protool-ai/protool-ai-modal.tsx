import React, { Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import AutoTrades from '@/pages/auto-trades/auto-trades';
import './protool-ai-modal.scss';

const ProToolAiModal = observer(() => {
    const { dashboard } = useStore();
    const { is_protool_ai_modal_visible, setProToolAiModalVisibility } = dashboard;

    const handleClose = () => {
        setProToolAiModalVisibility(false);
    };

    return (
        <>
            {is_protool_ai_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('ProTool AI - Automation & Analytics')}
                    onClose={handleClose}
                    modalWidth={900}
                    modalHeight={650}
                    minWidth={600}
                    minHeight={450}
                    enableResizing
                >
                    <div className='protool-ai-modal-body'>
                        <Suspense fallback={<div className='protool-ai-modal-loading'>{localize('Loading Automation AI...')}</div>}>
                            <AutoTrades isModal={true} />
                        </Suspense>
                    </div>
                </DraggableResizeWrapper>
            )}
        </>
    );
});

export default ProToolAiModal;
