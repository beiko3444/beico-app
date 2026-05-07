export type RemittanceProgressStage = {
    percent: number
    label: string
}

const REMITTANCE_STEP_HINTS: Array<{ keys: string[]; stage: RemittanceProgressStage }> = [
    { keys: ['runtime:'], stage: { percent: 5, label: '브라우저 런타임을 준비하는 중...' } },
    { keys: ['open-login-page'], stage: { percent: 12, label: '모인 로그인 페이지에 접속하는 중...' } },
    { keys: ['fill-login-id', 'fill-login-password'], stage: { percent: 20, label: '로그인 계정 정보를 입력하는 중...' } },
    { keys: ['submit-login', 'post-login-url'], stage: { percent: 28, label: '로그인을 제출하고 확인하는 중...' } },
    { keys: ['recipient-search-prefill', 'company-text-visible', 'company-scroll-miss', 'nav-to-recipient', 'already-on-recipient-page'], stage: { percent: 36, label: '수취인/거래처를 찾는 중...' } },
    { keys: ['clicked-company-text', 'js-card-click'], stage: { percent: 42, label: '수취인 카드를 클릭하는 중...' } },
    { keys: ['modal-opened', 'remit-btn'], stage: { percent: 48, label: '수취인 정보 팝업이 열렸습니다...' } },
    { keys: ['clicked-remit-btn', 'clicked-remit-text'], stage: { percent: 54, label: '송금하기 버튼을 클릭하는 중...' } },
    { keys: ['step2-amount-form-loaded'], stage: { percent: 60, label: '금액 입력 화면이 로드되었습니다...' } },
    { keys: ['fill-usd-amount', 'next-after-amount'], stage: { percent: 68, label: '송금 금액을 입력하는 중...' } },
    { keys: ['upload-invoice', 'next-after-upload'], stage: { percent: 78, label: '인보이스 PDF를 업로드하는 중...' } },
    { keys: ['check-agreement'], stage: { percent: 88, label: '약관 동의 및 제출 준비 중...' } },
    { keys: ['stopped-before-final-confirmation', 'prepare-only-final-candidates'], stage: { percent: 94, label: '최종 송금 확인 직전까지 준비 완료...' } },
    { keys: ['submit-remittance'], stage: { percent: 96, label: '최종 송금 신청 중...' } },
]

export const resolveRemittanceStageFromStep = (stepLike: string | null | undefined): RemittanceProgressStage | null => {
    if (!stepLike) return null
    const normalized = stepLike.trim().toLowerCase()
    if (!normalized) return null

    for (const hint of REMITTANCE_STEP_HINTS) {
        if (hint.keys.some((key) => normalized.includes(key.toLowerCase()))) {
            return hint.stage
        }
    }

    return null
}

export const extractLatestAutomationStep = (message: string): string | null => {
    const stepsMatch = message.match(/\[steps:\s*([^\]]+)\]/i)
    if (!stepsMatch || !stepsMatch[1]) return null
    const parts = stepsMatch[1]
        .split(/\s*(?:->|→)\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : null
}
