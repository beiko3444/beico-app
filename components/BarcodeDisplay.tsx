'use client';

import { useRef } from 'react';
import Barcode from 'react-barcode';

export default function BarcodeDisplay({
    value,
    width = 1,
    height = 30,
    fontSize = 10,
    displayValue = true,
    showDownload = true
}: {
    value: string;
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    showDownload?: boolean;
}) {
    const barcodeRef = useRef<HTMLDivElement>(null);

    if (!value) return <span className="text-gray-400">-</span>;

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
                downloadLink.download = `barcode-${value}.png`;
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
        downloadLink.download = `barcode-${value}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col items-center group">
            <div ref={barcodeRef}>
                <Barcode
                    value={value}
                    format="CODE128"
                    width={width}
                    height={height}
                    fontSize={fontSize}
                    displayValue={displayValue}
                    margin={0}
                    background="transparent"
                />
            </div>
            {showDownload && (
                <div className="flex gap-1 mt-1">
                    <button
                        onClick={downloadPNG}
                        className="text-[10px] text-gray-500 hover:text-[var(--color-brand-blue)] flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 bg-white shadow-sm hover:bg-gray-50 transition-colors"
                        title="Download PNG"
                    >
                        PNG
                    </button>
                    <button
                        onClick={downloadSVG}
                        className="text-[10px] text-gray-500 hover:text-[var(--color-brand-blue)] flex items-center gap-1 border border-gray-200 rounded px-1.5 py-0.5 bg-white shadow-sm hover:bg-gray-50 transition-colors"
                        title="Download SVG"
                    >
                        SVG
                    </button>
                </div>
            )}
        </div>
    );
}
