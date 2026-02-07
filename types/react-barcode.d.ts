declare module 'react-barcode' {
    import React from 'react';

    export interface BarcodeProps {
        value: string;
        renderer?: 'canvas' | 'img' | 'svg';
        width?: number;
        height?: number;
        format?: 'CODE128' | 'CODE128A' | 'CODE128B' | 'CODE128C' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39' | 'ITF14' | 'MSI' | 'pharmacode';
        displayValue?: boolean;
        fontOptions?: string;
        font?: string;
        textAlign?: string;
        textPosition?: string;
        textMargin?: number;
        fontSize?: number;
        background?: string;
        lineColor?: string;
        margin?: number;
        marginTop?: number;
        marginBottom?: number;
        marginLeft?: number;
        marginRight?: number;
        className?: string;
    }

    const Barcode: React.ComponentType<BarcodeProps>;
    export default Barcode;
}