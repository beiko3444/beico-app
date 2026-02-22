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
        { label: '계산서 발급완료', key: 'INVOICED' },
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
        <div className="w-full bg-white rounded-[1.2rem] border border-[#e43f29] py-4 px-6 flex justify-between items-center relative mb-4">
            {steps.map((step, index) => {
                const reached = isStepReached(step.key);
                const isCurrent = step.key === currentStepKey;
                const isPast = reached && !isCurrent;

                return (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center z-10 w-12 bg-white">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center relative mb-1.5 bg-white">
                                {isPast ? (
                                    <div className="w-8 h-8 bg-[#e43f29] rounded-full flex items-center justify-center shadow-sm">
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : isCurrent ? (
                                    <div className="w-8 h-8 rounded-full border-[1.5px] border-[#e43f29] flex items-center justify-center bg-white shadow-sm">
                                        <div className="w-3.5 h-3.5 bg-[#e43f29] rounded-full" />
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-[1.5px] border-gray-200 bg-white shadow-sm" />
                                )}
                            </div>
                            <span className={`text-[9px] font-bold tracking-tight ${isCurrent || isPast ? 'text-[#e43f29]' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`flex-1 h-[1.5px] min-w-[20px] -mt-5 transition-colors ${isStepReached(steps[index + 1].key) ? 'bg-[#e43f29]' : 'bg-gray-100'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
