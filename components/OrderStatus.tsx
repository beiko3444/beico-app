import React from 'react';

type OrderStatusProps = {
    status: string;
    trackingNumber?: string | null;
    taxInvoiceIssued?: boolean;
};

export default function OrderStatus({ status, trackingNumber, taxInvoiceIssued }: OrderStatusProps) {
    // Define the steps
    const steps = [
        { label: '주문완료', key: 'ORDERED' },
        { label: '입금대기', key: 'PENDING_DEPOSIT' },
        { label: '입금완료', key: 'DEPOSIT_COMPLETED' },
        { label: '출고완료', key: 'SHIPPED' },
        { label: '계산서발행완료', key: 'INVOICE_ISSUED' },
    ];

    // Determine reached steps (for bolding)
    const isStepReached = (stepKey: string) => {
        switch (stepKey) {
            case 'ORDERED': return true;
            case 'PENDING_DEPOSIT': return true;
            case 'DEPOSIT_COMPLETED':
                return status === 'DEPOSIT_COMPLETED' || status === 'SHIPPED' || status === 'INVOICE_ISSUED' || !!trackingNumber || taxInvoiceIssued;
            case 'SHIPPED':
                return !!trackingNumber || taxInvoiceIssued || status === 'SHIPPED';
            case 'INVOICE_ISSUED':
                return !!taxInvoiceIssued;
            default: return false;
        }
    };

    // Determine specific 'current' step (for red dot)
    const getCurrentStepKey = () => {
        if (taxInvoiceIssued) return 'INVOICE_ISSUED';
        if (trackingNumber || status === 'SHIPPED') return 'SHIPPED';
        if (status === 'DEPOSIT_COMPLETED') return 'DEPOSIT_COMPLETED';
        if (status === 'PENDING' || status === 'PENDING_DEPOSIT') return 'PENDING_DEPOSIT';
        return 'ORDERED';
    };

    const currentStepKey = getCurrentStepKey();

    return (
        <div className="flex items-start justify-end gap-1 text-[11px] select-none flex-wrap w-full">
            {steps.map((step, index) => {
                const reached = isStepReached(step.key);
                const isCurrent = step.key === currentStepKey;

                return (
                    <div key={step.key} className="flex items-center">
                        <div className="flex flex-col items-center min-w-[50px] relative">
                            {/* Red Dot (Positioned above the label) */}
                            <div className="absolute -top-2.5 flex flex-col items-center">
                                {isCurrent && (
                                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_6px_rgba(220,38,38,0.8)]" />
                                )}
                            </div>

                            <span className={`transition-colors duration-200 ${reached ? 'text-black font-black' : 'text-gray-400 font-normal underline-offset-4'}`}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <span className="mx-1 text-gray-300 font-light mt-[1px]">
                                &gt;
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
