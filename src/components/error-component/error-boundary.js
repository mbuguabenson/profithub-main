import React from 'react';
import PropTypes from 'prop-types';
import ErrorComponent from './index';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    componentDidCatch = (error, info) => {
        console.error('[ErrorBoundary caught error]:', error, info);

        const errorMessage = String(error?.message || error || '');
        const isChunkLoadError =
            error?.name === 'ChunkLoadError' ||
            /Loading chunk .* failed/i.test(errorMessage) ||
            /Failed to fetch dynamically imported module/i.test(errorMessage) ||
            /missing: https:\/\//i.test(errorMessage);

        if (isChunkLoadError) {
            const hasReloaded = sessionStorage.getItem('chunk_reload_attempted');
            if (!hasReloaded) {
                sessionStorage.setItem('chunk_reload_attempted', 'true');
                window.location.reload();
                return;
            }
        }

        this.setState({
            hasError: true,
            error,
            info,
        });
    };

    handleResetError = () => {
        sessionStorage.removeItem('chunk_reload_attempted');
        window.location.reload();
    };

    render = () => {
        if (this.state.hasError) {
            const errorMessage = String(this.state.error?.message || '');
            const isChunkError = /Loading chunk/i.test(errorMessage) || /missing:/i.test(errorMessage);

            return (
                <ErrorComponent
                    header={isChunkError ? 'New Update Available' : 'Application Error Encountered'}
                    message={
                        isChunkError
                            ? 'A new version of ProfitHub has been deployed. Please refresh to load the latest update.'
                            : this.state.error?.message || 'A temporary UI render error occurred.'
                    }
                    redirect_label={isChunkError ? 'Reload Application' : 'Try Recovering'}
                    redirectOnClick={this.handleResetError}
                    should_show_refresh={true}
                    should_redirect={false}
                />
            );
        }
        return this.props.children;
    };
}

ErrorBoundary.propTypes = {
    root_store: PropTypes.object,
    children: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

export default ErrorBoundary;
