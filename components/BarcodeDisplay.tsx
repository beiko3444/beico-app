'use client';

import { Component, ReactNode, useRef } from 'react';
import Barcode from 'react-barcode';

class BarcodeErrorBoundary extends Component<
    { fallback: ReactNode; children: ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

export default function BarcodeDisplay({
    value,
    width = 1,
    height = 30,
    fontSize = 10,
    displayValue = true,
    showDownload = true,
    buttonClassName = "",
    containerClassName = ""
}: {
    value: string | number | null | undefined;
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    showDownload?: boolean;
    buttonClassName?: string;
    containerClassName?: string;
}) {
    const barcodeRef = useRef<HTMLDivElement>(null);
    const safeValue = value === null || value === undefined ? "" : String(value).trim();

    if (!safeValue) return <span className="text-gray-400">-</span>;

    const fallback = (
        <span className="max-w-[160px] truncate text-[10px] font-bold text-gray-400" title={safeValue}>
            {safeValue}
        </span>
    );

    if (!/^[\x00-\x7F]+$/.test(safeValue)) {
        return fallback;
    }

    const downloadPNG = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!barcodeRef.current) return;

        const svg = barcodeRef.current.querySelector('svg');
        if (!svg) return;

        // Serialize SVG
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Scale up for better quality
            const scale = 2;
            canvas.width = (svg.clientWidth || 200) * scale;
            canvas.height = (svg.clientHeight || 100) * scale;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0);

                const pngUrl = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.href = pngUrl;
                downloadLink.download = `barcode-${safeValue}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    const downloadSVG = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!barcodeRef.current) return;

        const svg = barcodeRef.current.querySelector('svg');
        if (!svg) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svg);
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `barcode-${safeValue}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={`flex items-center group ${containerClassName}`}>
            <div className="flex flex-col items-start">
                <div ref={barcodeRef}>
                    <BarcodeErrorBoundary key={safeValue} fallback={fallback}>
                        <Barcode
                            value={safeValue}
                            format="CODE128"
                            width={width}
                            height={height}
                            fontSize={fontSize}
                            displayValue={displayValue}
                            margin={0}
                            background="transparent"
                        />
                    </BarcodeErrorBoundary>
                </div>
            </div>
            {showDownload && (
                <div className="flex flex-row gap-1 ml-2">
                    <button
                        onClick={downloadPNG}
                        className={buttonClassName || "text-[10px] text-gray-500 hover:text-[var(--color-brand-blue)] flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 bg-white shadow-sm hover:bg-gray-50 transition-colors"}
                        title="Download PNG"
                    >
                        PNG
                    </button>
                    <button
                        onClick={downloadSVG}
                        className={buttonClassName || "text-[10px] text-gray-500 hover:text-[var(--color-brand-blue)] flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 bg-white shadow-sm hover:bg-gray-50 transition-colors"}
                        title="Download SVG"
                    >
                        SVG
                    </button>
                </div>
            )}
        </div>
    );
}
