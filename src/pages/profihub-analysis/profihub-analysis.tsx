import React from 'react';
import IframeWrapper from '@/components/iframe-wrapper';

const ProfihubAnalysis: React.FC = () => {
    return (
        <IframeWrapper
            src='https://analysisprofithub.vercel.app/'
            title='Profihub'
            className='profihub-analysis-container'
        />
    );
};

export default ProfihubAnalysis;
