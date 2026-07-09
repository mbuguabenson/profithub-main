import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import IframeWrapper from '@/components/iframe-wrapper';
import './profihub-modal.scss';

const ProfihubModal = observer(() => {
    const { dashboard } = useStore();
    const { is_profihub_modal_visible, setProfihubModalVisibility } = dashboard;

    return (
        <>
            {is_profihub_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('Profihub')}
                    onClose={setProfihubModalVisibility}
                    modalWidth={700}
                    modalHeight={600}
                    minWidth={520}
                    minHeight={420}
                    enableResizing
                >
                    <div className='profihub-modal-body'>
                        <IframeWrapper
                            src='https://analysisprofithub.vercel.app/'
                            title='Profihub'
                            className='profihub-modal-container'
                        />
                    </div>
                </DraggableResizeWrapper>
            )}
        </>
    );
});

export default ProfihubModal;
