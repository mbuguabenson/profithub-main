import React from 'react';
import { observer } from 'mobx-react-lite';
import App from './App';
import './smart-analysis.scss';

export const SmartAnalysisPage: React.FC = observer(() => {
    return <App />;
});

export default SmartAnalysisPage;
