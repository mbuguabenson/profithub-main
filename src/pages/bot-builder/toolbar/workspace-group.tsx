import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import {
    LabelPairedArrowRotateLeftMdRegularIcon,
    LabelPairedArrowRotateRightMdRegularIcon,
    LabelPairedArrowsRotateMdRegularIcon,
    LabelPairedChartLineMdRegularIcon,
    LabelPairedChartTradingviewMdRegularIcon,
    LabelPairedFloppyDiskMdRegularIcon,
    LabelPairedFolderOpenMdRegularIcon,
    LabelPairedMagnifyingGlassMinusMdRegularIcon,
    LabelPairedMagnifyingGlassPlusMdRegularIcon,
    LabelPairedObjectsAlignLeftMdRegularIcon,
    LabelPairedSignalMdRegularIcon,
} from '@deriv/quill-icons/LabelPaired';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
/* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
/* [/AI] */
import ToolbarIcon from './toolbar-icon';

const WorkspaceGroup = observer(() => {
    const { dashboard, toolbar, load_modal, save_modal, scanner } = useStore();
    const { setPreviewOnPopup, setChartModalVisibility, setTradingViewModalVisibility, setProfihubModalVisibility } = dashboard;
    const { has_redo_stack, has_undo_stack, onResetClick, onSortClick, onUndoClick, onZoomInOutClick } = toolbar;
    const { toggleSaveModal } = save_modal;
    const { toggleLoadModal } = load_modal;
    const { setScannerVisibility } = scanner;
    const { isDesktop } = useDevice();

    return (
        <div className='toolbar__wrapper'>
            <div className='toolbar__group toolbar__group-btn' data-testid='dt_toolbar_group_btn'>
                <ToolbarIcon
                    popover_message={localize('Reset')}
                    icon={
                        <span
                            id='db-toolbar__reset-button'
                            className='toolbar__icon'
                            onClick={onResetClick}
                            data-testid='dt_toolbar_reset_button'
                        >
                            <LabelPairedArrowsRotateMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Import')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__import-button'
                            data-testid='dt_toolbar_import_button'
                            onClick={() => {
                                setPreviewOnPopup(true);
                                toggleLoadModal();
                                /* [AI] - Analytics event tracking removed - see migrate-docs/MONITORING_PACKAGES.md for re-implementation guide */
                                /* [/AI] */
                            }}
                        >
                            <LabelPairedFolderOpenMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Save')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__save-button'
                            data-testid='dt_toolbar_save_button'
                            onClick={toggleSaveModal}
                        >
                            <LabelPairedFloppyDiskMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Sort blocks')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__sort-button'
                            data-testid='dt_toolbar_sort_button'
                            onClick={onSortClick}
                        >
                            <LabelPairedObjectsAlignLeftMdRegularIcon />
                        </span>
                    }
                />
                <>
                    <div className='vertical-divider' />
                    {isDesktop && (
                        <>
                            <ToolbarIcon
                                popover_message={localize('Charts')}
                                icon={
                                    <span
                                        className='toolbar__icon'
                                        id='db-toolbar__charts-button'
                                        onClick={() => setChartModalVisibility()}
                                    >
                                        <LabelPairedChartLineMdRegularIcon />
                                    </span>
                                }
                            />
                            <ToolbarIcon
                                popover_message={localize('TradingView Chart')}
                                icon={
                                    <span
                                        className='toolbar__icon'
                                        id='db-toolbar__tradingview-button'
                                        onClick={() => setTradingViewModalVisibility()}
                                    >
                                        <LabelPairedChartTradingviewMdRegularIcon />
                                    </span>
                                }
                            />
                            <ToolbarIcon
                                popover_message={localize('Analysis')}
                                icon={
                                    <span
                                        className='toolbar__icon'
                                        id='db-toolbar__analysis-button'
                                        onClick={() => setProfihubModalVisibility()}
                                    >
                                        <LabelPairedMagnifyingGlassPlusMdRegularIcon />
                                    </span>
                                }
                            />
                        </>
                    )}
                    <ToolbarIcon
                        popover_message={localize('AI Market Scanner')}
                        icon={
                            <span
                                className='toolbar__icon'
                                id='db-toolbar__scanner-button'
                                data-testid='dt_toolbar_scanner_button'
                                onClick={() => {
                                    console.log('SCANNER TOOLBAR BUTTON CLICKED!');
                                    setPreviewOnPopup(true);
                                    setScannerVisibility();
                                }}
                            >
                                <LabelPairedSignalMdRegularIcon />
                            </span>
                        }
                    />
                    <ToolbarIcon
                        popover_message={localize('Premium Signals')}
                        icon={
                            <span
                                className={classNames('toolbar__icon', {
                                    'toolbar__icon--active': dashboard.is_protool_assistant_visible,
                                })}
                                id='db-toolbar__protool-ai-button'
                                onClick={() => {
                                    dashboard.setProToolAssistantVisibility(!dashboard.is_protool_assistant_visible);
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', color: dashboard.is_protool_assistant_visible ? '#f5c542' : 'currentColor' }}>
                                    <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12c0-2.4 1-4.6 2.6-6.2" />
                                    <path d="M12 6a6 6 0 0 1 6 6c0 3.3-2.7 6-6 6s-6-2.7-6-6c0-1.4.5-2.8 1.4-3.8" />
                                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                                </svg>
                            </span>
                        }
                    />

                </>
                <div className='vertical-divider' />
                <ToolbarIcon
                    popover_message={localize('Undo')}
                    icon={
                        <span
                            className={classNames('toolbar__icon undo', {
                                'toolbar__icon--disabled': !has_undo_stack,
                            })}
                            id='db-toolbar__undo-button'
                            data-testid='dt_toolbar_undo_button'
                            onClick={() => onUndoClick(/* redo */ false)}
                        >
                            <LabelPairedArrowRotateLeftMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Redo')}
                    icon={
                        <span
                            className={classNames('toolbar__icon redo', {
                                'toolbar__icon--disabled': !has_redo_stack,
                            })}
                            id='db-toolbar__redo-button'
                            data-testid='dt_toolbar_redo_button'
                            onClick={() => onUndoClick(/* redo */ true)}
                        >
                            <LabelPairedArrowRotateRightMdRegularIcon />
                        </span>
                    }
                />
                <div className='vertical-divider' />
                <ToolbarIcon
                    popover_message={localize('Zoom in')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__zoom-in-button'
                            data-testid='dt_toolbar_zoom_in_button'
                            onClick={() => onZoomInOutClick(/* in */ true)}
                        >
                            <LabelPairedMagnifyingGlassPlusMdRegularIcon />
                        </span>
                    }
                />
                <ToolbarIcon
                    popover_message={localize('Zoom out')}
                    icon={
                        <span
                            className='toolbar__icon'
                            id='db-toolbar__zoom-out'
                            data-testid='dt_toolbar_zoom_out_button'
                            onClick={() => onZoomInOutClick(/* in */ false)}
                        >
                            <LabelPairedMagnifyingGlassMinusMdRegularIcon />
                        </span>
                    }
                />
            </div>
        </div>
    );
});

export default WorkspaceGroup;
