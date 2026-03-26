import React from 'react';

type OrderStatusProps = {
    status: string;
    trackingNumber?: string | null;
    taxInvoiceIssued?: boolean;
};

export default function OrderStatus({ status, trackingNumber, taxInvoiceIssued }: OrderStatusProps) {
    const steps = [
        { label: '주문접수', key: 'ORDERED', icon: '📋' },
        { label: '입금대기', key: 'PENDING_DEPOSIT', icon: '⏳' },
        { label: '입금확인', key: 'DEPOSIT_COMPLETED', icon: '✓' },
        { label: '발송완료', key: 'SHIPPED', icon: '🚛' },
        { label: '계산서', key: 'INVOICED', icon: '📄' },
    ];

    const isStepReached = (stepKey: string) => {
        if (taxInvoiceIssued) return true;
        if (stepKey === 'INVOICED') return taxInvoiceIssued;

        if (trackingNumber || status === 'SHIPPED') {
            return stepKey !== 'INVOICED';
        }

        if (status === 'DEPOSIT_COMPLETED') {
            return ['ORDERED', 'PENDING_DEPOSIT', 'DEPOSIT_COMPLETED'].includes(stepKey);
        }

        if (status === 'PENDING' || status === 'APPROVED') {
            return ['ORDERED', 'PENDING_DEPOSIT'].includes(stepKey);
        }

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
        <div className="w-full flex justify-between items-center relative">
            {/* Background line */}
            <div className="absolute left-4 right-4 top-[14px] h-[2px] bg-white/10 z-0" />
            <div
                className="absolute left-4 top-[14px] h-[2px] bg-[#e43f29] z-0 transition-all duration-500"
                style={{
                    width: `${(steps.findIndex(s => s.key === currentStepKey) / (steps.length - 1)) * (100 - 8)}%`,
                }}
            />

            {steps.map((step) => {
                const reached = isStepReached(step.key);
                const isCurrent = step.key === currentStepKey;
                const isPast = reached && !isCurrent;

                return (
                    <div key={step.key} className="flex flex-col items-center z-10 w-12">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center relative mb-1">
                            {isPast ? (
                                <div className="w-7 h-7 bg-[#e43f29] rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(228,63,41,0.4)]">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                            ) : isCurrent ? (
                                <div className="w-7 h-7 rounded-full border-2 border-[#e43f29] flex items-center justify-center bg-[#1a1d23]">
                                    <div className="w-2.5 h-2.5 bg-[#e43f29] rounded-full animate-pulse" />
                                </div>
                            ) : (
                                <div className="w-7 h-7 rounded-full border-[1.5px] border-white/20 bg-[#1a1d23]" />
                            )}
                        </div>
                        <span className={`text-[8px] font-bold tracking-tight whitespace-nowrap ${isCurrent ? 'text-[#e43f29]' : isPast ? 'text-gray-400' : 'text-gray-600'}`}>
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
