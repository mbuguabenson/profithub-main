import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import ScannerComponent from '@/pages/scanner/scanner';
import './scanner.scss';

const Scanner = observer(() => {
  const { scanner } = useStore();
  const { is_open, setScannerVisibility } = scanner;

  return (
    <React.Fragment>
      {is_open && (
        <DraggableResizeWrapper
          boundary=".main"
          header={localize('Entry Scanner')}
          onClose={setScannerVisibility}
          modalWidth={660}
          modalHeight={660}
          minWidth={550}
          minHeight={500}
          enableResizing
        >
          <div className="scanner-container minimal-scanner" style={{ height: 'calc(100% - 50px)', overflowY: 'auto', padding: 0 }}>
            <ScannerComponent forceShow={true} isEmbed={true} />
          </div>
        </DraggableResizeWrapper>
      )}
    </React.Fragment>
  );
});

export default Scanner;
