import React from 'react';

type OrderStatusProps = {
    status: string;
    trackingNumber?: string | null;
    taxInvoiceIssued?: boolean;
};

export default function OrderStatus({ status, trackingNumber, taxInvoiceIssued }: OrderStatusProps) {
    const steps = [
        { label: '주문접수', key: 'ORDERED' },
        { label: '입금대기', key: 'PENDING_DEPOSIT' },
        { label: '입금확인', key: 'DEPOSIT_COMPLETED' },
        { label: '발송완료', key: 'SHIPPED' },
        { label: '계산서', key: 'INVOICED' },
    ];

    const isStepReached = (stepKey: string) => {
        if (taxInvoiceIssued) return true;
        if (stepKey === 'INVOICED') return taxInvoiceIssued;
        if (trackingNumber || status === 'SHIPPED') return stepKey !== 'INVOICED';
        if (status === 'DEPOSIT_COMPLETED') return ['ORDERED', 'PENDING_DEPOSIT', 'DEPOSIT_COMPLETED'].includes(stepKey);
        if (status === 'PENDING' || status === 'APPROVED') return ['ORDERED', 'PENDING_DEPOSIT'].includes(stepKey);
        return stepKey === 'ORDERED';
    };

    const getCurrentStepKey = () => {
        if (taxInvoiceIssued) return 'INVOICED';
        if (trackingNumber || status === 'SHIPPED') return 'SHIPPED';
        if (status === 'DEPOSIT_COMPLETED') return 'DEPOSIT_COMPLETED';
        if (status === 'PENDING' || status === 'APPROVED') return 'PENDING_DEPOSIT';
        return 'ORDERED';
    };

    const currentStepKey = getCurrentStepKey();

    return (
        <div className="w-full flex justify-between items-center relative py-1">
            {steps.map((step, index) => {
                const reached = isStepReached(step.key);
                const isCurrent = step.key === currentStepKey;
                const isPast = reached && !isCurrent;

                return (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center z-10 w-10">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center mb-1 bg-white">
                                {isPast ? (
                                    <div className="w-6 h-6 bg-[#d9361b] rounded-full flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : isCurrent ? (
                                    <div className="w-6 h-6 rounded-full border-2 border-[#d9361b] flex items-center justify-center bg-white">
                                        <div className="w-2 h-2 bg-[#d9361b] rounded-full" />
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full border-[1.5px] border-gray-200 bg-white" />
                                )}
                            </div>
                            <span className={`text-[8px] font-bold whitespace-nowrap ${isCurrent ? 'text-[#d9361b]' : isPast ? 'text-gray-500' : 'text-gray-300'}`}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-[1.5px] -mt-4 ${isStepReached(steps[index + 1].key) ? 'bg-[#d9361b]' : 'bg-gray-200'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
