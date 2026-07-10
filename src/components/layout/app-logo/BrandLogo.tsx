type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({ width, height = 32, className = '' }: TBrandLogoProps) => {
    return (
        <img
            src='/logo.png'
            alt='Ultimate Protool Logo'
            style={{ width: width ? `${width}px` : 'auto', height: `${height}px`, display: 'block' }}
            className={className}
        />
    );
};
