'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, FileText, Loader2, Mail, Minus, Package, Plus, ScanSearch, Search, Send, Sparkles, Trash2, X } from 'lucide-react'
import Tesseract from 'tesseract.js'

type WormSize = {
    id: string
    range: string
}

type WormTypeId = 'blue' | 'red'

type WormType = {
    id: WormTypeId
    label: string
    cardActiveClass: string
    cardActiveBorderClass: string
    cardTagClass: string
}

type AwbCandidate = {
    value: string
    score: number
    source: string
}

type WormEmailAttachment = {
    filename: string
    contentType: string
    size: number
    index: number
}

type WormEmailListItem = {
    uid: string
    subject: string
    date: string
    hasAttachments: boolean
    awbNumber: string | null
    matchedOrderId: string | null
    matchedOrderNumber: string | null
    matchedAt: string | null
    invoiceUnitPriceUsd: number | null
    invoiceTotalAmountUsd: number | null
    usdKrwRate: number | null
    invoiceUnitPriceKrw: number | null
    invoiceTotalAmountKrw: number | null
    invoiceExtractedAt: string | null
    invoiceSourceFile: string | null
    invoiceOcrError: string | null
}

type WormEmailDetail = {
    uid: string
    subject: string
    date: string
    text: string
    hasAttachments: boolean
    skmIndices: number[]
    attachments: WormEmailAttachment[]
    awbNumber: string | null
}

type WormEmailOfflineCache = {
    version: 1
    savedAt: string | null
    hasFetched: boolean
    emails: WormEmailListItem[]
    emailDetails: Record<string, WormEmailDetail>
    selectedEmailUid: string | null
}

type CustomsProgressResult = {
    blNo: string
    query: {
        kind: 'mblNo' | 'hblNo'
        blYy: string
    }
    tCnt: number
    ntceInfo: string
    summaryRecords: Array<Record<string, string>>
    detailRecords: Array<Record<string, string>>
}

type PipelineMode = 'AUTO' | 'SEMI' | 'MANUAL'
type PipelineRuntimeStatus = 'done' | 'active' | 'todo'
type PipelineFilter = 'all' | PipelineMode
type PipelineSectionTarget = 'order' | 'inbox' | 'docInbox' | 'remittance' | 'bankPayment' | 'notification' | 'customs' | 'shipping' | 'none'

type PipelineStepDefinition = {
    id: number
    title: string
    summary: string
    mode: PipelineMode
    owner: string
    details: string[]
    actionLabel: string
    target: PipelineSectionTarget
    warning?: string
}

type RemittanceProgressStage = {
    percent: number
    label: string
}

type RemittancePricingSummary = {
    finalReceiveAmount: string
    sendAmount: string
    totalFee: string
    exchangeRate: string
}

type WormOrderSnapshot = {
    id: string
    orderNumber: string
    receiveDate: string
}

type WormOrderListItem = {
    id: string
    orderNumber: string
    receiveDate: string
    status: string
    remittanceAppliedAt: string | null
    remittanceFinalReceiveAmountText: string | null
    remittanceSendAmountText: string | null
    remittanceTotalFeeText: string | null
    remittanceExchangeRateText: string | null
    awbNumber: string | null
    createdAt: string
    updatedAt: string
}

const PIPELINE_STEP_DEFINITIONS: PipelineStepDefinition[] = [
    {
        id: 1,
        title: '발주 메시지 생성 및 전송',
        summary: '사이즈/수량 기반 발주 메시지를 생성하고 전송을 승인합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['사이즈별 수량 입력', '발주 메시지 자동 생성', '복사 후 카카오/이메일 전송'],
        actionLabel: 'Worm Order 작성',
        target: 'order',
        warning: '전송 채널(API) 연동 시 완전 자동화로 확장 가능',
    },
    {
        id: 2,
        title: '마이클 인보이스 이메일 수신',
        summary: 'INBOX에서 관련 메일을 스캔하고 첨부파일을 확인합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['지정 발신자 메일 스캔', '첨부파일 인덱싱', '오프라인 캐시 복원'],
        actionLabel: 'Inbox 모니터',
        target: 'inbox',
    },
    {
        id: 3,
        title: '모인비즈니스 송금 신청',
        summary: '송금 금액과 인보이스 PDF를 이용해 모인 송금 신청 자동화를 실행합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['금액/인보이스 입력', '모인 BizPlus 자동 제출', '성공/실패 상태 기록'],
        actionLabel: 'Moin BizPlus 실행',
        target: 'remittance',
    },
    {
        id: 4,
        title: '실제 입금 처리',
        summary: '은행/앱에서 실제 송금을 완료하고 결과를 확인합니다.',
        mode: 'MANUAL',
        owner: '관리자',
        details: ['외부 결제 채널 접속', '실제 입금 수행', '입금 완료 확인'],
        actionLabel: '송금 정보 확인',
        target: 'bankPayment',
        warning: '은행 정책상 시스템 완전 자동화 불가',
    },
    {
        id: 5,
        title: '입금 완료 통보',
        summary: '입금 완료 후 거래처 통보를 자동으로 진행합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['완료 알림 메시지 생성', '이메일/메신저 전송', '전송 이력 보관'],
        actionLabel: '통보 메시지 복사',
        target: 'notification',
    },
    {
        id: 6,
        title: '선적 서류 수신 및 AWB OCR',
        summary: 'SKM 문서에서 AWB를 OCR로 추출하고 캐시에 저장합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['첨부 PDF OCR 분석', 'AWB 후보 점수화', 'DB 캐시 저장'],
        actionLabel: 'AWB 메일 조회',
        target: 'docInbox',
    },
    {
        id: 7,
        title: '유니패스 수입 통관 조회',
        summary: 'AWB/B-L 번호로 통관 진행 정보를 조회하고 개입 단계를 강조합니다.',
        mode: 'SEMI',
        owner: '관리자 / 관세사',
        details: ['MBL/HBL + 최근 3개년 자동 조회', '진행이력 개입 단계 강조', '처리주체 표시'],
        actionLabel: 'UNI-PASS 조회',
        target: 'customs',
    },
    {
        id: 8,
        title: '통관 승인 문서 수령',
        summary: '통관 완료 후 필요한 문서를 수령/정리합니다.',
        mode: 'MANUAL',
        owner: '관리자 / 관세사',
        details: ['통관 완료 확인', '문서 수령', '내부 공유'],
        actionLabel: '수동 처리',
        target: 'none',
    },
    {
        id: 9,
        title: '카고/관세사 문서 전달',
        summary: '필요 첨부파일을 지정 이메일로 전달합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['첨부파일 선택', '수신자 입력', '메일 전송 확인'],
        actionLabel: '수동 처리',
        target: 'none',
    },
    {
        id: 10,
        title: '창고료 청구 메일 수신',
        summary: '창고료 관련 메일을 감지하고 처리 대상을 표시합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['INBOX 메일 스캔', '청구 메일 식별', '후속 단계 알림'],
        actionLabel: '수동 처리',
        target: 'none',
    },
    {
        id: 11,
        title: '창고료 결제',
        summary: '청구 금액을 확인하고 결제를 완료합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['결제 대상 확인', '결제 링크 이동', '완료 체크'],
        actionLabel: '수동 결제',
        target: 'none',
    },
    {
        id: 12,
        title: '카고 현장 픽업',
        summary: '최종 현장 픽업을 수행하고 다음 사이클로 종료합니다.',
        mode: 'MANUAL',
        owner: '관리자',
        details: ['픽업 일정 확인', '현장 수령', '사이클 종료'],
        actionLabel: '수동 픽업',
        target: 'none',
    },
    {
        id: 13,
        title: '로젠 송장 출력',
        summary: '거래처 주문 정보로 로젠 택배 운송장을 자동 발행합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['로젠 물류 자동 로그인', '수하인/주소 자동 입력', '운송장 출력 및 송장번호 수신'],
        actionLabel: '송장 출력 실행',
        target: 'shipping',
    },
]

const REMITTANCE_SIMULATED_STAGES: RemittanceProgressStage[] = [
    { percent: 6, label: '브라우저 런타임을 준비하는 중...' },
    { percent: 14, label: '모인 로그인 페이지에 접속하는 중...' },
    { percent: 24, label: '로그인 계정 정보를 입력하는 중...' },
    { percent: 33, label: '로그인을 제출하고 확인하는 중...' },
    { percent: 44, label: '수취인/거래처를 찾는 중...' },
    { percent: 56, label: '송금 신청 화면으로 이동하는 중...' },
    { percent: 68, label: '송금 금액을 입력하는 중...' },
    { percent: 78, label: '인보이스 PDF를 업로드하는 중...' },
    { percent: 88, label: '약관 동의 및 최종 제출을 준비하는 중...' },
    { percent: 94, label: '모인 응답을 확인하는 중...' },
]
const CUSTOMS_PROGRESS_CLIENT_CACHE_TTL_MS = 10 * 60 * 1000

const REMITTANCE_STEP_HINTS: Array<{ keys: string[]; stage: RemittanceProgressStage }> = [
    { keys: ['runtime:'], stage: { percent: 5, label: '브라우저 런타임을 준비하는 중...' } },
    { keys: ['open-login-page'], stage: { percent: 12, label: '모인 로그인 페이지에 접속하는 중...' } },
    { keys: ['fill-login-id', 'fill-login-password'], stage: { percent: 20, label: '로그인 계정 정보를 입력하는 중...' } },
    { keys: ['submit-login', 'post-login-url'], stage: { percent: 28, label: '로그인을 제출하고 확인하는 중...' } },
    { keys: ['company-text-visible', 'nav-to-recipient', 'already-on-recipient-page'], stage: { percent: 36, label: '수취인/거래처를 찾는 중...' } },
    { keys: ['clicked-company-text', 'js-card-click'], stage: { percent: 42, label: '수취인 카드를 클릭하는 중...' } },
    { keys: ['modal-opened', 'remit-btn'], stage: { percent: 48, label: '수취인 정보 팝업이 열렸습니다...' } },
    { keys: ['clicked-remit-btn', 'clicked-remit-text'], stage: { percent: 54, label: '송금하기 버튼을 클릭하는 중...' } },
    { keys: ['step2-amount-form-loaded'], stage: { percent: 60, label: '금액 입력 화면이 로드되었습니다...' } },
    { keys: ['fill-usd-amount', 'next-after-amount'], stage: { percent: 68, label: '송금 금액을 입력하는 중...' } },
    { keys: ['upload-invoice', 'next-after-upload'], stage: { percent: 78, label: '인보이스 PDF를 업로드하는 중...' } },
    { keys: ['check-agreement'], stage: { percent: 88, label: '약관 동의 및 제출 준비 중...' } },
    { keys: ['submit-remittance'], stage: { percent: 96, label: '최종 송금 신청 중...' } },
]

const resolveRemittanceStageFromStep = (stepLike: string | null | undefined): RemittanceProgressStage | null => {
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

const extractLatestAutomationStep = (message: string): string | null => {
    const stepsMatch = message.match(/\[steps:\s*([^\]]+)\]/i)
    if (!stepsMatch || !stepsMatch[1]) return null
    const parts = stepsMatch[1]
        .split('→')
        .map((part) => part.trim())
        .filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : null
}

function getPipelineModeBadgeClass(mode: PipelineMode) {
    if (mode === 'AUTO') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (mode === 'SEMI') return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-slate-200 text-slate-700 border-slate-300'
}

function getPipelineModeLabel(mode: PipelineMode) {
    if (mode === 'AUTO') return '완전자동'
    if (mode === 'SEMI') return '반자동'
    return '수동'
}

function getPipelineRuntimeBadgeClass(status: PipelineRuntimeStatus) {
    if (status === 'done') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'active') return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
}

function getPipelineRuntimeLabel(status: PipelineRuntimeStatus) {
    if (status === 'done') return '완료'
    if (status === 'active') return '진행중'
    return '대기'
}

function getWormOrderStatusLabel(status: string) {
    if (status === 'REMITTANCE_APPLIED') return '송금완료'
    if (status === 'DRAFT') return '작성중'
    return status
}

function getWormOrderStatusClass(status: string) {
    if (status === 'REMITTANCE_APPLIED') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'DRAFT') return 'bg-slate-100 text-slate-700 border-slate-200'
    return 'bg-amber-100 text-amber-800 border-amber-200'
}

const WORM_SIZES: WormSize[] = [
    { id: 'LLLL', range: '160-220 PCs/kilo' },
    { id: 'LLL', range: '240-280 PCs/kilo' },
    { id: 'LL', range: '300-340 PCs/kilo' },
    { id: 'L+', range: '360-400 PCs/kilo' },
    { id: 'L', range: '400-440 PCs/kilo' },
    { id: 'M', range: '440-500 PCs/kilo' },
    { id: 'MS', range: '500-540 PCs/kilo' },
    { id: 'S', range: '540-600 PCs/kilo' },
]

const WORM_TYPES: WormType[] = [
    {
        id: 'blue',
        label: '청갯지렁이',
        cardActiveClass: 'bg-sky-50',
        cardActiveBorderClass: 'border-sky-400',
        cardTagClass: 'bg-sky-100 text-sky-700',
    },
    {
        id: 'red',
        label: '홍갯지렁이',
        cardActiveClass: 'bg-red-50',
        cardActiveBorderClass: 'border-red-400',
        cardTagClass: 'bg-red-100 text-red-700',
    },
]

const WORM_TYPE_MESSAGE_LABELS: Record<WormTypeId, string> = {
    blue: 'Green lugworm',
    red: 'Red lugworm',
}

function createInitialQuantities() {
    return WORM_SIZES.reduce<Record<string, number>>((acc, size) => {
        acc[size.id] = 0
        return acc
    }, {})
}

function createInitialQuantitiesByType() {
    return WORM_TYPES.reduce<Record<WormTypeId, Record<string, number>>>((acc, type) => {
        acc[type.id] = createInitialQuantities()
        return acc
    }, {} as Record<WormTypeId, Record<string, number>>)
}

function formatYmdOrYmdHm(value?: string) {
    if (!value) return '-'
    if (/^\d{8}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    }
    if (/^\d{12,14}$/.test(value)) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)} ${value.slice(8, 10)}:${value.slice(10, 12)}`
    }
    return value
}

function parseYmdToLocalDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    const [yearText, monthText, dayText] = value.split('-')
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
    return new Date(year, month - 1, day)
}

function formatLocalDateToYmd(date: Date) {
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function buildMonthCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1)
    const firstWeekday = firstDay.getDay()
    const start = new Date(year, month, 1 - firstWeekday)
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        return {
            date,
            isCurrentMonth: date.getMonth() === month,
        }
    })
}

function normalizeCustomsStepText(...values: Array<string | undefined>) {
    return values.join(' ').replace(/\s+/g, '').trim()
}

function getAdminActionStep(row: Record<string, string>) {
    const importDeclaration = '\uC218\uC785\uC2E0\uACE0'
    const importAccepted = '\uC218\uC785\uC2E0\uACE0\uC218\uB9AC'
    const taxNotice = '\uACB0\uC7AC\uD1B5\uBCF4'
    const releaseDeclaration = '\uBC18\uCD9C\uC2E0\uACE0'
    const releaseAfterImport = '\uC218\uC785\uC2E0\uACE0\uC218\uB9AC\uD6C4\uBC18\uCD9C'

    const normalized = normalizeCustomsStepText(
        row.cargTrcnRelaBsopTpcd,
        row.rlbrCn,
    )

    if (normalized.includes(taxNotice)) {
        return {
            label: '\uAD00\uC138/\uBD80\uAC00\uC138 \uB0A9\uBD80 \uD544\uC694',
            owner: '\uAD00\uB9AC\uC790(\uC218\uC785\uC790) / \uAD00\uC138\uC0AC \uC120\uB0A9',
            rowClassName: 'bg-amber-50',
            badgeClassName: 'bg-amber-100 text-amber-800 border-amber-200',
        }
    }

    if (normalized.includes(releaseDeclaration) || normalized.includes(releaseAfterImport)) {
        return {
            label: '\uBC18\uCD9C/\uAD6D\uB0B4 \uC6B4\uC1A1 \uC870\uCE58 \uD544\uC694',
            owner: '\uAD00\uB9AC\uC790 / \uAD00\uC138\uC0AC / \uAD6D\uB0B4 \uC6B4\uC1A1\uC0AC',
            rowClassName: 'bg-sky-50',
            badgeClassName: 'bg-sky-100 text-sky-800 border-sky-200',
        }
    }

    if (normalized.includes(importDeclaration) && !normalized.includes(importAccepted)) {
        return {
            label: '\uD1B5\uAD00 \uC11C\uB958/\uC2E0\uACE0 \uC9C4\uD589 \uD544\uC694',
            owner: '\uAD00\uB9AC\uC790 / \uAD00\uC138\uC0AC',
            rowClassName: 'bg-yellow-50',
            badgeClassName: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        }
    }

    return null
}

const AWB_KEYWORD_REGEX = /\b(?:AIR\s*WAYBILL|WAYBILL|AWB|MAWB|HAWB)\b/i
const NON_AWB_CONTEXT_REGEX = /\b(?:TEL|PHONE|MOBILE|FAX|EMAIL|E-?MAIL|CONTACT|INVOICE|DATE|TOTAL|QTY|PCS|KILO)\b/i
const PHONE_LIKE_PREFIX_REGEX = /^(010|011|016|017|018|019|070|080)/
const WORM_EMAIL_CACHE_STORAGE_KEY = 'beico-worm-order-email-cache-v1'
const WORM_EMAIL_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

function sanitizeWormEmailListItem(value: unknown): WormEmailListItem | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailListItem>
    if (
        typeof candidate.uid !== 'string' ||
        typeof candidate.subject !== 'string' ||
        typeof candidate.date !== 'string' ||
        typeof candidate.hasAttachments !== 'boolean'
    ) {
        return null
    }

    return {
        uid: candidate.uid,
        subject: candidate.subject,
        date: candidate.date,
        hasAttachments: candidate.hasAttachments,
        awbNumber: typeof candidate.awbNumber === 'string' ? candidate.awbNumber : null,
        matchedOrderId: typeof candidate.matchedOrderId === 'string' ? candidate.matchedOrderId : null,
        matchedOrderNumber: typeof candidate.matchedOrderNumber === 'string' ? candidate.matchedOrderNumber : null,
        matchedAt: typeof candidate.matchedAt === 'string' ? candidate.matchedAt : null,
        invoiceUnitPriceUsd: typeof candidate.invoiceUnitPriceUsd === 'number' && Number.isFinite(candidate.invoiceUnitPriceUsd) ? candidate.invoiceUnitPriceUsd : null,
        invoiceTotalAmountUsd: typeof candidate.invoiceTotalAmountUsd === 'number' && Number.isFinite(candidate.invoiceTotalAmountUsd) ? candidate.invoiceTotalAmountUsd : null,
        usdKrwRate: typeof candidate.usdKrwRate === 'number' && Number.isFinite(candidate.usdKrwRate) ? candidate.usdKrwRate : null,
        invoiceUnitPriceKrw: typeof candidate.invoiceUnitPriceKrw === 'number' && Number.isFinite(candidate.invoiceUnitPriceKrw) ? candidate.invoiceUnitPriceKrw : null,
        invoiceTotalAmountKrw: typeof candidate.invoiceTotalAmountKrw === 'number' && Number.isFinite(candidate.invoiceTotalAmountKrw) ? candidate.invoiceTotalAmountKrw : null,
        invoiceExtractedAt: typeof candidate.invoiceExtractedAt === 'string' ? candidate.invoiceExtractedAt : null,
        invoiceSourceFile: typeof candidate.invoiceSourceFile === 'string' ? candidate.invoiceSourceFile : null,
        invoiceOcrError: typeof candidate.invoiceOcrError === 'string' ? candidate.invoiceOcrError : null,
    }
}

const usdAmountFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})

const krwAmountFormatter = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
})

function formatUsdAmount(value: number | null) {
    if (value === null || !Number.isFinite(value)) return '-'
    return usdAmountFormatter.format(value)
}

function formatKrwAmount(value: number | null) {
    if (value === null || !Number.isFinite(value)) return '-'
    return krwAmountFormatter.format(value)
}

function sanitizeWormEmailAttachment(value: unknown): WormEmailAttachment | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailAttachment>
    if (
        typeof candidate.filename !== 'string' ||
        typeof candidate.contentType !== 'string' ||
        typeof candidate.size !== 'number' ||
        typeof candidate.index !== 'number'
    ) {
        return null
    }

    return {
        filename: candidate.filename,
        contentType: candidate.contentType,
        size: candidate.size,
        index: candidate.index,
    }
}

function sanitizeWormEmailDetail(value: unknown): WormEmailDetail | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormEmailDetail>
    if (
        typeof candidate.uid !== 'string' ||
        typeof candidate.subject !== 'string' ||
        typeof candidate.date !== 'string' ||
        typeof candidate.text !== 'string' ||
        typeof candidate.hasAttachments !== 'boolean' ||
        !Array.isArray(candidate.skmIndices) ||
        !Array.isArray(candidate.attachments)
    ) {
        return null
    }

    const skmIndices = candidate.skmIndices.filter((index): index is number => typeof index === 'number')
    const attachments = candidate.attachments
        .map((attachment) => sanitizeWormEmailAttachment(attachment))
        .filter((attachment): attachment is WormEmailAttachment => attachment !== null)

    return {
        uid: candidate.uid,
        subject: candidate.subject,
        date: candidate.date,
        text: candidate.text,
        hasAttachments: candidate.hasAttachments,
        skmIndices,
        attachments,
        awbNumber: typeof candidate.awbNumber === 'string' ? candidate.awbNumber : null,
    }
}

function pruneEmailDetails(
    details: Record<string, WormEmailDetail>,
    emails: WormEmailListItem[],
) {
    const allowedUids = new Set(emails.map((email) => email.uid))
    return Object.fromEntries(
        Object.entries(details).filter(([uid]) => allowedUids.has(uid)),
    ) as Record<string, WormEmailDetail>
}

function compactEmailDetailsForCache(
    details: Record<string, WormEmailDetail>,
    emails: WormEmailListItem[],
) {
    const pruned = pruneEmailDetails(details, emails)
    return Object.fromEntries(
        Object.entries(pruned).map(([uid, detail]) => [
            uid,
            {
                ...detail,
                // Keep cache payload small; detail body is fetched on demand.
                text: '',
            } satisfies WormEmailDetail,
        ]),
    ) as Record<string, WormEmailDetail>
}

function readWormEmailOfflineCache(): WormEmailOfflineCache | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(WORM_EMAIL_CACHE_STORAGE_KEY)
        if (!raw) return null

        const parsed = JSON.parse(raw) as Partial<WormEmailOfflineCache> & {
            emails?: unknown[]
            emailDetails?: Record<string, unknown>
        }

        if (parsed.version !== 1) return null

        const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : null
        if (savedAt) {
            const savedAtMs = new Date(savedAt).getTime()
            if (Number.isFinite(savedAtMs) && Date.now() - savedAtMs > WORM_EMAIL_CACHE_MAX_AGE_MS) {
                window.localStorage.removeItem(WORM_EMAIL_CACHE_STORAGE_KEY)
                return null
            }
        }

        const emails = Array.isArray(parsed.emails)
            ? parsed.emails
                .map((email) => sanitizeWormEmailListItem(email))
                .filter((email): email is WormEmailListItem => email !== null)
            : []

        const rawDetails =
            parsed.emailDetails && typeof parsed.emailDetails === 'object'
                ? parsed.emailDetails
                : {}

        const emailDetails = Object.fromEntries(
            Object.entries(rawDetails)
                .map(([uid, detail]) => {
                    const sanitized = sanitizeWormEmailDetail(detail)
                    if (!sanitized || sanitized.uid !== uid) return null
                    return [uid, sanitized] as const
                })
                .filter((entry): entry is readonly [string, WormEmailDetail] => entry !== null),
        ) as Record<string, WormEmailDetail>

        const selectedEmailUid =
            typeof parsed.selectedEmailUid === 'string' && emails.some((email) => email.uid === parsed.selectedEmailUid)
                ? parsed.selectedEmailUid
                : emails[0]?.uid || null

        return {
            version: 1,
            savedAt,
            hasFetched: Boolean(parsed.hasFetched),
            emails,
            emailDetails: pruneEmailDetails(emailDetails, emails),
            selectedEmailUid,
        }
    } catch (error) {
        console.error('Failed to restore worm inbox cache', error)
        return null
    }
}

function writeWormEmailOfflineCache(cache: WormEmailOfflineCache) {
    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(WORM_EMAIL_CACHE_STORAGE_KEY, JSON.stringify(cache))
    } catch (error) {
        console.error('Failed to persist worm inbox cache', error)
    }
}

function sanitizeRemittancePricingSummary(value: unknown): RemittancePricingSummary | null {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<RemittancePricingSummary>
    if (
        typeof candidate.finalReceiveAmount !== 'string' ||
        typeof candidate.sendAmount !== 'string' ||
        typeof candidate.totalFee !== 'string' ||
        typeof candidate.exchangeRate !== 'string'
    ) {
        return null
    }

    const result: RemittancePricingSummary = {
        finalReceiveAmount: candidate.finalReceiveAmount.trim(),
        sendAmount: candidate.sendAmount.trim(),
        totalFee: candidate.totalFee.trim(),
        exchangeRate: candidate.exchangeRate.trim(),
    }

    if (!result.finalReceiveAmount && !result.sendAmount && !result.totalFee && !result.exchangeRate) {
        return null
    }

    return result
}

function sanitizeWormOrderListItem(value: unknown): WormOrderListItem | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Partial<WormOrderListItem>
    if (
        typeof candidate.id !== 'string' ||
        typeof candidate.orderNumber !== 'string' ||
        typeof candidate.receiveDate !== 'string' ||
        typeof candidate.status !== 'string' ||
        typeof candidate.createdAt !== 'string' ||
        typeof candidate.updatedAt !== 'string'
    ) {
        return null
    }

    return {
        id: candidate.id,
        orderNumber: candidate.orderNumber,
        receiveDate: candidate.receiveDate,
        status: candidate.status,
        remittanceAppliedAt: typeof candidate.remittanceAppliedAt === 'string' ? candidate.remittanceAppliedAt : null,
        remittanceFinalReceiveAmountText: typeof candidate.remittanceFinalReceiveAmountText === 'string' ? candidate.remittanceFinalReceiveAmountText : null,
        remittanceSendAmountText: typeof candidate.remittanceSendAmountText === 'string' ? candidate.remittanceSendAmountText : null,
        remittanceTotalFeeText: typeof candidate.remittanceTotalFeeText === 'string' ? candidate.remittanceTotalFeeText : null,
        remittanceExchangeRateText: typeof candidate.remittanceExchangeRateText === 'string' ? candidate.remittanceExchangeRateText : null,
        awbNumber: typeof candidate.awbNumber === 'string' ? candidate.awbNumber : null,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
    }
}

function toKstDateInputString(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)

    const year = parts.find((part) => part.type === 'year')?.value ?? ''
    const month = parts.find((part) => part.type === 'month')?.value ?? ''
    const day = parts.find((part) => part.type === 'day')?.value ?? ''
    return year && month && day ? `${year}-${month}-${day}` : ''
}

function normalizeOcrPatternText(input: string) {
    return input
        .toUpperCase()
        .replace(/[|IL]/g, '1')
        .replace(/[OQ]/g, '0')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
}

function normalizeOcrDigits(input: string) {
    return normalizeOcrPatternText(input).replace(/[^\d]/g, '')
}

function isValidAwbByCheckDigit(awb11: string) {
    if (!/^\d{11}$/.test(awb11)) return false
    const serial7 = parseInt(awb11.slice(3, 10), 10)
    const checkDigit = parseInt(awb11.slice(10), 10)
    if (!Number.isFinite(serial7) || !Number.isFinite(checkDigit)) return false
    return serial7 % 7 === checkDigit
}

function mergeAwbCandidate(map: Map<string, AwbCandidate>, candidate: AwbCandidate) {
    const prev = map.get(candidate.value)
    if (!prev || candidate.score > prev.score) {
        map.set(candidate.value, candidate)
    }
}

function createCanvasFromSource(source: HTMLCanvasElement) {
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0)
    return canvas
}

function createTopCropCanvas(source: HTMLCanvasElement, topRatio: number) {
    const cropHeight = Math.max(1, Math.floor(source.height * topRatio))
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = cropHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(source, 0, 0, source.width, cropHeight, 0, 0, source.width, cropHeight)
    return canvas
}

function applyBinaryThreshold(canvas: HTMLCanvasElement, threshold: number) {
    const ctx = canvas.getContext('2d')!
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data
    for (let i = 0; i < data.length; i += 4) {
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const color = brightness < threshold ? 0 : 255
        data[i] = color
        data[i + 1] = color
        data[i + 2] = color
    }
    ctx.putImageData(imgData, 0, 0)
}

function extractAwbCandidatesFromText(ocrText: string, source: string, trustBoost = 0): AwbCandidate[] {
    const lines = ocrText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)

    if (lines.length === 0) return []

    const byValue = new Map<string, AwbCandidate>()

    const addCandidate = (value: string, context: string, patternScore: number, lineIndex: number, sourceSuffix: string) => {
        const normalized = normalizeOcrDigits(value)
        if (normalized.length !== 11) return

        const upperContext = context.toUpperCase()
        const hasKeyword = AWB_KEYWORD_REGEX.test(upperContext)
        const checkDigitValid = isValidAwbByCheckDigit(normalized)

        let score = trustBoost + patternScore
        if (hasKeyword) score += 180
        if (lineIndex <= Math.max(1, Math.floor(lines.length * 0.4))) score += 35
        if (/^(112|180)/.test(normalized)) score += 20
        if (checkDigitValid) score += 420
        else score -= 180
        if (/^0/.test(normalized)) score -= 200
        if (PHONE_LIKE_PREFIX_REGEX.test(normalized)) score -= 260
        if (!hasKeyword && NON_AWB_CONTEXT_REGEX.test(upperContext)) score -= 70

        mergeAwbCandidate(byValue, {
            value: normalized,
            score,
            source: `${source} (${sourceSuffix})`,
        })
    }

    const addCandidatesFromChunk = (chunk: string, context: string, lineIndex: number, sourceSuffix: string) => {
        const upper = chunk.toUpperCase()
        const digitFriendly = normalizeOcrPatternText(upper)

        const airportRegex = /(?:^|[^\d])(\d{3})\s+[A-Z]{3}\s*(\d{4})\s*(\d{4})(?=[^\d]|$)/g
        let match: RegExpExecArray | null
        while ((match = airportRegex.exec(upper)) !== null) {
            addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 300, lineIndex, `${sourceSuffix}-airport`)
        }

        const groupedRegex = /(?:^|[^\d])(\d{3})[\s\-_.:/]*(\d{4})[\s\-_.:/]*(\d{4})(?=[^\d]|$)/g
        while ((match = groupedRegex.exec(digitFriendly)) !== null) {
            addCandidate(`${match[1]}${match[2]}${match[3]}`, context, 270, lineIndex, `${sourceSuffix}-grouped`)
        }

        // Common AWB display format: 123-12345675 (3 + 8 digits)
        const tripleEightRegex = /(?:^|[^\d])(\d{3})[\s\-_.:/]*(\d{8})(?=[^\d]|$)/g
        while ((match = tripleEightRegex.exec(digitFriendly)) !== null) {
            addCandidate(`${match[1]}${match[2]}`, context, 300, lineIndex, `${sourceSuffix}-3x8`)
        }

        const compactRegex = /(?:^|[^\d])(\d{11})(?=[^\d]|$)/g
        while ((match = compactRegex.exec(digitFriendly)) !== null) {
            addCandidate(match[1], context, 220, lineIndex, `${sourceSuffix}-compact`)
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || ''
        const prevLine = lines[i - 1] || ''
        const nextLine = lines[i + 1] || ''
        const merged = `${line} ${nextLine}`.trim()
        const context = `${prevLine} ${line} ${nextLine}`.trim()

        addCandidatesFromChunk(line, context, i + 1, 'line')
        if (nextLine) addCandidatesFromChunk(merged, context, i + 1, 'merged')
    }

    return Array.from(byValue.values()).sort((a, b) => b.score - a.score)
}

export default function WormOrderPage() {
    const today = new Date().toISOString().split('T')[0]
    const [quantitiesByType, setQuantitiesByType] = useState<Record<WormTypeId, Record<string, number>>>(createInitialQuantitiesByType)
    const [receiveDate, setReceiveDate] = useState(today)
    const [calendarCursor, setCalendarCursor] = useState(() => {
        const base = parseYmdToLocalDate(today) || new Date()
        return { year: base.getFullYear(), month: base.getMonth() }
    })
    const [generatedMessage, setGeneratedMessage] = useState('')
    const [validationError, setValidationError] = useState('')
    const [orderCreateError, setOrderCreateError] = useState('')
    const [orderCreateNotice, setOrderCreateNotice] = useState('')
    const [creatingOrder, setCreatingOrder] = useState(false)
    const [copied, setCopied] = useState(false)
    const [transferAmountUsd, setTransferAmountUsd] = useState('')
    const [invoicePdf, setInvoicePdf] = useState<File | null>(null)
    const [invoicePreviewUrl, setInvoicePreviewUrl] = useState('')
    const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false)
    const [invoicePreviewError, setInvoicePreviewError] = useState('')
    const [remittanceError, setRemittanceError] = useState('')
    const [remittanceSuccess, setRemittanceSuccess] = useState('')
    const [remittanceSubmitting, setRemittanceSubmitting] = useState(false)
    const [remittanceCancelling, setRemittanceCancelling] = useState(false)
    const [remittanceProgress, setRemittanceProgress] = useState(0)
    const [remittanceProgressLabel, setRemittanceProgressLabel] = useState('대기 중')
    const [remittanceAttemptsRemaining, setRemittanceAttemptsRemaining] = useState<number | null>(null)
    const [remittanceLockedUntil, setRemittanceLockedUntil] = useState<number | null>(null)
    const [remittanceLockTick, setRemittanceLockTick] = useState(0)
    const [remittancePricingSummary, setRemittancePricingSummary] = useState<RemittancePricingSummary | null>(null)
    const [remittanceSaveInfo, setRemittanceSaveInfo] = useState<{ orderNumber: string; savedAt: string } | null>(null)
    const [remittanceSaveWarning, setRemittanceSaveWarning] = useState('')
    const [paymentNotificationCopied, setPaymentNotificationCopied] = useState(false)
    const [activeWormOrder, setActiveWormOrder] = useState<WormOrderSnapshot | null>(null)
    const [wormOrderList, setWormOrderList] = useState<WormOrderListItem[]>([])
    const [wormOrderListLoading, setWormOrderListLoading] = useState(false)
    const [wormOrderListError, setWormOrderListError] = useState('')
    const [deletingWormOrderId, setDeletingWormOrderId] = useState<string | null>(null)
    const [blNumberQuery, setBlNumberQuery] = useState('')
    const [customsProgressResult, setCustomsProgressResult] = useState<CustomsProgressResult | null>(null)
    const [customsProgressError, setCustomsProgressError] = useState('')
    const [customsProgressLoading, setCustomsProgressLoading] = useState(false)
    const orderSectionRef = useRef<HTMLDivElement>(null)
    const inboxSectionRef = useRef<HTMLDivElement>(null)
    const docInboxSectionRef = useRef<HTMLDivElement>(null)
    const remittanceSectionRef = useRef<HTMLDivElement>(null)
    const bankPaymentSectionRef = useRef<HTMLDivElement>(null)
    const notificationSectionRef = useRef<HTMLDivElement>(null)
    const customsProgressSectionRef = useRef<HTMLDivElement>(null)
    const shippingSectionRef = useRef<HTMLDivElement>(null)
    const remittanceProgressTimerRef = useRef<number | null>(null)
    const remittanceRequestAbortControllerRef = useRef<AbortController | null>(null)
    const remittanceCancelRequestedRef = useRef(false)
    const invoicePreviewUrlRef = useRef<string | null>(null)
    const invoicePreviewTaskIdRef = useRef(0)
    const customsProgressCacheRef = useRef<Map<string, { savedAt: number; result: CustomsProgressResult | null; error: string }>>(new Map())

    const [emails, setEmails] = useState<WormEmailListItem[]>([])
    const [emailDetails, setEmailDetails] = useState<Record<string, WormEmailDetail>>({})
    const [loadingEmails, setLoadingEmails] = useState(false)
    const [matchingEmailUid, setMatchingEmailUid] = useState<string | null>(null)
    const [invoiceOcrRunningUid, setInvoiceOcrRunningUid] = useState<string | null>(null)
    const [emailMatchMessage, setEmailMatchMessage] = useState('')
    const [loadingEmailDetail, setLoadingEmailDetail] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [hasFetched, setHasFetched] = useState(false)
    const [selectedEmailUid, setSelectedEmailUid] = useState<string | null>(null)
    const [emailCacheSavedAt, setEmailCacheSavedAt] = useState<string | null>(null)
    const [usingOfflineEmailCache, setUsingOfflineEmailCache] = useState(false)
    const hasHydratedEmailCacheRef = useRef(false)
    const skipEmailCachePersistRef = useRef(false)

    // ── AWB Documents 메일 State ──
    const [docEmails, setDocEmails] = useState<WormEmailListItem[]>([])
    const [docEmailDetails, setDocEmailDetails] = useState<Record<string, WormEmailDetail>>({})
    const [loadingDocEmails, setLoadingDocEmails] = useState(false)
    const [docEmailError, setDocEmailError] = useState('')
    const [docHasFetched, setDocHasFetched] = useState(false)
    const [selectedDocEmailUid, setSelectedDocEmailUid] = useState<string | null>(null)
    const [docFetchProgress, setDocFetchProgress] = useState(0)
    const [loadingDocEmailDetail, setLoadingDocEmailDetail] = useState(false)
    const [matchingDocEmailUid, setMatchingDocEmailUid] = useState<string | null>(null)
    const [unmatchingDocEmailUid, setUnmatchingDocEmailUid] = useState<string | null>(null)
    const [docEmailMatchMessage, setDocEmailMatchMessage] = useState('')

    const persistEmailOfflineCache = useCallback(() => {
        if (!hasHydratedEmailCacheRef.current) return

        if (!hasFetched && emails.length === 0 && Object.keys(emailDetails).length === 0 && !selectedEmailUid) {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(WORM_EMAIL_CACHE_STORAGE_KEY)
            }
            return
        }

        const normalizedSelectedEmailUid =
            selectedEmailUid && emails.some((email) => email.uid === selectedEmailUid)
                ? selectedEmailUid
                : emails[0]?.uid || null

        writeWormEmailOfflineCache({
            version: 1,
            savedAt: emailCacheSavedAt,
            hasFetched,
            emails,
            emailDetails: compactEmailDetailsForCache(emailDetails, emails),
            selectedEmailUid: normalizedSelectedEmailUid,
        })
    }, [emailCacheSavedAt, emailDetails, emails, hasFetched, selectedEmailUid])

    useEffect(() => {
        const restoredCache = readWormEmailOfflineCache()
        hasHydratedEmailCacheRef.current = true

        if (!restoredCache) return

        skipEmailCachePersistRef.current = true
        setEmails(restoredCache.emails)
        setEmailDetails(restoredCache.emailDetails)
        setHasFetched(restoredCache.hasFetched)
        setSelectedEmailUid(restoredCache.selectedEmailUid)
        setEmailCacheSavedAt(restoredCache.savedAt)
        setUsingOfflineEmailCache(
            restoredCache.hasFetched &&
            (restoredCache.emails.length > 0 || Object.keys(restoredCache.emailDetails).length > 0),
        )
    }, [])

    useEffect(() => {
        if (!hasHydratedEmailCacheRef.current) return

        if (skipEmailCachePersistRef.current) {
            skipEmailCachePersistRef.current = false
            return
        }

        persistEmailOfflineCache()
    }, [persistEmailOfflineCache])

    const applyAwbNumberToEmailState = useCallback((uid: string, awb: string) => {
        const normalizedAwb = awb.replace(/\s+/g, '').trim()
        if (!uid || !normalizedAwb) return

        setEmails((prev) => prev.map((email) => (
            email.uid === uid
                ? { ...email, awbNumber: normalizedAwb }
                : email
        )))
        setEmailDetails((prev) => (
            prev[uid]
                ? {
                    ...prev,
                    [uid]: {
                        ...prev[uid],
                        awbNumber: normalizedAwb,
                    },
                }
                : prev
        ))
    }, [])

    const persistAwbCache = useCallback(async (
        uid: string,
        awb: string,
        emailMeta?: Pick<WormEmailDetail, 'subject' | 'date'> | null,
    ) => {
        const normalizedAwb = awb.replace(/\s+/g, '').trim()
        if (!uid || !normalizedAwb) return

        const fallbackEmail = emails.find((email) => email.uid === uid)
        applyAwbNumberToEmailState(uid, normalizedAwb)
        setEmailCacheSavedAt(new Date().toISOString())

        // 매칭된 발주가 있으면 로컬 발주 리스트에도 AWB 즉시 반영
        const matchedOrderId = fallbackEmail?.matchedOrderId
            || docEmails.find((e) => e.uid === uid)?.matchedOrderId
            || null
        if (matchedOrderId) {
            setWormOrderList((prev) => prev.map((order) =>
                order.id === matchedOrderId ? { ...order, awbNumber: normalizedAwb } : order
            ))
        }

        try {
            const response = await fetch('/api/admin/worm-order/emails/awb-cache', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid,
                    awbNumber: normalizedAwb,
                    subject: emailMeta?.subject || fallbackEmail?.subject || '',
                    date: emailMeta?.date || fallbackEmail?.date || '',
                }),
            })

            if (!response.ok) {
                const result = await response.json().catch(() => null)
                throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to save AWB cache.')
            }
        } catch (error) {
            console.warn('Failed to persist AWB cache:', error)
        }
    }, [applyAwbNumberToEmailState, emails, docEmails])

    // ── AWB OCR 관련 State ──
    const [awbNumber, setAwbNumber] = useState<string | null>(null)
    const [awbLoading, setAwbLoading] = useState(false)
    const [awbError, setAwbError] = useState('')
    const [awbCandidates, setAwbCandidates] = useState<AwbCandidate[]>([])

    // ── 관세사 메일 전달 관련 State ──
    const [forwardEmail, setForwardEmail] = useState('')
    const [forwarding, setForwarding] = useState(false)
    const [forwardError, setForwardError] = useState('')
    const [forwardSuccess, setForwardSuccess] = useState('')
    const [remittanceManuallyDone, setRemittanceManuallyDone] = useState(false)

    // ── 로젠 송장 출력 관련 State ──
    const [shippingRecipientPhone, setShippingRecipientPhone] = useState('')
    const [shippingRecipientName, setShippingRecipientName] = useState('')
    const [shippingRecipientAddress, setShippingRecipientAddress] = useState('')
    const [shippingRecipientDetailAddress, setShippingRecipientDetailAddress] = useState('')
    const [shippingSubmitting, setShippingSubmitting] = useState(false)
    const [shippingError, setShippingError] = useState('')
    const [shippingSuccess, setShippingSuccess] = useState('')
    const [shippingTrackingNumber, setShippingTrackingNumber] = useState('')
    const [shippingProgressLabel, setShippingProgressLabel] = useState('대기 중')

    const handleSubmitLogenShipping = useCallback(async () => {
        if (shippingSubmitting) return
        if (!shippingRecipientPhone || !shippingRecipientName || !shippingRecipientAddress) {
            setShippingError('수하인 전화번호, 이름, 주소를 모두 입력해주세요.')
            return
        }
        setShippingSubmitting(true)
        setShippingError('')
        setShippingSuccess('')
        setShippingTrackingNumber('')
        setShippingProgressLabel('로젠 자동화 시작...')
        try {
            const res = await fetch('/api/admin/worm-order/logen-shipping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipientPhone: shippingRecipientPhone,
                    recipientName: shippingRecipientName,
                    recipientAddress: shippingRecipientAddress,
                    recipientDetailAddress: shippingRecipientDetailAddress,
                }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(data?.error || '로젠 송장 출력 실패')
            }
            setShippingTrackingNumber(data.trackingNumber || '')
            setShippingSuccess(`운송장 발행 완료! 송장번호: ${data.trackingNumber || '-'}`)
            setShippingProgressLabel('완료')
        } catch (error) {
            setShippingError(error instanceof Error ? error.message : '로젠 송장 출력 중 오류가 발생했습니다.')
            setShippingProgressLabel('실패')
        } finally {
            setShippingSubmitting(false)
        }
    }, [shippingSubmitting, shippingRecipientPhone, shippingRecipientName, shippingRecipientAddress, shippingRecipientDetailAddress])

    const handleForwardEmail = async (uid: string) => {
        if (!forwardEmail) {
            setForwardError('받을 이메일 주소를 입력해주세요.')
            return
        }
        setForwarding(true)
        setForwardError('')
        setForwardSuccess('')

        try {
            const res = await fetch('/api/admin/worm-order/emails/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid, toEmail: forwardEmail })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '이메일 전달 실패')
            setForwardSuccess('메일과 첨부파일이 지정된 주소로 성공적으로 전달되었습니다.')
            setTimeout(() => setForwardSuccess(''), 5000)
            setForwardEmail('')
        } catch (err: any) {
            setForwardError(err.message)
        } finally {
            setForwarding(false)
        }
    }

    // ── 자동 페치 & 게이지 관련 State ──
    const [fetchProgress, setFetchProgress] = useState(0)
    const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>('all')
    const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>(() => (
        PIPELINE_STEP_DEFINITIONS.reduce<Record<number, boolean>>((acc, step) => {
            acc[step.id] = step.id <= 3
            return acc
        }, {})
    ))

    // ── 메일 선택 시 SKM 첨부파일 OCR 자동 실행 ──
    const ocrOnePdf = useCallback(async (uid: string, attIndex: number): Promise<AwbCandidate[]> => {
        const res = await fetch(`/api/admin/worm-order/emails/attachment?uid=${uid}&index=${attIndex}`)
        if (!res.ok) return []
        const blob = await res.blob()

        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        const byValue = new Map<string, AwbCandidate>()
        const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} })
        await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._:/ ',
        } as any)

        try {
            // 모든 페이지 시도 (최대 5페이지)
            const totalPages = pdf.numPages
            for (let pageNum = 1; pageNum <= Math.min(totalPages, 5); pageNum++) {
                const page = await pdf.getPage(pageNum)

                // 먼저 PDF 텍스트 레이어를 추출 시도 (가능한 경우 OCR보다 정확)
                try {
                    const textContent = await page.getTextContent()
                    const pageText = (textContent.items || [])
                        .map((item: any) => item?.str || '')
                        .filter(Boolean)
                        .join('\n')
                    const textCandidates = extractAwbCandidatesFromText(
                        pageText,
                        `file=${attIndex},page=${pageNum},text`,
                        130,
                    )
                    for (const c of textCandidates) {
                        mergeAwbCandidate(byValue, c)
                    }
                } catch (err) {
                    console.warn(`[AWB OCR] text-layer parse failed file=${attIndex},page=${pageNum}`, err)
                }

                const viewport = page.getViewport({ scale: 3.2 })
                const canvas = document.createElement('canvas')
                canvas.width = viewport.width
                canvas.height = viewport.height
                const ctx = canvas.getContext('2d')!
                await page.render({ canvasContext: ctx, viewport } as any).promise

                const fullRaw = canvas
                const fullBinary = createCanvasFromSource(canvas)
                applyBinaryThreshold(fullBinary, 165)
                const topRaw = createTopCropCanvas(canvas, 0.42)
                const topBinary = createCanvasFromSource(topRaw)
                applyBinaryThreshold(topBinary, 165)

                const variants: Array<{ name: string; canvas: HTMLCanvasElement; boost: number }> = [
                    { name: 'ocr-full-raw', canvas: fullRaw, boost: 30 },
                    { name: 'ocr-full-binary', canvas: fullBinary, boost: 60 },
                    { name: 'ocr-top-raw', canvas: topRaw, boost: 100 },
                    { name: 'ocr-top-binary', canvas: topBinary, boost: 140 },
                ]

                for (const variant of variants) {
                    const result = await worker.recognize(variant.canvas)
                    const ocrText = result.data.text || ''
                    console.log(`[AWB OCR] file=${attIndex}, page=${pageNum}, variant=${variant.name}`, ocrText)

                    const candidates = extractAwbCandidatesFromText(
                        ocrText,
                        `file=${attIndex},page=${pageNum},${variant.name}`,
                        variant.boost,
                    )
                    for (const c of candidates) {
                        mergeAwbCandidate(byValue, c)
                    }
                }
            }
        } finally {
            await worker.terminate()
        }

        return Array.from(byValue.values()).sort((a, b) => b.score - a.score)
    }, [])

    const runAwbOcr = useCallback(async (emailMeta: Pick<WormEmailDetail, 'uid' | 'subject' | 'date' | 'skmIndices'>) => {
        setAwbNumber(null)
        setAwbLoading(true)
        setAwbError('')
        setAwbCandidates([])
        try {
            const byValue = new Map<string, AwbCandidate>()

            // 모든 SKM 파일을 순차적으로 시도해서 점수가 가장 높은 후보를 채택
            for (const idx of emailMeta.skmIndices) {
                const foundList = await ocrOnePdf(emailMeta.uid, idx)
                for (const c of foundList) {
                    mergeAwbCandidate(byValue, c)
                }
            }

            const ranked = Array.from(byValue.values()).sort((a, b) => b.score - a.score)
            setAwbCandidates(ranked.slice(0, 6))

            if (ranked.length > 0) {
                const resolvedAwb = ranked[0].value
                setAwbNumber(resolvedAwb)
                await persistAwbCache(emailMeta.uid, resolvedAwb, emailMeta)
                if (ranked[0].score < 350) {
                    setAwbError('OCR 신뢰도가 낮습니다. 아래 대안 후보에서 번호를 직접 선택해주세요.')
                }
                return
            }

            setAwbError('모든 SKM 문서에서 운송장 번호를 찾지 못했습니다. 브라우저 콘솔(F12)에서 OCR 원문을 확인해주세요.')
        } catch (err: any) {
            console.error('AWB OCR Error:', err)
            setAwbError(err.message || 'OCR 처리 실패')
        } finally {
            setAwbLoading(false)
        }
    }, [ocrOnePdf, persistAwbCache])

    const fetchEmailDetail = useCallback(async (uid: string): Promise<WormEmailDetail | null> => {
        const cachedDetail = emailDetails[uid]
        if (cachedDetail && cachedDetail.text.trim().length > 0) {
            return cachedDetail
        }

        setLoadingEmailDetail(true)
        try {
            const res = await fetch(`/api/admin/worm-order/emails/detail?uid=${encodeURIComponent(uid)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '메일 상세 조회 실패')

            setEmailError('')
            setUsingOfflineEmailCache(false)
            setEmailCacheSavedAt(new Date().toISOString())
            setEmailDetails(prev => ({ ...prev, [uid]: data }))
            if (typeof data?.awbNumber === 'string' && data.awbNumber) {
                applyAwbNumberToEmailState(uid, data.awbNumber)
                if (uid === selectedEmailUid) {
                    setAwbNumber(data.awbNumber)
                }
            }
            return data
        } catch (err: any) {
            setEmailError(err.message || '메일 상세 조회 실패')
            return null
        } finally {
            setLoadingEmailDetail(false)
        }
    }, [applyAwbNumberToEmailState, emailDetails, selectedEmailUid])

    const handleRunSelectedAwbOcr = useCallback(async () => {
        if (!selectedEmailUid) return
        const detail = emailDetails[selectedEmailUid] || await fetchEmailDetail(selectedEmailUid)
        if (!detail) return
        if (!detail.skmIndices || detail.skmIndices.length === 0) {
            setAwbError('선택한 메일에 SKM 첨부파일이 없어 OCR을 실행할 수 없습니다.')
            return
        }
        runAwbOcr({
            uid: selectedEmailUid,
            subject: detail.subject,
            date: detail.date,
            skmIndices: detail.skmIndices,
        })
    }, [selectedEmailUid, emailDetails, fetchEmailDetail, runAwbOcr])

    useEffect(() => {
        if (!selectedEmailUid) return
        const selectedEmail = emails.find((email) => email.uid === selectedEmailUid)
        setAwbNumber(emailDetails[selectedEmailUid]?.awbNumber || selectedEmail?.awbNumber || null)
        setAwbCandidates([])
        setAwbLoading(false)
        setAwbError('')
        fetchEmailDetail(selectedEmailUid)
    }, [emails, emailDetails, selectedEmailUid, fetchEmailDetail])

    useEffect(() => {
        // fetchEmails() // Removed auto fetch
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!remittanceLockedUntil) return
        if (remittanceLockedUntil <= Date.now()) {
            setRemittanceLockedUntil(null)
            return
        }

        const timer = window.setInterval(() => {
            setRemittanceLockTick((prev) => prev + 1)
            if (remittanceLockedUntil <= Date.now()) {
                setRemittanceLockedUntil(null)
            }
        }, 1000)

        return () => window.clearInterval(timer)
    }, [remittanceLockedUntil])

    const replaceInvoicePreviewUrl = useCallback((nextUrl: string | null) => {
        if (invoicePreviewUrlRef.current) {
            URL.revokeObjectURL(invoicePreviewUrlRef.current)
            invoicePreviewUrlRef.current = null
        }

        if (!nextUrl) {
            setInvoicePreviewUrl('')
            return
        }

        invoicePreviewUrlRef.current = nextUrl
        setInvoicePreviewUrl(nextUrl)
    }, [])

    const buildInvoicePreview = useCallback(async (file: File | null) => {
        const taskId = ++invoicePreviewTaskIdRef.current
        setInvoicePreviewError('')

        if (!file) {
            setInvoicePreviewLoading(false)
            replaceInvoicePreviewUrl(null)
            return
        }

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        if (!isPdf) {
            setInvoicePreviewLoading(false)
            replaceInvoicePreviewUrl(null)
            setInvoicePreviewError('PDF 파일만 업로드할 수 있습니다.')
            return
        }

        setInvoicePreviewLoading(true)

        try {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            const page = await pdf.getPage(1)
            const viewport = page.getViewport({ scale: 1.45 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const canvasContext = canvas.getContext('2d')
            if (!canvasContext) {
                throw new Error('Canvas context unavailable')
            }

            await page.render({ canvasContext, viewport } as any).promise
            const previewBlob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('PDF preview blob generation failed'))
                        return
                    }
                    resolve(blob)
                }, 'image/png')
            })

            const nextPreviewUrl = URL.createObjectURL(previewBlob)
            if (invoicePreviewTaskIdRef.current !== taskId) {
                URL.revokeObjectURL(nextPreviewUrl)
                return
            }

            replaceInvoicePreviewUrl(nextPreviewUrl)
        } catch (error) {
            if (invoicePreviewTaskIdRef.current !== taskId) return
            replaceInvoicePreviewUrl(null)
            setInvoicePreviewError('인보이스 미리보기를 생성하지 못했습니다.')
            console.warn('Failed to build invoice preview:', error)
        } finally {
            if (invoicePreviewTaskIdRef.current === taskId) {
                setInvoicePreviewLoading(false)
            }
        }
    }, [replaceInvoicePreviewUrl])

    useEffect(() => {
        void buildInvoicePreview(invoicePdf)
    }, [buildInvoicePreview, invoicePdf])

    useEffect(() => {
        return () => {
            if (remittanceProgressTimerRef.current) {
                window.clearInterval(remittanceProgressTimerRef.current)
                remittanceProgressTimerRef.current = null
            }

            invoicePreviewTaskIdRef.current += 1
            if (invoicePreviewUrlRef.current) {
                URL.revokeObjectURL(invoicePreviewUrlRef.current)
                invoicePreviewUrlRef.current = null
            }
        }
    }, [])

    const fetchWormOrders = useCallback(async (options?: { silent?: boolean }) => {
        const silent = Boolean(options?.silent)
        if (!silent) {
            setWormOrderListLoading(true)
        }
        setWormOrderListError('')

        try {
            const response = await fetch('/api/admin/worm-order/orders?limit=40', {
                method: 'GET',
                cache: 'no-store',
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '발주 리스트를 불러오지 못했습니다.')
            }

            const nextList: WormOrderListItem[] = Array.isArray(result?.orders)
                ? result.orders
                    .map((item: unknown) => sanitizeWormOrderListItem(item))
                    .filter((item: WormOrderListItem | null): item is WormOrderListItem => item !== null)
                : []

            setWormOrderList(nextList)
            setActiveWormOrder((prev) => {
                if (prev) {
                    const matched = nextList.find((item) => item.id === prev.id)
                    if (matched) {
                        const receiveDateText = toKstDateInputString(matched.receiveDate) || prev.receiveDate
                        return {
                            id: matched.id,
                            orderNumber: matched.orderNumber,
                            receiveDate: receiveDateText,
                        }
                    }
                    return null
                }

                const latest = nextList[0]
                if (!latest) return null
                return {
                    id: latest.id,
                    orderNumber: latest.orderNumber,
                    receiveDate: toKstDateInputString(latest.receiveDate) || '',
                }
            })
        } catch (error) {
            setWormOrderListError(error instanceof Error ? error.message : '발주 리스트를 불러오지 못했습니다.')
        } finally {
            if (!silent) {
                setWormOrderListLoading(false)
            }
        }
    }, [])

    const handleSelectWormOrder = useCallback((order: WormOrderListItem) => {
        const receiveDateText = toKstDateInputString(order.receiveDate)
        const isSameOrder = activeWormOrder?.id === order.id

        setActiveWormOrder({
            id: order.id,
            orderNumber: order.orderNumber,
            receiveDate: receiveDateText || '',
        })
        if (receiveDateText) {
            setReceiveDate(receiveDateText)
        }

        // Keep already-fetched inbox state when user re-selects the same order.
        if (isSameOrder) return

        setEmails([])
        setEmailDetails({})
        setSelectedEmailUid(null)
        setHasFetched(false)
        setEmailError('')
        setEmailMatchMessage('')
    }, [activeWormOrder?.id])

    const handleDeleteWormOrder = useCallback(async (order: WormOrderListItem) => {
        const shouldDelete = window.confirm(`삭제할까요?\n${order.orderNumber}`)
        if (!shouldDelete) return

        setWormOrderListError('')
        setDeletingWormOrderId(order.id)
        try {
            const response = await fetch(`/api/admin/worm-order/orders?id=${encodeURIComponent(order.id)}`, {
                method: 'DELETE',
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '발주 삭제에 실패했습니다.')
            }

            setWormOrderList((prev) => prev.filter((item) => item.id !== order.id))
            setActiveWormOrder((prev) => (prev?.id === order.id ? null : prev))
        } catch (error) {
            setWormOrderListError(error instanceof Error ? error.message : '발주 삭제 중 오류가 발생했습니다.')
        } finally {
            setDeletingWormOrderId(null)
        }
    }, [])

    useEffect(() => {
        void fetchWormOrders()
    }, [fetchWormOrders])

    useEffect(() => {
        const selected = parseYmdToLocalDate(receiveDate)
        if (!selected) return
        setCalendarCursor({ year: selected.getFullYear(), month: selected.getMonth() })
    }, [receiveDate])

    const fetchEmails = async () => {
        setLoadingEmails(true)
        setEmailError('')
        setEmailMatchMessage('')
        setFetchProgress(0)

        // 가짜(Fake) 프로그레스 메이커 (로딩 중일 때 90%까지 꾸준히 증가)
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setFetchProgress(currentProgress)
        }, 400)

        try {
            const params = new URLSearchParams()
            params.set('subjectKeyword', 'invoice')
            if (activeWormOrder?.id) {
                params.set('orderId', activeWormOrder.id)
            }

            const res = await fetch(`/api/admin/worm-order/emails?${params.toString()}`)
            clearInterval(interval)
            setFetchProgress(100) // 100% 꽉 채우기

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch emails')
            
            const fetchedEmails: WormEmailListItem[] = Array.isArray(data.emails)
                ? data.emails
                    .map((email: unknown) => sanitizeWormEmailListItem(email))
                    .filter((email: WormEmailListItem | null): email is WormEmailListItem => email !== null)
                : []
            const nextSelectedEmailUid =
                selectedEmailUid && fetchedEmails.some((email) => email.uid === selectedEmailUid)
                    ? selectedEmailUid
                    : fetchedEmails[0]?.uid || null

            setEmails(fetchedEmails)
            setEmailDetails((prev) => pruneEmailDetails(prev, fetchedEmails))
            setSelectedEmailUid(nextSelectedEmailUid)
            setHasFetched(true)
            setUsingOfflineEmailCache(false)
            setEmailCacheSavedAt(new Date().toISOString())
            
            // 0.5초 뒤 게이지 숨김
            setTimeout(() => setFetchProgress(0), 500)
        } catch (err: any) {
            clearInterval(interval)
            setFetchProgress(0)
            const message = err.message || 'Failed to fetch emails'
            const hasCachedEmails = emails.length > 0 || Object.keys(emailDetails).length > 0
            setEmailError(hasCachedEmails ? `${message} Showing saved email cache.` : message)
            setHasFetched(true)
            setUsingOfflineEmailCache(hasCachedEmails)
        } finally {
            setLoadingEmails(false)
        }
    }

    const applyMatchResultToEmailState = useCallback((uid: string, fallbackOrder: WormOrderSnapshot, rawMatch: unknown) => {
        const matched = rawMatch as {
            orderNumber?: unknown
            matchedAt?: unknown
            invoiceUnitPriceUsd?: unknown
            invoiceTotalAmountUsd?: unknown
            usdKrwRate?: unknown
            invoiceUnitPriceKrw?: unknown
            invoiceTotalAmountKrw?: unknown
            invoiceExtractedAt?: unknown
            invoiceSourceFile?: unknown
            invoiceOcrError?: unknown
        } | null

        const toNullableNumber = (value: unknown) =>
            typeof value === 'number' && Number.isFinite(value) ? value : null

        const matchedOrderNumber =
            typeof matched?.orderNumber === 'string' && matched.orderNumber
                ? matched.orderNumber
                : fallbackOrder.orderNumber
        const matchedAt =
            typeof matched?.matchedAt === 'string' ? matched.matchedAt : new Date().toISOString()

        setEmails((prev) =>
            prev.map((item) =>
                item.uid === uid
                    ? {
                        ...item,
                        matchedOrderId: fallbackOrder.id,
                        matchedOrderNumber,
                        matchedAt,
                        invoiceUnitPriceUsd: toNullableNumber(matched?.invoiceUnitPriceUsd),
                        invoiceTotalAmountUsd: toNullableNumber(matched?.invoiceTotalAmountUsd),
                        usdKrwRate: toNullableNumber(matched?.usdKrwRate),
                        invoiceUnitPriceKrw: toNullableNumber(matched?.invoiceUnitPriceKrw),
                        invoiceTotalAmountKrw: toNullableNumber(matched?.invoiceTotalAmountKrw),
                        invoiceExtractedAt: typeof matched?.invoiceExtractedAt === 'string' ? matched.invoiceExtractedAt : null,
                        invoiceSourceFile: typeof matched?.invoiceSourceFile === 'string' ? matched.invoiceSourceFile : null,
                        invoiceOcrError: typeof matched?.invoiceOcrError === 'string' ? matched.invoiceOcrError : null,
                    }
                    : item,
            ),
        )
        setEmailCacheSavedAt(new Date().toISOString())
        return {
            matchedOrderNumber,
            ocrError: typeof matched?.invoiceOcrError === 'string' ? matched.invoiceOcrError : '',
        }
    }, [])

    const requestEmailMatchAndInvoiceOcr = useCallback(async (email: WormEmailListItem, targetOrder: WormOrderSnapshot) => {
        const response = await fetch('/api/admin/worm-order/emails/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: email.uid,
                orderId: targetOrder.id,
                subject: email.subject,
                date: email.date,
            }),
        })
        const raw = await response.text()
        const result = (() => {
            if (!raw) return null
            try {
                return JSON.parse(raw)
            } catch {
                return null
            }
        })()
        if (!response.ok) {
            const fallbackMessage = raw.trim() || `메일 매칭에 실패했습니다. (status ${response.status})`
            throw new Error(typeof result?.error === 'string' ? result.error : fallbackMessage)
        }
        return result
    }, [])

    const handleMatchEmailToActiveOrder = async (email: WormEmailListItem) => {
        if (!activeWormOrder?.id) {
            setEmailError('발주리스트에서 매칭할 발주를 먼저 선택해 주세요.')
            return
        }

        if (email.matchedOrderId === activeWormOrder.id) {
            setEmailMatchMessage(`이미 현재 발주(${activeWormOrder.orderNumber})에 매칭된 메일입니다.`)
            return
        }

        setMatchingEmailUid(email.uid)
        setEmailError('')
        setEmailMatchMessage('')
        try {
            const result = await requestEmailMatchAndInvoiceOcr(email, activeWormOrder)
            const { matchedOrderNumber, ocrError } = applyMatchResultToEmailState(email.uid, activeWormOrder, result?.match ?? null)

            if (ocrError) {
                setEmailMatchMessage(`메일 매칭 완료: ${matchedOrderNumber} (인보이스 OCR 경고: ${ocrError})`)
            } else {
                setEmailMatchMessage(`메일 매칭 완료: ${matchedOrderNumber}`)
            }
        } catch (error) {
            setEmailError(error instanceof Error ? error.message : '메일 매칭 중 오류가 발생했습니다.')
        } finally {
            setMatchingEmailUid(null)
        }
    }

    const handleRunInvoiceOcrForEmail = useCallback(async (email: WormEmailListItem) => {
        if (!activeWormOrder?.id) {
            setEmailError('발주리스트에서 매칭할 발주를 먼저 선택해 주세요.')
            return
        }

        const targetOrder: WormOrderSnapshot = {
            id: email.matchedOrderId || activeWormOrder.id,
            orderNumber: email.matchedOrderNumber || activeWormOrder.orderNumber,
            receiveDate: activeWormOrder.receiveDate,
        }

        setInvoiceOcrRunningUid(email.uid)
        setEmailError('')
        setEmailMatchMessage('')

        try {
            const result = await requestEmailMatchAndInvoiceOcr(email, targetOrder)
            const { matchedOrderNumber, ocrError } = applyMatchResultToEmailState(email.uid, targetOrder, result?.match ?? null)

            if (ocrError) {
                setEmailMatchMessage(`인보이스 OCR 재실행 완료: ${matchedOrderNumber} (경고: ${ocrError})`)
            } else {
                setEmailMatchMessage(`인보이스 OCR 재실행 완료: ${matchedOrderNumber}`)
            }
        } catch (error) {
            setEmailError(error instanceof Error ? error.message : '인보이스 OCR 실행 중 오류가 발생했습니다.')
        } finally {
            setInvoiceOcrRunningUid(null)
        }
    }, [activeWormOrder, applyMatchResultToEmailState, requestEmailMatchAndInvoiceOcr])

    // ── 매칭 해제 ──
    const [unmatchingEmailUid, setUnmatchingEmailUid] = useState<string | null>(null)
    const handleUnmatchEmail = async (email: WormEmailListItem) => {
        if (!email.matchedOrderId) return
        setUnmatchingEmailUid(email.uid)
        setEmailError('')
        setEmailMatchMessage('')
        try {
            const res = await fetch('/api/admin/worm-order/emails/unmatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: email.uid }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || '매칭 해제에 실패했습니다.')
            }
            setEmails((prev) =>
                prev.map((item) =>
                    item.uid === email.uid
                        ? {
                            ...item,
                            matchedOrderId: null,
                            matchedOrderNumber: null,
                            matchedAt: null,
                            invoiceUnitPriceUsd: null,
                            invoiceTotalAmountUsd: null,
                            usdKrwRate: null,
                            invoiceUnitPriceKrw: null,
                            invoiceTotalAmountKrw: null,
                            invoiceExtractedAt: null,
                            invoiceSourceFile: null,
                            invoiceOcrError: null,
                        }
                        : item,
                ),
            )
            setEmailCacheSavedAt(new Date().toISOString())
            setEmailMatchMessage(`매칭 해제 완료: ${email.matchedOrderNumber || email.uid}`)
        } catch (error) {
            setEmailError(error instanceof Error ? error.message : '매칭 해제 중 오류가 발생했습니다.')
        } finally {
            setUnmatchingEmailUid(null)
        }
    }

    // ── Document 메일 페치 ──
    const fetchDocumentEmails = async () => {
        setLoadingDocEmails(true)
        setDocEmailError('')
        setDocFetchProgress(0)

        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setDocFetchProgress(currentProgress)
        }, 400)

        try {
            const params = new URLSearchParams()
            params.set('subjectKeyword', 'documents,documets')
            if (activeWormOrder?.id) {
                params.set('orderId', activeWormOrder.id)
            }

            const res = await fetch(`/api/admin/worm-order/emails?${params.toString()}`)
            clearInterval(interval)
            setDocFetchProgress(100)

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch document emails')

            const fetchedEmails: WormEmailListItem[] = Array.isArray(data.emails)
                ? data.emails
                    .map((email: unknown) => sanitizeWormEmailListItem(email))
                    .filter((email: WormEmailListItem | null): email is WormEmailListItem => email !== null)
                : []
            const nextSelectedUid =
                selectedDocEmailUid && fetchedEmails.some((e) => e.uid === selectedDocEmailUid)
                    ? selectedDocEmailUid
                    : fetchedEmails[0]?.uid || null

            setDocEmails(fetchedEmails)
            setDocEmailDetails((prev) => pruneEmailDetails(prev, fetchedEmails))
            setSelectedDocEmailUid(nextSelectedUid)
            setDocHasFetched(true)
            setTimeout(() => setDocFetchProgress(0), 500)
        } catch (err: any) {
            clearInterval(interval)
            setDocFetchProgress(0)
            setDocEmailError(err.message || 'Failed to fetch document emails')
            setDocHasFetched(true)
        } finally {
            setLoadingDocEmails(false)
        }
    }

    // ── Document 메일 상세 조회 ──
    const fetchDocEmailDetail = useCallback(async (uid: string): Promise<WormEmailDetail | null> => {
        if (docEmailDetails[uid]) return docEmailDetails[uid]

        setLoadingDocEmailDetail(true)
        try {
            const res = await fetch(`/api/admin/worm-order/emails/detail?uid=${encodeURIComponent(uid)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '메일 상세 조회 실패')

            setDocEmailError('')
            setDocEmailDetails(prev => ({ ...prev, [uid]: data }))
            if (typeof data?.awbNumber === 'string' && data.awbNumber) {
                setDocEmails((prev) => prev.map((e) => e.uid === uid ? { ...e, awbNumber: data.awbNumber } : e))
                if (uid === selectedDocEmailUid) {
                    setAwbNumber(data.awbNumber)
                }
            }
            return data
        } catch (err: any) {
            setDocEmailError(err.message || '메일 상세 조회 실패')
            return null
        } finally {
            setLoadingDocEmailDetail(false)
        }
    }, [docEmailDetails, selectedDocEmailUid])

    // ── Document 메일 매칭/해제 ──
    const handleMatchDocEmailToOrder = async (email: WormEmailListItem) => {
        if (!activeWormOrder?.id) {
            setDocEmailError('발주리스트에서 매칭할 발주를 먼저 선택해 주세요.')
            return
        }
        if (email.matchedOrderId === activeWormOrder.id) {
            setDocEmailMatchMessage(`이미 현재 발주(${activeWormOrder.orderNumber})에 매칭된 메일입니다.`)
            return
        }
        setMatchingDocEmailUid(email.uid)
        setDocEmailError('')
        setDocEmailMatchMessage('')
        try {
            const res = await fetch('/api/admin/worm-order/emails/match', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: email.uid,
                    orderId: activeWormOrder.id,
                    subject: email.subject,
                    date: email.date,
                }),
            })
            const result = await res.json().catch(() => null)
            if (!res.ok) throw new Error(result?.error || '매칭에 실패했습니다.')
            setDocEmails(prev => prev.map(item =>
                item.uid === email.uid
                    ? { ...item, matchedOrderId: activeWormOrder.id, matchedOrderNumber: activeWormOrder.orderNumber, matchedAt: new Date().toISOString() }
                    : item
            ))
            setDocEmailMatchMessage(`매칭 완료: ${activeWormOrder.orderNumber}`)
        } catch (error) {
            setDocEmailError(error instanceof Error ? error.message : '매칭 중 오류가 발생했습니다.')
        } finally {
            setMatchingDocEmailUid(null)
        }
    }

    const handleUnmatchDocEmail = async (email: WormEmailListItem) => {
        if (!email.matchedOrderId) return
        setUnmatchingDocEmailUid(email.uid)
        setDocEmailError('')
        setDocEmailMatchMessage('')
        try {
            const res = await fetch('/api/admin/worm-order/emails/unmatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: email.uid }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || '매칭 해제에 실패했습니다.')
            }
            setDocEmails(prev => prev.map(item =>
                item.uid === email.uid
                    ? { ...item, matchedOrderId: null, matchedOrderNumber: null, matchedAt: null }
                    : item
            ))
            setDocEmailMatchMessage(`매칭 해제 완료: ${email.matchedOrderNumber || email.uid}`)
        } catch (error) {
            setDocEmailError(error instanceof Error ? error.message : '매칭 해제 중 오류가 발생했습니다.')
        } finally {
            setUnmatchingDocEmailUid(null)
        }
    }

    // ── Document 메일 선택 시 상세 자동 로드 ──
    useEffect(() => {
        if (!selectedDocEmailUid) return
        const selectedDoc = docEmails.find((e) => e.uid === selectedDocEmailUid)
        setAwbNumber(docEmailDetails[selectedDocEmailUid]?.awbNumber || selectedDoc?.awbNumber || null)
        setAwbCandidates([])
        setAwbLoading(false)
        setAwbError('')
        fetchDocEmailDetail(selectedDocEmailUid)
    }, [docEmails, docEmailDetails, selectedDocEmailUid, fetchDocEmailDetail])

    // ── Document 메일에서 AWB OCR 실행 ──
    const handleRunDocAwbOcr = useCallback(async () => {
        if (!selectedDocEmailUid) return
        const detail = docEmailDetails[selectedDocEmailUid] || await fetchDocEmailDetail(selectedDocEmailUid)
        if (!detail) return
        if (!detail.skmIndices || detail.skmIndices.length === 0) {
            setAwbError('선택한 메일에 SKM 첨부파일이 없어 OCR을 실행할 수 없습니다.')
            return
        }
        runAwbOcr({
            uid: selectedDocEmailUid,
            subject: detail.subject,
            date: detail.date,
            skmIndices: detail.skmIndices,
        })
    }, [selectedDocEmailUid, docEmailDetails, fetchDocEmailDetail, runAwbOcr])

    const selectedOrders = useMemo(() => {
        return WORM_TYPES.flatMap((wormType) =>
            WORM_SIZES
                .map((size) => ({
                    ...size,
                    wormTypeId: wormType.id,
                    wormTypeLabel: wormType.label,
                    boxes: quantitiesByType[wormType.id]?.[size.id] || 0,
                }))
                .filter((size) => size.boxes > 0)
        )
    }, [quantitiesByType])

    const totalBoxes = useMemo(() => {
        return selectedOrders.reduce((sum, item) => sum + item.boxes, 0)
    }, [selectedOrders])

    const todayDate = useMemo(() => {
        const parsed = parseYmdToLocalDate(today)
        const base = parsed || new Date()
        return new Date(base.getFullYear(), base.getMonth(), base.getDate())
    }, [today])

    const calendarDays = useMemo(
        () => buildMonthCalendarDays(calendarCursor.year, calendarCursor.month),
        [calendarCursor.month, calendarCursor.year],
    )

    const calendarMonthLabel = useMemo(() => {
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'long',
        }).format(new Date(calendarCursor.year, calendarCursor.month, 1))
    }, [calendarCursor.month, calendarCursor.year])

    const remittanceLockRemainingMs = useMemo(() => {
        if (!remittanceLockedUntil) return 0
        const remaining = remittanceLockedUntil - Date.now()
        return remaining > 0 ? remaining : 0
    }, [remittanceLockedUntil, remittanceLockTick])

    const remittanceLockRemainingText = useMemo(() => {
        if (remittanceLockRemainingMs <= 0) return ''
        const totalSeconds = Math.ceil(remittanceLockRemainingMs / 1000)
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${String(seconds).padStart(2, '0')}`
    }, [remittanceLockRemainingMs])

    const isRemittanceLocked = remittanceLockRemainingMs > 0
    const activeWormOrderRecord = useMemo(
        () => wormOrderList.find((order) => order.id === activeWormOrder?.id) || null,
        [activeWormOrder?.id, wormOrderList],
    )
    const isActiveOrderRemittanceApplied = Boolean(
        activeWormOrderRecord &&
        (activeWormOrderRecord.status === 'REMITTANCE_APPLIED' || activeWormOrderRecord.remittanceAppliedAt),
    )
    const activeOrderRemittanceAppliedAtText = activeWormOrderRecord?.remittanceAppliedAt
        ? new Date(activeWormOrderRecord.remittanceAppliedAt).toLocaleString()
        : ''

    // 현재 발주에 매칭된 인보이스 메일 자동 추출
    const matchedInvoiceEmail = useMemo(() => {
        if (!activeWormOrder?.id) return null
        return emails.find(e => e.matchedOrderId === activeWormOrder.id) || null
    }, [emails, activeWormOrder?.id])

    const autoTransferAmountUsd = matchedInvoiceEmail?.invoiceTotalAmountUsd ?? null

    // 현재 발주에 매칭된 AWB 메일에서 AWB 번호 자동 추출
    const matchedAwbEmail = useMemo(() => {
        if (!activeWormOrder?.id) return null
        return docEmails.find(e => e.matchedOrderId === activeWormOrder.id) || null
    }, [docEmails, activeWormOrder?.id])

    // DB에 저장된 AWB 번호 (메일 스캔 없이도 표시)
    const persistedAwbNumber = activeWormOrderRecord?.awbNumber ?? null
    const autoBlNumber = matchedAwbEmail?.awbNumber ?? persistedAwbNumber

    const handleQuantityChange = (wormTypeId: WormTypeId, sizeId: string, nextValue: number) => {
        setCopied(false)
        setQuantitiesByType((prev) => ({
            ...prev,
            [wormTypeId]: {
                ...prev[wormTypeId],
                [sizeId]: Math.max(0, nextValue),
            },
        }))
    }

    const handleGenerate = () => {
        setCopied(false)

        if (!receiveDate) {
            setValidationError('납품 예정일을 선택해주세요.')
            return
        }

        if (selectedOrders.length === 0) {
            setValidationError('최소 한 가지 사이즈의 수량을 입력해주세요.')
            return
        }

        setValidationError('')

        const receiveDateText = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
        }).format(new Date(`${receiveDate}T00:00:00`))

        const lines = selectedOrders
            .map((item) => {
                const boxLabel = item.boxes > 1 ? 'boxes' : 'box'
                const wormName = WORM_TYPE_MESSAGE_LABELS[item.wormTypeId] || item.wormTypeLabel
                return `- ${wormName} ${item.id} (${item.range}): ${item.boxes} ${boxLabel}`
            })
            .join('\n')

        const totalLabel = totalBoxes > 1 ? 'boxes' : 'box'

        const message = [
            'Hi Michael,',
            '',
            `Please send the following worm order to arrive by ${receiveDateText}.`,
            `Total requested: ${totalBoxes} ${totalLabel}.`,
            '',
            lines,
            '',
            'Please send the invoice to contact@beiko.co.kr',
            '',
            'Thanks.',
        ].join('\n')

        setGeneratedMessage(message)
    }

    const handleCopy = async () => {
        if (!generatedMessage) return

        try {
            await navigator.clipboard.writeText(generatedMessage)
            setCopied(true)
        } catch {
            setCopied(false)
            alert('복사에 실패했습니다. 메시지를 직접 복사해주세요.')
        }
    }

    const handleRemittanceApply = async () => {
        setRemittanceError('')
        setRemittanceSuccess('')
        setRemittanceCancelling(false)
        setRemittanceAttemptsRemaining(null)
        setRemittanceProgress(0)
        setRemittanceProgressLabel('대기 중')
        setRemittancePricingSummary(null)
        setRemittanceSaveInfo(null)
        setRemittanceSaveWarning('')
        remittanceCancelRequestedRef.current = false

        if (isRemittanceLocked) {
            setRemittanceError(`비밀번호 보호 잠금이 활성화되어 있습니다. ${remittanceLockRemainingText} 후 다시 시도해 주세요.`)
            return
        }

        if (!activeWormOrderRecord) {
            setRemittanceError('먼저 발주리스트에서 송금 신청할 발주를 선택해 주세요.')
            return
        }

        if (isActiveOrderRemittanceApplied) {
            setRemittanceError(`선택한 발주는 이미 송금 신청이 완료되었습니다. (${activeWormOrderRecord.orderNumber})`)
            return
        }

        if (!autoTransferAmountUsd || autoTransferAmountUsd <= 0) {
            setRemittanceError('매칭된 인보이스의 토탈어마운트가 없습니다. 인보이스 메일을 먼저 매칭해주세요.')
            return
        }
        const parsedAmount = autoTransferAmountUsd

        if (!matchedInvoiceEmail) {
            setRemittanceError('매칭된 인보이스 메일이 없습니다. 인보이스 메일을 먼저 매칭해주세요.')
            return
        }

        if (remittanceProgressTimerRef.current) {
            window.clearInterval(remittanceProgressTimerRef.current)
            remittanceProgressTimerRef.current = null
        }

        setRemittanceProgress(REMITTANCE_SIMULATED_STAGES[0]?.percent ?? 5)
        setRemittanceProgressLabel(REMITTANCE_SIMULATED_STAGES[0]?.label ?? '자동화 시작 중...')

        let simulatedStageIndex = 0
        remittanceProgressTimerRef.current = window.setInterval(() => {
            simulatedStageIndex = Math.min(simulatedStageIndex + 1, REMITTANCE_SIMULATED_STAGES.length - 1)
            const stage = REMITTANCE_SIMULATED_STAGES[simulatedStageIndex]
            setRemittanceProgress((prev) => Math.max(prev, stage.percent))
            setRemittanceProgressLabel(stage.label)
        }, 3500)

        let requestAbortController: AbortController | null = null
        setRemittanceSubmitting(true)
        try {
            requestAbortController = new AbortController()
            remittanceRequestAbortControllerRef.current = requestAbortController

            // 매칭된 인보이스 메일에서 PDF 첨부파일 자동 다운로드
            setRemittanceProgressLabel('인보이스 PDF 다운로드 중...')
            const matchedDetail = emailDetails[matchedInvoiceEmail.uid] || await fetchEmailDetail(matchedInvoiceEmail.uid)
            const pdfAtt = matchedDetail?.attachments?.find(att => {
                const name = att.filename.toLowerCase()
                const type = att.contentType.toLowerCase()
                return name.endsWith('.pdf') || type.includes('pdf')
            })
            if (!pdfAtt) {
                setRemittanceError('매칭된 인보이스 메일에 PDF 첨부파일이 없습니다.')
                if (remittanceProgressTimerRef.current) {
                    window.clearInterval(remittanceProgressTimerRef.current)
                    remittanceProgressTimerRef.current = null
                }
                setRemittanceSubmitting(false)
                return
            }
            const pdfRes = await fetch(`/api/admin/worm-order/emails/attachment?uid=${matchedInvoiceEmail.uid}&index=${pdfAtt.index}`)
            if (!pdfRes.ok) {
                setRemittanceError('인보이스 PDF 다운로드에 실패했습니다.')
                if (remittanceProgressTimerRef.current) {
                    window.clearInterval(remittanceProgressTimerRef.current)
                    remittanceProgressTimerRef.current = null
                }
                setRemittanceSubmitting(false)
                return
            }
            const pdfBlob = await pdfRes.blob()
            const invoicePdfFile = new File([pdfBlob], pdfAtt.filename, { type: 'application/pdf' })

            const submitData = new FormData()
            submitData.append('amountUsd', parsedAmount.toFixed(2))
            submitData.append('invoicePdf', invoicePdfFile)
            if (activeWormOrder?.id) {
                submitData.append('orderId', activeWormOrder.id)
            }
            if (receiveDate) {
                submitData.append('receiveDate', receiveDate)
            }

            const response = await fetch('/api/admin/worm-order/remittance', {
                method: 'POST',
                body: submitData,
                signal: requestAbortController.signal,
            })
            const result = await response.json()

            if (!response.ok) {
                if (typeof result?.attemptsRemaining === 'number') {
                    setRemittanceAttemptsRemaining(result.attemptsRemaining)
                }

                if (typeof result?.lockedUntil === 'string') {
                    const lockedUntilMs = Date.parse(result.lockedUntil)
                    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
                        setRemittanceLockedUntil(lockedUntilMs)
                    }
                }

                throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to submit remittance.')
            }

            const automationSteps = Array.isArray(result?.result?.steps) ? result.result.steps as string[] : []
            const lastAutomationStep = automationSteps.length > 0 ? automationSteps[automationSteps.length - 1] : null
            const resolvedStage = resolveRemittanceStageFromStep(lastAutomationStep)
            const pricingSummary = sanitizeRemittancePricingSummary(result?.result?.pricingSummary)
            const savedOrder = result?.savedOrder

            setRemittanceAttemptsRemaining(null)
            setRemittanceLockedUntil(null)
            setRemittanceSuccess('모인 BizPlus 송금 신청이 완료되었습니다.')
            setRemittanceProgress(100)
            setRemittanceProgressLabel(resolvedStage?.label || '송금 신청이 완료되었습니다.')
            setRemittancePricingSummary(pricingSummary)

            if (savedOrder?.orderNumber) {
                setRemittanceSaveInfo({
                    orderNumber: savedOrder.orderNumber,
                    savedAt: typeof savedOrder.remittanceAppliedAt === 'string'
                        ? savedOrder.remittanceAppliedAt
                        : new Date().toISOString(),
                })
            } else {
                setRemittanceSaveInfo(null)
            }

            setRemittanceSaveWarning(typeof result?.saveWarning === 'string' ? result.saveWarning : '')
            void fetchWormOrders({ silent: true })
        } catch (error) {
            const canceledByUser =
                remittanceCancelRequestedRef.current ||
                requestAbortController?.signal.aborted === true ||
                (error instanceof DOMException && error.name === 'AbortError') ||
                (error instanceof Error && /(cancel|canceled|cancelled|취소)/i.test(error.message))

            if (canceledByUser) {
                setRemittanceProgressLabel('사용자 취소')
                setRemittanceError('송금 신청이 취소되었습니다.')
                return
            }

            const message = error instanceof Error ? error.message : 'Failed to submit remittance.'
            const lower = message.toLowerCase()
            const latestStep = extractLatestAutomationStep(message)
            const resolvedStage = resolveRemittanceStageFromStep(latestStep)

            if (resolvedStage) {
                setRemittanceProgress((prev) => Math.max(prev, resolvedStage.percent))
                setRemittanceProgressLabel(`${resolvedStage.label} 단계에서 오류가 발생했습니다.`)
            } else {
                setRemittanceProgressLabel('진행 중 오류가 발생했습니다.')
            }

            const missingBrowserRuntime =
                lower.includes('no server browser runtime available') ||
                lower.includes('playwright_chromium_executable_path is not set') ||
                (lower.includes('cannot find module') && (lower.includes('playwright-core') || lower.includes('@sparticuz/chromium')))

            if (missingBrowserRuntime) {
                setRemittanceError(`${message} (Install deps and redeploy: npm install playwright-core @sparticuz/chromium)`)
            } else {
                setRemittanceError(message)
            }
        } finally {
            if (remittanceProgressTimerRef.current) {
                window.clearInterval(remittanceProgressTimerRef.current)
                remittanceProgressTimerRef.current = null
            }
            if (
                requestAbortController &&
                remittanceRequestAbortControllerRef.current === requestAbortController
            ) {
                remittanceRequestAbortControllerRef.current = null
            }
            remittanceCancelRequestedRef.current = false
            setRemittanceCancelling(false)
            setRemittanceSubmitting(false)
        }
    }

    const handleCancelRemittance = useCallback(async () => {
        if (!remittanceSubmitting) return

        remittanceCancelRequestedRef.current = true
        setRemittanceCancelling(true)
        setRemittanceSuccess('')
        setRemittanceProgressLabel('취소 요청 전송 중...')

        const activeController = remittanceRequestAbortControllerRef.current
        if (activeController && !activeController.signal.aborted) {
            activeController.abort()
        }

        try {
            const cancelUrl = activeWormOrder?.id
                ? `/api/admin/worm-order/remittance?orderId=${encodeURIComponent(activeWormOrder.id)}`
                : '/api/admin/worm-order/remittance'
            await fetch(cancelUrl, { method: 'DELETE' })
        } catch {
            // Ignore transport errors here; local abort already requested.
        }
    }, [activeWormOrder?.id, remittanceSubmitting])

    const handleCustomsProgressSearch = async (
        nextBlNo?: string,
        options?: { scrollIntoView?: boolean },
    ) => {
        const blNo = (nextBlNo ?? blNumberQuery).replace(/\s+/g, '').trim()
        const normalizedBlNo = blNo.toUpperCase()
        if (nextBlNo) {
            setBlNumberQuery(blNo)
        }

        if (options?.scrollIntoView) {
            customsProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        setCustomsProgressError('')
        setCustomsProgressResult(null)

        if (!blNo) {
            setCustomsProgressError('B/L 번호를 입력해주세요.')
            return
        }

        const cached = customsProgressCacheRef.current.get(normalizedBlNo)
        if (cached && Date.now() - cached.savedAt <= CUSTOMS_PROGRESS_CLIENT_CACHE_TTL_MS) {
            setCustomsProgressResult(cached.result)
            setCustomsProgressError(cached.error)
            return
        }

        setCustomsProgressLoading(true)
        try {
            const response = await fetch(`/api/admin/worm-order/customs-progress?blNo=${encodeURIComponent(blNo)}`, { method: 'GET' })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '화물통관 진행정보 조회에 실패했습니다.')
            }

            const parsed = result as CustomsProgressResult
            setCustomsProgressResult(parsed)
            customsProgressCacheRef.current.set(normalizedBlNo, {
                savedAt: Date.now(),
                result: parsed,
                error: '',
            })
        } catch (error) {
            const message = error instanceof Error ? error.message : '화물통관 진행정보 조회에 실패했습니다.'
            setCustomsProgressError(message)
            customsProgressCacheRef.current.set(normalizedBlNo, {
                savedAt: Date.now(),
                result: null,
                error: message,
            })
        } finally {
            setCustomsProgressLoading(false)
        }
    }

    const firstSummary = customsProgressResult?.summaryRecords?.[0] || null
    const detailRows = customsProgressResult?.detailRecords || []
    const selectedEmailFromList = useMemo(
        () => emails.find((email) => email.uid === selectedEmailUid) || null,
        [emails, selectedEmailUid],
    )
    const fallbackAwbCandidate = useMemo(
        () => awbNumber || selectedEmailFromList?.awbNumber || emails.find((email) => email.awbNumber)?.awbNumber || '',
        [awbNumber, emails, selectedEmailFromList],
    )
    const hasWarehouseMail = useMemo(
        () => emails.some((email) => /창고|warehouse|storage/i.test(email.subject)),
        [emails],
    )

    const pipelineStatusMap = useMemo<Record<number, PipelineRuntimeStatus>>(() => {
        const result: Record<number, PipelineRuntimeStatus> = {}
        for (const step of PIPELINE_STEP_DEFINITIONS) {
            result[step.id] = 'todo'
        }

        result[1] = generatedMessage.trim() ? 'done' : totalBoxes > 0 ? 'active' : 'todo'
        result[2] = hasFetched && emails.length > 0 ? 'done' : loadingEmails ? 'active' : 'todo'
        result[3] = remittanceSuccess
            ? 'done'
            : remittanceSubmitting || Boolean(transferAmountUsd.trim()) || Boolean(invoicePdf)
                ? 'active'
                : 'todo'
        result[4] = remittanceManuallyDone ? 'done' : result[3] === 'done' ? 'active' : 'todo'
        result[5] = paymentNotificationCopied ? 'done' : remittanceManuallyDone ? 'active' : 'todo'
        result[6] = fallbackAwbCandidate ? 'done' : awbLoading ? 'active' : 'todo'
        result[7] = customsProgressResult
            ? 'done'
            : customsProgressLoading || Boolean(blNumberQuery.trim())
                ? 'active'
                : 'todo'
        result[8] = detailRows.some((row) => {
            const normalized = normalizeCustomsStepText(row.cargTrcnRelaBsopTpcd, row.rlbrCn)
            return normalized.includes('\uC218\uC785\uC2E0\uACE0\uC218\uB9AC')
        })
            ? 'done'
            : 'todo'
        result[9] = forwardSuccess ? 'done' : 'todo'
        result[10] = hasWarehouseMail ? 'done' : hasFetched ? 'active' : 'todo'
        result[11] = 'todo'
        result[12] = 'todo'
        result[13] = shippingTrackingNumber ? 'done' : shippingSubmitting ? 'active' : 'todo'

        return result
    }, [
        awbLoading,
        blNumberQuery,
        customsProgressLoading,
        customsProgressResult,
        detailRows,
        emails,
        fallbackAwbCandidate,
        forwardSuccess,
        generatedMessage,
        hasFetched,
        hasWarehouseMail,
        invoicePdf,
        loadingEmails,
        paymentNotificationCopied,
        remittanceManuallyDone,
        remittanceSubmitting,
        remittanceSuccess,
        shippingSubmitting,
        shippingTrackingNumber,
        totalBoxes,
        transferAmountUsd,
    ])

    const pipelineModeCounts = useMemo(() => {
        return PIPELINE_STEP_DEFINITIONS.reduce<Record<PipelineMode, number>>((acc, step) => {
            acc[step.mode] += 1
            return acc
        }, { AUTO: 0, SEMI: 0, MANUAL: 0 })
    }, [])

    const doneStepCount = useMemo(
        () => Object.values(pipelineStatusMap).filter((status) => status === 'done').length,
        [pipelineStatusMap],
    )
    const activeStepId = useMemo(
        () => PIPELINE_STEP_DEFINITIONS.find((step) => pipelineStatusMap[step.id] !== 'done')?.id ?? 12,
        [pipelineStatusMap],
    )
    const filteredPipelineSteps = useMemo(
        () => PIPELINE_STEP_DEFINITIONS.filter((step) => pipelineFilter === 'all' || step.mode === pipelineFilter),
        [pipelineFilter],
    )
    const visibleStepIdSet = useMemo(
        () => new Set(filteredPipelineSteps.map((step) => step.id)),
        [filteredPipelineSteps],
    )

    const togglePipelineStep = useCallback((stepId: number) => {
        setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }))
    }, [])

    const scrollToPipelineSection = useCallback((target: PipelineSectionTarget) => {
        if (target === 'order') {
            orderSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'inbox') {
            inboxSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'remittance') {
            remittanceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'docInbox') {
            docInboxSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'notification') {
            notificationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'bankPayment') {
            bankPaymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'customs') {
            customsProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
        }
        if (target === 'shipping') {
            shippingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [])

    const handlePipelineStepAction = useCallback((step: PipelineStepDefinition) => {
        if (step.target !== 'none') {
            scrollToPipelineSection(step.target)
        }

        if (step.id === 1 && selectedOrders.length > 0 && !generatedMessage) {
            handleGenerate()
            return
        }

        if (step.id === 2 && !loadingEmails) {
            const shouldFetchInbox = !hasFetched || emails.length === 0
            if (shouldFetchInbox) {
                void fetchEmails()
            }
            return
        }

        if (step.id === 6 && !loadingDocEmails) {
            void fetchDocumentEmails()
            return
        }

        if (step.id === 7 && fallbackAwbCandidate) {
            void handleCustomsProgressSearch(fallbackAwbCandidate, { scrollIntoView: true })
        }
    }, [
        fallbackAwbCandidate,
        generatedMessage,
        handleCustomsProgressSearch,
        handleGenerate,
        loadingDocEmails,
        loadingEmails,
        hasFetched,
        emails.length,
        scrollToPipelineSection,
        selectedOrders.length,
    ])

    const handleStartNewOrder = useCallback(async () => {
        if (creatingOrder) return
        const targetReceiveDate = /^\d{4}-\d{2}-\d{2}$/.test(receiveDate) ? receiveDate : today

        setOrderCreateError('')
        setOrderCreateNotice('')
        setCreatingOrder(true)

        try {
            const response = await fetch('/api/admin/worm-order/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiveDate: targetReceiveDate }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '새 발주를 생성하지 못했습니다.')
            }

            setOrderCreateNotice(`새 발주 생성 완료 · ${result?.order?.orderNumber || 'WO 생성'} (${targetReceiveDate})`)
            if (result?.order?.id && result?.order?.orderNumber) {
                setActiveWormOrder({
                    id: result.order.id,
                    orderNumber: result.order.orderNumber,
                    receiveDate: targetReceiveDate,
                })
            }
            void fetchWormOrders({ silent: true })
        } catch (error) {
            setOrderCreateError(error instanceof Error ? error.message : '새 발주 생성 중 오류가 발생했습니다.')
            setCreatingOrder(false)
            return
        }

        setQuantitiesByType(createInitialQuantitiesByType())
        setReceiveDate(targetReceiveDate)
        setGeneratedMessage('')
        setValidationError('')
        setOrderCreateError('')
        setCopied(false)
        setTransferAmountUsd('')
        setInvoicePdf(null)
        setRemittanceError('')
        setRemittanceSuccess('')
        setRemittanceProgress(0)
        setRemittanceProgressLabel('대기 중')
        setRemittanceAttemptsRemaining(null)
        setRemittanceLockedUntil(null)
        setRemittancePricingSummary(null)
        setRemittanceSaveInfo(null)
        setRemittanceSaveWarning('')
        setBlNumberQuery('')
        setCustomsProgressResult(null)
        setCustomsProgressError('')
        setAwbNumber(null)
        setAwbCandidates([])
        setAwbError('')
        setForwardEmail('')
        setForwardError('')
        setForwardSuccess('')
        setDocEmails([])
        setDocEmailDetails({})
        setDocHasFetched(false)
        setSelectedDocEmailUid(null)
        setDocEmailError('')
        setDocEmailMatchMessage('')
        setPaymentNotificationCopied(false)
        setRemittanceManuallyDone(false)
        setShippingRecipientPhone('')
        setShippingRecipientName('')
        setShippingRecipientAddress('')
        setShippingRecipientDetailAddress('')
        setShippingError('')
        setShippingSuccess('')
        setShippingTrackingNumber('')
        setShippingProgressLabel('대기 중')
        setExpandedSteps(
            PIPELINE_STEP_DEFINITIONS.reduce<Record<number, boolean>>((acc, step) => {
                acc[step.id] = step.id <= 3
                return acc
            }, {}),
        )
        setCreatingOrder(false)
    }, [creatingOrder, fetchWormOrders, receiveDate, today])

    const showOrderTools = visibleStepIdSet.has(1)
    const showInboxTools = visibleStepIdSet.has(2)
    const showDocInboxTools = visibleStepIdSet.has(6)
    const showRemittanceTools = visibleStepIdSet.has(3)
    const showBankPaymentTools = visibleStepIdSet.has(4)
    const showNotificationTools = visibleStepIdSet.has(5)
    const showCustomsTools = visibleStepIdSet.has(7)
    const showShippingTools = visibleStepIdSet.has(13)
    const stepRenderOrderMap = useMemo(() => {
        const next = new Map<number, number>()
        filteredPipelineSteps.forEach((step, index) => {
            next.set(step.id, (index + 1) * 10)
        })
        return next
    }, [filteredPipelineSteps])
    const fallbackOrderBase = filteredPipelineSteps.length * 10 + 10
    const getAnchorOrderBase = useCallback((stepIds: number[], defaultStepId: number) => {
        for (const stepId of stepIds) {
            const mapped = stepRenderOrderMap.get(stepId)
            if (mapped) return mapped
        }
        return stepRenderOrderMap.get(defaultStepId) ?? fallbackOrderBase
    }, [fallbackOrderBase, stepRenderOrderMap])
    const orderToolOrderBase = getAnchorOrderBase([1], 1)
    const inboxToolOrderBase = getAnchorOrderBase([2], 2)
    const docInboxToolOrderBase = getAnchorOrderBase([6], 6)
    const remittanceToolOrderBase = getAnchorOrderBase([3], 3)
    const bankPaymentToolOrderBase = getAnchorOrderBase([4], 4)
    const notificationToolOrderBase = getAnchorOrderBase([5], 5)
    const customsToolOrderBase = getAnchorOrderBase([7], 7)
    const shippingToolOrderBase = getAnchorOrderBase([13], 13)

    return (
        <div className="max-w-5xl mx-auto pb-10 flex flex-col gap-6">
            <div className="rounded-3xl border border-[#f3ddd8] bg-gradient-to-br from-white via-[#fff8f6] to-[#fff3ef] p-5 md:p-7 shadow-[0_14px_34px_rgba(15,23,42,0.08)] text-slate-900">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">지렁이 수입 자동화 파이프라인</h1>
                        <p className="text-sm text-slate-600 font-medium">중국 → 한국 수입 전 과정을 단계별로 실행하고 추적합니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleStartNewOrder}
                        disabled={creatingOrder}
                        className="h-10 px-4 rounded-xl border border-[#e34219] bg-white hover:bg-[#fff3ef] text-sm font-bold text-[#e34219] inline-flex items-center gap-2 w-full md:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {creatingOrder ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                생성중...
                            </>
                        ) : (
                            '+ 새 발주 시작'
                        )}
                    </button>
                </div>

                {orderCreateNotice && (
                    <p className="mt-3 text-xs font-semibold text-emerald-700">
                        {orderCreateNotice}
                    </p>
                )}
                {orderCreateError && (
                    <p className="mt-3 text-xs font-semibold text-rose-600">
                        {orderCreateError}
                    </p>
                )}

                <div className="mt-4 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                        <div
                            className="h-full bg-[#e34219] rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((doneStepCount / PIPELINE_STEP_DEFINITIONS.length) * 100)}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 shrink-0">
                        {doneStepCount}/{PIPELINE_STEP_DEFINITIONS.length} 단계 완료
                    </span>
                </div>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 md:p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">발주 리스트</h2>
                        <p className="text-xs text-slate-500 mt-1">새 발주 생성 시 DB에 저장되며, 아래에서 바로 선택할 수 있습니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { void fetchWormOrders() }}
                        disabled={wormOrderListLoading}
                        className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                        {wormOrderListLoading && <Loader2 size={14} className="animate-spin" />}
                        리스트 새로고침
                    </button>
                </div>

                {wormOrderListError && (
                    <p className="mt-3 text-xs font-semibold text-red-600">{wormOrderListError}</p>
                )}

                <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600">
                                <th className="text-left px-3 py-2 font-bold">발주번호</th>
                                <th className="text-left px-3 py-2 font-bold">작성일</th>
                                <th className="text-left px-3 py-2 font-bold">상태</th>
                                <th className="text-left px-3 py-2 font-bold">최근수정</th>
                                <th className="text-right px-3 py-2 font-bold">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {wormOrderList.map((order) => {
                                const isActiveOrder = activeWormOrder?.id === order.id
                                const createdDateText = toKstDateInputString(order.createdAt)
                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => handleSelectWormOrder(order)}
                                        className={`border-t border-slate-100 cursor-pointer transition-colors ${
                                            isActiveOrder ? 'bg-[#fff3ef]' : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <td className="px-3 py-2.5 font-bold text-slate-900">{order.orderNumber}</td>
                                        <td className="px-3 py-2.5 text-slate-700">{createdDateText || '-'}</td>
                                        <td className="px-3 py-2.5">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex h-6 w-fit items-center rounded-md border px-2 text-xs font-bold ${getWormOrderStatusClass(order.status)}`}>
                                                    {getWormOrderStatusLabel(order.status)}
                                                </span>
                                                {order.remittanceAppliedAt && (
                                                    <span className="text-[11px] font-semibold text-emerald-700">
                                                        신청시각 {new Date(order.remittanceAppliedAt).toLocaleString()}
                                                        {order.remittanceSendAmountText ? ` / ${order.remittanceSendAmountText}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-500">
                                            {new Date(order.updatedAt).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    void handleDeleteWormOrder(order)
                                                }}
                                                disabled={deletingWormOrderId === order.id}
                                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                                aria-label={`${order.orderNumber} 삭제`}
                                            >
                                                {deletingWormOrderId === order.id ? (
                                                    <Loader2 size={13} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={13} />
                                                )}
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {!wormOrderListLoading && wormOrderList.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                                        저장된 발주가 없습니다. 상단의 `+ 새 발주 시작` 버튼으로 생성해 주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex flex-col gap-4">
                        {filteredPipelineSteps.map((step) => {
                            const runtimeStatus = pipelineStatusMap[step.id]
                            const isExpanded = expandedSteps[step.id] ?? false

                            return (
                                <section
                                    key={step.id}
                                    style={{ order: stepRenderOrderMap.get(step.id) ?? fallbackOrderBase }}
                                    className={`rounded-2xl border bg-white shadow-sm transition-colors ${
                                    runtimeStatus === 'done'
                                        ? 'border-emerald-200'
                                        : runtimeStatus === 'active'
                                            ? 'border-[#e34219]'
                                            : 'border-gray-200'
                                }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => togglePipelineStep(step.id)}
                                        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs font-black px-1.5 shrink-0 ${
                                                runtimeStatus === 'done'
                                                    ? 'bg-emerald-500 text-white'
                                                    : runtimeStatus === 'active'
                                                        ? 'bg-[#e34219] text-white'
                                                        : 'bg-slate-200 text-slate-600'
                                            }`}>
                                                {step.id}
                                            </span>
                                            <h2 className="text-sm font-bold text-slate-900 truncate">{step.title}</h2>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold ${getPipelineModeBadgeClass(step.mode)}`}>
                                                {getPipelineModeLabel(step.mode)}
                                            </span>
                                            <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold ${getPipelineRuntimeBadgeClass(runtimeStatus)}`}>
                                                {getPipelineRuntimeLabel(runtimeStatus)}
                                            </span>
                                            {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-gray-100 px-4 py-3 space-y-2.5">
                                            <p className="text-xs text-slate-500">
                                                <span className="font-semibold text-slate-600">처리주체</span> {step.owner}
                                                {step.warning && <span className="ml-2 text-orange-600">· {step.warning}</span>}
                                            </p>

                                            {step.target !== 'none' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handlePipelineStepAction(step)}
                                                    className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-[#e34219] text-white hover:bg-[#cd3b17]"
                                                >
                                                    {step.actionLabel}
                                                    <ArrowRight size={13} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </section>
                            )
                        })}
            {showOrderTools && (
                <div
                    ref={orderSectionRef}
                    style={{ order: orderToolOrderBase + 5 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 bg-[#fff7f3] flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-[#1f2937]">발주서 작성</h2>
                            <p className="text-xs text-slate-500 mt-0.5">사이즈별 수량을 입력하고 발주 메시지를 생성합니다.</p>
                        </div>
                        <Sparkles size={18} className="text-[#e34219]" />
                    </div>

                    <div className="p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
                        <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:p-5 flex flex-col">
                            <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em]">납품 예정일</p>

                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCalendarCursor((prev) => {
                                            const nextMonth = prev.month - 1
                                            if (nextMonth < 0) return { year: prev.year - 1, month: 11 }
                                            return { year: prev.year, month: nextMonth }
                                        })
                                    }
                                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center"
                                    aria-label="이전 달"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <p className="text-sm font-black text-slate-900">{calendarMonthLabel}</p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCalendarCursor((prev) => {
                                            const nextMonth = prev.month + 1
                                            if (nextMonth > 11) return { year: prev.year + 1, month: 0 }
                                            return { year: prev.year, month: nextMonth }
                                        })
                                    }
                                    className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 inline-flex items-center justify-center"
                                    aria-label="다음 달"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>

                            <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] font-bold text-slate-400 text-center">
                                {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
                                    <span key={weekday}>{weekday}</span>
                                ))}
                            </div>
                            <div className="mt-1 grid grid-cols-7 gap-1">
                                {calendarDays.map((dayCell) => {
                                    const ymd = formatLocalDateToYmd(dayCell.date)
                                    const isSelected = receiveDate === ymd
                                    const dayStart = new Date(
                                        dayCell.date.getFullYear(),
                                        dayCell.date.getMonth(),
                                        dayCell.date.getDate(),
                                    )
                                    const isPast = dayStart.getTime() < todayDate.getTime()
                                    return (
                                        <button
                                            key={ymd}
                                            type="button"
                                            onClick={() => {
                                                setCopied(false)
                                                setReceiveDate(ymd)
                                                setActiveWormOrder(null)
                                            }}
                                            disabled={isPast}
                                            className={`h-9 rounded-lg text-xs font-bold transition-colors ${
                                                isSelected
                                                    ? 'bg-[#e34219] text-white'
                                                    : dayCell.isCurrentMonth
                                                        ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                        : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                                            } ${isPast ? 'opacity-35 cursor-not-allowed' : ''}`}
                                        >
                                            {dayCell.date.getDate()}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                                선택된 납품 예정일: {receiveDate || '-'}
                            </div>

                            <div className="mt-auto pt-4">
                                <button
                                    type="button"
                                    onClick={handleGenerate}
                                    className="h-11 w-full bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide"
                                >
                                    발주 메시지 생성
                                </button>
                            </div>
                        </aside>

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                {WORM_TYPES.map((wormType) => (
                                    <section key={wormType.id} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-black ${wormType.cardTagClass}`}>
                                                {wormType.label}
                                            </span>
                                            <span className="text-xs text-gray-500 font-semibold">사이즈별 박스 수량 입력</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                                            {WORM_SIZES.map((size) => {
                                                const current = quantitiesByType[wormType.id]?.[size.id] || 0
                                                const isSelected = current > 0

                                                return (
                                                    <div
                                                        key={`${wormType.id}-${size.id}`}
                                                        className={`flex flex-col gap-2.5 justify-between border rounded-xl p-3.5 transition-all duration-200 ${
                                                            isSelected
                                                                ? `${wormType.cardActiveBorderClass} ${wormType.cardActiveClass} shadow-sm`
                                                                : 'border-gray-200 bg-white hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <div className="flex flex-col items-start gap-0.5 px-0.5">
                                                            <div className="text-[16px] font-black text-[#111827] leading-none">{size.id}</div>
                                                            <div className="text-[11px] tracking-tight text-gray-500 font-medium leading-none">{size.range}</div>
                                                        </div>

                                                        <div className="grid grid-cols-[36px_minmax(44px,1fr)_36px] items-center rounded-lg border border-gray-300 overflow-hidden w-full transition-colors bg-white">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(wormType.id, size.id, current - 1)}
                                                                className="h-[36px] flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                                                aria-label={`${wormType.label} ${size.id} decrease`}
                                                            >
                                                                <Minus size={15} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={current}
                                                                onChange={(event) => {
                                                                    const next = Number(event.target.value)
                                                                    handleQuantityChange(wormType.id, size.id, Number.isFinite(next) ? next : 0)
                                                                }}
                                                                className="h-[36px] min-w-[44px] px-1 text-center font-black tabular-nums text-[#111827] outline-none text-[15px]"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuantityChange(wormType.id, size.id, current + 1)}
                                                                className="h-[36px] flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                                                aria-label={`${wormType.label} ${size.id} increase`}
                                                            >
                                                                <Plus size={15} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>

                            {validationError && (
                                <p className="text-sm font-semibold text-[#e34219]">{validationError}</p>
                            )}
                        </div>

                        {generatedMessage && (
                            <div className="space-y-3">
                                <textarea
                                    readOnly
                                    value={generatedMessage}
                                    className="w-full h-52 border border-gray-300 rounded-xl p-4 text-sm leading-6 text-gray-800 bg-gray-50"
                                />
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="inline-flex items-center gap-2 h-9 px-4 border border-gray-300 rounded-lg font-semibold text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    <Copy size={15} />
                                    {copied ? '복사 완료' : '메시지 복사'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 최근 메일 조회 (INBOX) ── */}
            {showInboxTools && (
                <div ref={inboxSectionRef} style={{ order: inboxToolOrderBase + 5 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
                
                {/* 상단 프로그레스 게이지 바 */}
                {fetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div 
                            className="h-full bg-orange-500 transition-all duration-300 ease-out"
                            style={{ width: `${fetchProgress}%` }}
                        />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 bg-[#f8fafc] flex items-center justify-between mt-[2px]">
                    <div>
                        <h2 className="text-lg font-black text-[#1f2937] flex items-center gap-2">
                            <Mail size={18} className="text-slate-500" />
                            인보이스 메일 수신
                            {loadingEmails && <span className="flex h-2 w-2 ml-1"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            제목에 &apos;invoice&apos;가 포함된 메일만 조회합니다.
                            {activeWormOrder && <span className="ml-2 font-semibold text-slate-600">현재 발주: {activeWormOrder.orderNumber}</span>}
                        </p>
                        {emailCacheSavedAt && (
                            <p className={`mt-1 text-[11px] font-medium ${usingOfflineEmailCache ? 'text-amber-600' : 'text-slate-400'}`}>
                                {usingOfflineEmailCache ? '오프라인 캐시 사용 중' : '캐시 저장'} · {new Date(emailCacheSavedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={fetchEmails}
                        disabled={loadingEmails}
                        className="h-9 px-4 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingEmails ? '스캔 중...' : '인박스 모니터'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white border-r border-gray-100 overflow-y-auto max-h-[600px] relative">
                        {emailError && <div className="p-4 text-sm text-red-500 font-medium text-center">{emailError}</div>}
                        {emailMatchMessage && <div className="px-4 py-2 text-[12px] text-emerald-700 font-semibold text-center">{emailMatchMessage}</div>}
                        
                        {loadingEmails && (
                            <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400 h-full mt-20">
                                <span className="text-[13px] font-bold text-orange-500 tracking-wider">스캔 진행률 {Math.round(fetchProgress)}%</span>
                                <div className="w-[120px] h-[3px] bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${fetchProgress}%` }} />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400 animate-pulse mt-1">
                                    Daum 서버 메일 및 SKM 첨부문서를 자동 스캔 중입니다...
                                </span>
                            </div>
                        )}

                        {hasFetched && !loadingEmails && emails.length === 0 && !emailError && (
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 bg-gray-50/50 mt-10">
                                현재 발주에서 매칭 가능한 `invoice` 제목 메일이 없습니다.
                            </div>
                        )}

                        {!loadingEmails && emails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {emails.map((email, index) => {
                                    const isSelected = selectedEmailUid === email.uid
                                    const isMatched = email.matchedOrderId === activeWormOrder?.id
                                    return (
                                        <button
                                            key={email.uid}
                                            onClick={() => setSelectedEmailUid(email.uid)}
                                            className={`w-full text-left p-4 transition-colors ${
                                                isMatched && isSelected
                                                    ? 'bg-emerald-100 border-l-4 border-emerald-600 pl-[13px]'
                                                    : isMatched
                                                    ? 'bg-emerald-50 border-l-4 border-emerald-500 pl-[13px] hover:bg-emerald-100'
                                                    : isSelected
                                                    ? 'bg-orange-50/50 border-l-[3px] border-orange-500 pl-[13px]'
                                                    : 'border-l-[3px] border-transparent pl-4 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[11px] font-bold ${isMatched ? 'text-emerald-700' : isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {new Date(email.date).toLocaleDateString()}
                                                </span>
                                                {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                            </div>
                                            <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isMatched || isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {index + 1}. {email.subject}
                                            </h3>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void handleMatchEmailToActiveOrder(email)
                                                    }}
                                                    className={`inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                                                        email.matchedOrderId === activeWormOrder?.id
                                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                            : matchingEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-progress'
                                                                : activeWormOrder?.id
                                                                    ? 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                                                                    : 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                                                    }`}
                                                    role="button"
                                                    aria-disabled={email.matchedOrderId === activeWormOrder?.id || !activeWormOrder?.id}
                                                >
                                                    {email.matchedOrderId === activeWormOrder?.id
                                                        ? '매칭완료'
                                                        : matchingEmailUid === email.uid
                                                            ? '매칭중...'
                                                            : '매칭하기'}
                                                </span>
                                                {email.matchedOrderNumber && (
                                                    <span className="text-[10px] font-semibold text-emerald-700">
                                                        {email.matchedOrderNumber}
                                                    </span>
                                                )}
                                                {email.matchedOrderId && (
                                                    <span
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleUnmatchEmail(email)
                                                        }}
                                                        className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold tracking-wide transition-colors ${
                                                            unmatchingEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-400 cursor-progress'
                                                                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                                                        }`}
                                                        role="button"
                                                    >
                                                        {unmatchingEmailUid === email.uid ? '해제중...' : '매칭해제'}
                                                    </span>
                                                )}
                                            </div>
                                            {email.matchedOrderId && (
                                                <div className="mt-1.5 rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5">
                                                    <table className="w-full text-[10px]">
                                                        <tbody>
                                                            <tr>
                                                                <td className="py-0.5 font-semibold text-emerald-700 pr-2 whitespace-nowrap">유닛프라이스</td>
                                                                <td className="py-0.5 font-bold text-emerald-900 text-right">{formatUsdAmount(email.invoiceUnitPriceUsd)}</td>
                                                                <td className="py-0.5 text-emerald-700 text-right pl-2">{formatKrwAmount(email.invoiceUnitPriceKrw)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-0.5 font-semibold text-emerald-700 pr-2 whitespace-nowrap">토탈어마운트</td>
                                                                <td className="py-0.5 font-bold text-emerald-900 text-right">{formatUsdAmount(email.invoiceTotalAmountUsd)}</td>
                                                                <td className="py-0.5 text-emerald-700 text-right pl-2">{formatKrwAmount(email.invoiceTotalAmountKrw)}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="py-0.5 font-medium text-emerald-700/80 pr-2 whitespace-nowrap">환율</td>
                                                                <td colSpan={2} className="py-0.5 text-emerald-700/80 text-right">
                                                                    {email.usdKrwRate !== null ? `1 USD = ₩${Math.round(email.usdKrwRate).toLocaleString()}` : '-'}
                                                                </td>
                                                            </tr>
                                                            {email.invoiceOcrError && (
                                                                <tr>
                                                                    <td colSpan={3} className="py-0.5 font-semibold text-rose-600">{email.invoiceOcrError}</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                            {email.awbNumber && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleCustomsProgressSearch(email.awbNumber || '', { scrollIntoView: true })
                                                        }}
                                                        className="inline-flex h-6 items-center rounded-md bg-[#e34219] px-2.5 text-[10px] font-bold tracking-wide text-white hover:bg-[#cd3b17] transition-colors"
                                                    >
                                                        조회하기
                                                    </span>
                                                    <p className={`text-[11px] font-semibold tracking-wide ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                                                        AWB {email.awbNumber}
                                                    </p>
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 flex flex-col">
                        {!selectedEmailUid ? (
                            <div className="flex-1 flex items-center justify-center p-10 text-[13px] text-gray-400 font-medium">
                                {emails.length > 0 ? "좌측에서 메일을 선택하시면 내용이 표시됩니다." : ""}
                            </div>
                        ) : (() => {
                            const selectedEmailBase = emails.find(e => e.uid === selectedEmailUid)
                            const selectedEmailIndex = emails.findIndex((email) => email.uid === selectedEmailUid)
                            const selectedEmailDetail = selectedEmailUid ? emailDetails[selectedEmailUid] : null
                            if (!selectedEmailBase) return null

                            const selectedEmail = {
                                uid: selectedEmailBase.uid,
                                subject: selectedEmailDetail?.subject || selectedEmailBase.subject,
                                date: selectedEmailDetail?.date || selectedEmailBase.date,
                                text: selectedEmailDetail?.text || '',
                                hasAttachments: selectedEmailDetail?.hasAttachments ?? selectedEmailBase.hasAttachments,
                                skmIndices: selectedEmailDetail?.skmIndices || [],
                                attachments: selectedEmailDetail?.attachments || [],
                                awbNumber: selectedEmailDetail?.awbNumber ?? selectedEmailBase.awbNumber ?? null,
                                matchedOrderId: selectedEmailBase.matchedOrderId,
                                matchedOrderNumber: selectedEmailBase.matchedOrderNumber,
                                invoiceUnitPriceUsd: selectedEmailBase.invoiceUnitPriceUsd,
                                invoiceTotalAmountUsd: selectedEmailBase.invoiceTotalAmountUsd,
                                usdKrwRate: selectedEmailBase.usdKrwRate,
                                invoiceUnitPriceKrw: selectedEmailBase.invoiceUnitPriceKrw,
                                invoiceTotalAmountKrw: selectedEmailBase.invoiceTotalAmountKrw,
                                invoiceExtractedAt: selectedEmailBase.invoiceExtractedAt,
                                invoiceSourceFile: selectedEmailBase.invoiceSourceFile,
                                invoiceOcrError: selectedEmailBase.invoiceOcrError,
                                sequence: selectedEmailIndex >= 0 ? selectedEmailIndex + 1 : null,
                                invoicePdfCount: (selectedEmailDetail?.attachments || [])
                                    .filter((att) => {
                                        const name = att.filename.toLowerCase()
                                        const type = att.contentType.toLowerCase()
                                        return name.endsWith('.pdf') || type.includes('pdf')
                                    })
                                    .length,
                            }
                            return (
                                <div className="flex flex-col h-full max-h-[600px]">
                                    {/* 상세 헤더 */}
                                    <div className="p-6 bg-white border-b border-gray-100 shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 leading-tight mb-2 pr-4">
                                            {selectedEmail.sequence ? `${selectedEmail.sequence}. ` : ''}
                                            {selectedEmail.subject}
                                        </h2>
                                        {selectedEmail.awbNumber && (
                                            <p className="mt-2 text-[12px] font-semibold tracking-wide text-blue-700">
                                                AWB {selectedEmail.awbNumber}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {new Date(selectedEmail.date).toLocaleString()}</span>
                                        </div>

                                        {(matchingEmailUid === selectedEmail.uid || invoiceOcrRunningUid === selectedEmail.uid) && (
                                            <div className="mt-3 flex items-center gap-2 text-[12px] text-emerald-700 font-semibold">
                                                <Loader2 size={14} className="animate-spin" />
                                                인보이스 OCR 분석 중...
                                            </div>
                                        )}

                                        {/* 첨부파일 다운로드 */}
                                        {selectedEmail.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                                {selectedEmail.attachments.map((att) => (
                                                    <a
                                                        key={att.index}
                                                        href={`/api/admin/worm-order/emails/attachment?uid=${selectedEmail.uid}&index=${att.index}`}
                                                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#e34219] bg-[#fff7f3] hover:bg-[#ffeadd] px-3 py-1.5 rounded-lg border border-[#ffeadd] transition-colors"
                                                        title="새 탭에서 열거나 다운로드하려면 클릭하세요"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        📎 {att.filename} <span className="font-normal text-[10px] text-orange-400 opacity-80 ml-0.5">({Math.round(att.size / 1024)}KB)</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                    </div>
                                    {/* 메일 본문 내용 */}
                                    <div className="p-6 overflow-y-auto bg-white flex-1 text-[14px]">
                                        {loadingEmailDetail && !selectedEmail.text ? (
                                            <div className="w-full h-full min-h-[220px] flex items-center justify-center text-slate-400 font-medium">
                                                <Loader2 size={16} className="animate-spin mr-2" />
                                                메일 본문을 불러오는 중...
                                            </div>
                                        ) : (
                                            <div 
                                                className="w-full text-gray-800 break-words leading-relaxed max-w-none"
                                                style={{ whiteSpace: selectedEmail.text.includes('<html') ? 'normal' : 'pre-wrap' }}
                                                dangerouslySetInnerHTML={{ __html: selectedEmail.text || '' }} 
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
                </div>
            )}

            {/* ── AWB Documents 메일 조회 ── */}
            {showDocInboxTools && (
                <div ref={docInboxSectionRef} style={{ order: docInboxToolOrderBase + 5 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">

                {docFetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${docFetchProgress}%` }} />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 bg-[#f0f5ff] flex items-center justify-between mt-[2px]">
                    <div>
                        <h2 className="text-lg font-black text-[#1f2937] flex items-center gap-2">
                            <Package size={18} className="text-blue-500" />
                            AWB 메일 수신
                            {loadingDocEmails && <span className="flex h-2 w-2 ml-1"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                            제목에 &apos;documents&apos;가 포함된 선적 서류 메일을 조회합니다.
                        </p>
                    </div>
                    <button
                        onClick={fetchDocumentEmails}
                        disabled={loadingDocEmails}
                        className="h-9 px-4 bg-blue-700 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingDocEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingDocEmails ? '스캔 중...' : '메일 스캔'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white border-r border-gray-100 overflow-y-auto max-h-[600px] relative">
                        {docEmailError && <div className="p-4 text-sm text-red-500 font-medium text-center">{docEmailError}</div>}
                        {docEmailMatchMessage && <div className="px-4 py-2 text-[12px] text-emerald-700 font-semibold text-center">{docEmailMatchMessage}</div>}

                        {loadingDocEmails && (
                            <div className="p-10 flex flex-col items-center justify-center gap-4 text-slate-400 h-full mt-20">
                                <span className="text-[13px] font-bold text-blue-500 tracking-wider">스캔 진행률 {Math.round(docFetchProgress)}%</span>
                                <div className="w-[120px] h-[3px] bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${docFetchProgress}%` }} />
                                </div>
                                <span className="text-[12px] font-medium text-slate-400 animate-pulse mt-1">
                                    선적 서류 메일을 자동 스캔 중입니다...
                                </span>
                            </div>
                        )}

                        {docHasFetched && !loadingDocEmails && docEmails.length === 0 && !docEmailError && (
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 bg-gray-50/50 mt-10">
                                &apos;documents&apos; 제목 메일이 없습니다.
                            </div>
                        )}

                        {!loadingDocEmails && docEmails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {docEmails.map((email, index) => {
                                    const isSelected = selectedDocEmailUid === email.uid
                                    const isMatched = email.matchedOrderId === activeWormOrder?.id
                                    return (
                                        <button
                                            key={email.uid}
                                            onClick={() => setSelectedDocEmailUid(email.uid)}
                                            className={`w-full text-left p-4 transition-colors ${
                                                isMatched && isSelected
                                                    ? 'bg-blue-200/60 border-l-4 border-blue-700 pl-[13px]'
                                                    : isMatched
                                                    ? 'bg-blue-100/70 border-l-4 border-blue-600 pl-[13px] hover:bg-blue-200/60'
                                                    : isSelected
                                                    ? 'bg-blue-50/50 border-l-[3px] border-blue-500 pl-[13px]'
                                                    : 'border-l-[3px] border-transparent pl-4 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[11px] font-bold ${isMatched ? 'text-blue-700' : isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                                                    {new Date(email.date).toLocaleDateString()}
                                                </span>
                                                {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                            </div>
                                            <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isMatched || isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {index + 1}. {email.subject}
                                            </h3>
                                            {/* 매칭/해제 버튼 */}
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                <span
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void handleMatchDocEmailToOrder(email)
                                                    }}
                                                    className={`inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                                                        email.matchedOrderId === activeWormOrder?.id
                                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                            : matchingDocEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-progress'
                                                                : activeWormOrder?.id
                                                                    ? 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                                                                    : 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                                                    }`}
                                                    role="button"
                                                    aria-disabled={email.matchedOrderId === activeWormOrder?.id || !activeWormOrder?.id}
                                                >
                                                    {email.matchedOrderId === activeWormOrder?.id
                                                        ? '매칭완료'
                                                        : matchingDocEmailUid === email.uid
                                                            ? '매칭중...'
                                                            : '매칭하기'}
                                                </span>
                                                {email.matchedOrderNumber && (
                                                    <span className="text-[10px] font-semibold text-emerald-700">
                                                        {email.matchedOrderNumber}
                                                    </span>
                                                )}
                                                {email.matchedOrderId && (
                                                    <span
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleUnmatchDocEmail(email)
                                                        }}
                                                        className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold tracking-wide transition-colors ${
                                                            unmatchingDocEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-400 cursor-progress'
                                                                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                                                        }`}
                                                        role="button"
                                                    >
                                                        {unmatchingDocEmailUid === email.uid ? '해제중...' : '매칭해제'}
                                                    </span>
                                                )}
                                            </div>
                                            {email.awbNumber && (
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <span
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleCustomsProgressSearch(email.awbNumber || '', { scrollIntoView: true })
                                                        }}
                                                        className="inline-flex h-6 items-center rounded-md bg-blue-600 px-2.5 text-[10px] font-bold tracking-wide text-white hover:bg-blue-700 transition-colors"
                                                    >
                                                        통관조회
                                                    </span>
                                                    <p className={`text-[11px] font-semibold tracking-wide ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                                                        AWB {email.awbNumber}
                                                    </p>
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 flex flex-col">
                        {!selectedDocEmailUid ? (
                            <div className="flex-1 flex items-center justify-center p-10 text-[13px] text-gray-400 font-medium">
                                {docEmails.length > 0 ? '좌측에서 메일을 선택하시면 내용이 표시됩니다.' : ''}
                            </div>
                        ) : (() => {
                            const selectedDocBase = docEmails.find(e => e.uid === selectedDocEmailUid)
                            const selectedDocDetail = selectedDocEmailUid ? docEmailDetails[selectedDocEmailUid] : null
                            if (!selectedDocBase) return null

                            const selectedDoc = {
                                uid: selectedDocBase.uid,
                                subject: selectedDocDetail?.subject || selectedDocBase.subject,
                                date: selectedDocDetail?.date || selectedDocBase.date,
                                text: selectedDocDetail?.text || '',
                                hasAttachments: selectedDocDetail?.hasAttachments ?? selectedDocBase.hasAttachments,
                                skmIndices: selectedDocDetail?.skmIndices || [],
                                attachments: selectedDocDetail?.attachments || [],
                                awbNumber: selectedDocDetail?.awbNumber ?? selectedDocBase.awbNumber ?? null,
                            }
                            return (
                                <div className="flex flex-col h-full max-h-[600px]">
                                    <div className="p-6 bg-white border-b border-gray-100 shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 leading-tight mb-2 pr-4">
                                            {selectedDoc.subject}
                                        </h2>
                                        {selectedDoc.awbNumber && (
                                            <p className="mt-2 text-[12px] font-semibold tracking-wide text-blue-700">
                                                AWB {selectedDoc.awbNumber}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {new Date(selectedDoc.date).toLocaleString()}</span>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2">
                                            <button
                                                onClick={handleRunDocAwbOcr}
                                                disabled={loadingDocEmailDetail || awbLoading || selectedDoc.skmIndices.length === 0}
                                                className="h-9 px-3 rounded-lg bg-blue-700 text-white text-[12px] font-bold disabled:opacity-50"
                                            >
                                                {awbLoading ? 'OCR 실행중...' : 'AWB OCR 실행'}
                                            </button>
                                            {loadingDocEmailDetail ? (
                                                <span className="text-[12px] text-slate-500 font-medium">메일 상세를 불러오는 중입니다...</span>
                                            ) : (
                                                <span className="text-[12px] text-slate-500 font-medium">
                                                    {selectedDoc.skmIndices.length > 0
                                                        ? `SKM 첨부파일 ${selectedDoc.skmIndices.length}개`
                                                        : 'SKM 첨부파일이 없습니다.'}
                                                </span>
                                            )}
                                        </div>

                                        {/* AWB OCR 결과 */}
                                        {(awbLoading || awbNumber || awbError || awbCandidates.length > 0) && (
                                            <div className={`mt-5 p-4 rounded-xl border flex flex-col gap-2 ${
                                                awbLoading
                                                    ? 'border-blue-100 bg-blue-50/50'
                                                    : awbError
                                                    ? (awbNumber ? 'border-amber-100 bg-amber-50/60' : 'border-red-100 bg-red-50/50')
                                                    : awbNumber
                                                    ? 'border-blue-100 bg-blue-50/50'
                                                    : 'border-blue-100 bg-blue-50/50'
                                            }`}>
                                                {awbLoading && (
                                                    <div className="flex items-center gap-2 text-blue-600">
                                                        <ScanSearch size={16} className="animate-pulse" />
                                                        <span className="text-[13px] font-bold">SKM 문서에서 Air Waybill 번호를 OCR 스캔 중...</span>
                                                        <Loader2 size={14} className="animate-spin ml-auto" />
                                                    </div>
                                                )}
                                                {awbNumber && !awbLoading && (
                                                    <>
                                                        <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                                                            <Sparkles size={14} className="text-blue-500" />
                                                            Air Waybill 추출 완료 (OCR)
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[20px] font-black text-blue-900 tracking-tight leading-none">{awbNumber}</span>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(awbNumber)
                                                                    alert('운송장 번호 ' + awbNumber + ' 이(가) 복사되었습니다.')
                                                                }}
                                                                className="h-9 px-4 bg-blue-600 text-white font-bold text-[13px] rounded-lg hover:bg-blue-700 transition flex items-center justify-center shrink-0"
                                                            >
                                                                복사하기
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {awbCandidates.length > 1 && !awbLoading && (
                                                    <div className="mt-1 pt-2 border-t border-blue-100/70 flex flex-wrap items-center gap-2">
                                                        <span className="text-[11px] font-bold text-slate-500">대안 후보</span>
                                                        {awbCandidates.slice(1, 6).map((candidate) => (
                                                            <button
                                                                key={`${candidate.value}-${candidate.source}`}
                                                                onClick={() => {
                                                                    setAwbNumber(candidate.value)
                                                                    setAwbError('')
                                                                    persistAwbCache(selectedDoc.uid, candidate.value, selectedDoc)
                                                                }}
                                                                className="h-7 px-2.5 rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                                                title={`source: ${candidate.source}, score: ${candidate.score}`}
                                                            >
                                                                {candidate.value}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {awbError && !awbLoading && (
                                                    <div className={`text-[12px] font-bold flex items-center gap-1.5 ${
                                                        awbNumber ? 'text-amber-700' : 'text-red-600'
                                                    }`}>
                                                        <ScanSearch size={14} />
                                                        {awbError}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 첨부파일 다운로드 */}
                                        {selectedDoc.attachments.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                                {selectedDoc.attachments.map((att) => (
                                                    <a
                                                        key={att.index}
                                                        href={`/api/admin/worm-order/emails/attachment?uid=${selectedDoc.uid}&index=${att.index}`}
                                                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                                                        title="새 탭에서 열거나 다운로드하려면 클릭하세요"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        📎 {att.filename} <span className="font-normal text-[10px] text-blue-400 opacity-80 ml-0.5">({Math.round(att.size / 1024)}KB)</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* 메일 본문 */}
                                    <div className="p-6 overflow-y-auto bg-white flex-1 text-[14px]">
                                        {loadingDocEmailDetail && !selectedDoc.text ? (
                                            <div className="w-full h-full min-h-[220px] flex items-center justify-center text-slate-400 font-medium">
                                                <Loader2 size={16} className="animate-spin mr-2" />
                                                메일 본문을 불러오는 중...
                                            </div>
                                        ) : (
                                            <div
                                                className="w-full text-gray-800 break-words leading-relaxed max-w-none"
                                                style={{ whiteSpace: selectedDoc.text.includes('<html') ? 'normal' : 'pre-wrap' }}
                                                dangerouslySetInnerHTML={{ __html: selectedDoc.text || '' }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
                </div>
            )}

            {showBankPaymentTools && (
                <div
                    ref={bankPaymentSectionRef}
                    style={{ order: bankPaymentToolOrderBase + 5 }}
                    className={`rounded-2xl border shadow-sm overflow-hidden transition-all duration-500 ${
                        remittanceManuallyDone
                            ? 'bg-[#fff3ef] border-[#e34219]'
                            : 'bg-white border-gray-200'
                    }`}
                >
                    <div className={`px-6 py-4 border-b flex items-center justify-between ${
                        remittanceManuallyDone ? 'border-[#f5c4b8] bg-[#fff7f3]' : 'border-gray-100 bg-[#fff7f3]'
                    }`}>
                        <div>
                            <h3 className="text-lg font-black text-[#111827]">모인비지니스 송금</h3>
                            <p className="text-xs text-slate-500 mt-0.5">아래 계좌로 최종 금액을 직접 송금해 주세요.</p>
                        </div>
                        <Send size={18} className="text-[#e34219] mt-1" />
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="rounded-xl border border-[#f5c4b8] bg-[#fff7f3] px-5 py-4">
                            <p className="text-sm font-bold text-[#e34219] mb-3">모인비지니스로 최종금액을 송금해주세요.</p>
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-[#f5c4b8]">
                                    <tr>
                                        <td className="py-2 font-semibold text-slate-600 w-32">은행</td>
                                        <td className="py-2 font-bold text-slate-900">신한은행</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 font-semibold text-slate-600">가상계좌번호</td>
                                        <td className="py-2 font-black text-slate-900 tracking-wider">562-167-6230695-9</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 font-semibold text-slate-600">예금주명</td>
                                        <td className="py-2 font-bold text-slate-900">모인_dabin lee(엑스트래커)</td>
                                    </tr>
                                    {autoTransferAmountUsd !== null && (
                                        <tr>
                                            <td className="py-2 font-semibold text-slate-600">송금 금액</td>
                                            <td className="py-2 font-black text-[#e34219] text-base">
                                                {autoTransferAmountUsd.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setRemittanceManuallyDone((prev) => !prev)}
                                className={`h-11 px-8 rounded-xl font-black text-sm tracking-wide transition-all duration-300 inline-flex items-center gap-2 ${
                                    remittanceManuallyDone
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                                        : 'bg-[#e34219] hover:bg-[#cd3b17] text-white shadow'
                                }`}
                            >
                                {remittanceManuallyDone ? '✓ 송금완료' : '송금완료'}
                            </button>
                            {remittanceManuallyDone && (
                                <span className="text-sm font-semibold text-emerald-700">
                                    송금이 완료되었습니다. 입금완료 통보를 진행해 주세요.
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showRemittanceTools && (
                <div ref={remittanceSectionRef} style={{ order: remittanceToolOrderBase + 5 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black text-[#111827]">모인 자동 송금 신청</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            서버 환경변수에 저장된 계정으로 자동 로그인 후 송금을 신청합니다.
                        </p>
                        {activeWormOrder && (
                            <p className="text-[11px] font-semibold text-slate-600 mt-1">
                                대상 발주: {activeWormOrder.orderNumber} / 수령일 {activeWormOrder.receiveDate}
                            </p>
                        )}
                        {isActiveOrderRemittanceApplied && activeWormOrderRecord && (
                            <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                                송금신청 완료: {activeOrderRemittanceAppliedAtText || '-'}
                                {activeWormOrderRecord.remittanceSendAmountText ? ` / 보내는 돈 ${activeWormOrderRecord.remittanceSendAmountText}` : ''}
                            </p>
                        )}
                    </div>
                    <Send size={18} className="text-[#e34219] mt-1" />
                </div>

                {matchedInvoiceEmail ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.16em]">인보이스 자동 연동</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">송금 금액 (USD)</p>
                                <p className="text-[15px] font-black text-slate-900">
                                    {autoTransferAmountUsd !== null ? `$${autoTransferAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">인보이스 PDF</p>
                                <p className="text-[13px] font-bold text-slate-700 truncate">{matchedInvoiceEmail.subject}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[12px] font-semibold text-amber-700">
                        인보이스 메일을 발주에 매칭하면 송금 금액과 PDF가 자동으로 연동됩니다.
                    </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                        매칭된 인보이스의 토탈어마운트(USD)와 PDF 첨부파일로 자동 송금 신청합니다.
                    </p>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={handleRemittanceApply}
                            disabled={remittanceSubmitting || isRemittanceLocked || isActiveOrderRemittanceApplied || !activeWormOrderRecord || !matchedInvoiceEmail}
                            className="h-11 px-6 bg-[#111827] hover:bg-black text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 w-full md:w-auto"
                        >
                            {!activeWormOrderRecord ? (
                                '발주선택'
                            ) : !matchedInvoiceEmail ? (
                                '인보이스 매칭 필요'
                            ) : isActiveOrderRemittanceApplied ? (
                                '송금완료'
                            ) : isRemittanceLocked ? (
                                `잠금 ${remittanceLockRemainingText}`
                            ) : remittanceSubmitting ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    송금 실행중...
                                </>
                            ) : (
                                '송금 실행'
                            )}
                        </button>

                        {(remittanceSubmitting || remittanceCancelling) && (
                            <button
                                type="button"
                                onClick={handleCancelRemittance}
                                disabled={remittanceCancelling}
                                className="h-11 px-5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
                            >
                                {remittanceCancelling ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        취소중...
                                    </>
                                ) : (
                                    '취소'
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {isActiveOrderRemittanceApplied && (
                    <p className="text-xs font-semibold text-emerald-700">
                        해당 발주는 송금 신청이 완료되어 재신청할 수 없습니다.
                    </p>
                )}
                {!activeWormOrderRecord && (
                    <p className="text-xs font-semibold text-slate-600">
                        발주리스트에서 대상 발주를 먼저 선택해 주세요.
                    </p>
                )}

                {(remittanceSubmitting || remittanceProgress > 0 || !!remittanceSuccess) && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className={remittanceError ? 'text-red-600' : remittanceSuccess ? 'text-emerald-700' : 'text-slate-600'}>
                                {remittanceProgressLabel}
                            </span>
                            <span className={remittanceError ? 'text-red-600' : remittanceSuccess ? 'text-emerald-700' : 'text-slate-500'}>
                                {Math.max(0, Math.min(100, Math.round(remittanceProgress)))}%
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${
                                    remittanceError ? 'bg-red-500' : remittanceSuccess ? 'bg-emerald-500' : 'bg-[#e34219]'
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, remittanceProgress))}%` }}
                            />
                        </div>
                    </div>
                )}

                {remittanceError && (
                    <p className="text-sm font-semibold text-[#e34219]">{remittanceError}</p>
                )}
                {isRemittanceLocked && (
                    <p className="text-sm font-semibold text-amber-700">
                        보호 잠금 활성화: {remittanceLockRemainingText} 후 재시도 가능합니다.
                    </p>
                )}
                {remittanceAttemptsRemaining !== null && remittanceAttemptsRemaining > 0 && !isRemittanceLocked && (
                    <p className="text-xs font-semibold text-amber-700">
                        비밀번호 실패 남은 시도: {remittanceAttemptsRemaining}회 (계정 보호를 위해 제한됨)
                    </p>
                )}
                {remittanceSuccess && (
                    <p className="text-sm font-semibold text-green-600">{remittanceSuccess}</p>
                )}
                {remittancePricingSummary && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-3">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.16em]">송금 확정 정보</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">최종 수취금액</p>
                                <p className="text-[15px] font-black text-slate-900">{remittancePricingSummary.finalReceiveAmount || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">보내는 돈</p>
                                <p className="text-[15px] font-black text-slate-900">{remittancePricingSummary.sendAmount || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">총수수료</p>
                                <p className="text-[15px] font-black text-slate-900">{remittancePricingSummary.totalFee || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white px-3 py-2">
                                <p className="text-[11px] text-slate-500 font-semibold">적용환율</p>
                                <p className="text-[15px] font-black text-slate-900">{remittancePricingSummary.exchangeRate || '-'}</p>
                            </div>
                        </div>
                        {remittanceSaveInfo && (
                            <p className="text-xs font-semibold text-emerald-700">
                                발주 DB 저장 완료: {remittanceSaveInfo.orderNumber} / {new Date(remittanceSaveInfo.savedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}
                {remittanceSaveWarning && (
                    <p className="text-xs font-semibold text-amber-700">{remittanceSaveWarning}</p>
                )}

                </div>
            )}
            {/* ── 입금완료 통보 (Step 5) ── */}
            {showNotificationTools && (() => {
                const sendAmountText = remittancePricingSummary?.sendAmount
                    || (autoTransferAmountUsd !== null
                        ? `$${autoTransferAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : activeWormOrderRecord?.remittanceSendAmountText || null)
                const notificationMessage = sendAmountText
                    ? `Michael, the payment has been completed to the "${sendAmountText}" bank. It should be credited shortly, so please prepare the order for shipment.`
                    : null
                return (
                    <div ref={notificationSectionRef} style={{ order: notificationToolOrderBase + 5 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-[#f0fdf4] flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-[#111827] flex items-center gap-2">
                                    <Send size={18} className="text-emerald-600" />
                                    입금완료 통보
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">마이클에게 입금 완료를 통보하는 메시지를 복사해서 전달하세요.</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            {!sendAmountText ? (
                                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[12px] font-semibold text-amber-700">
                                    송금 신청을 먼저 완료하면 통보 메시지가 자동으로 생성됩니다.
                                </div>
                            ) : (
                                <>
                                    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 px-5 py-4 text-[15px] leading-relaxed text-gray-800 font-medium">
                                        {notificationMessage}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (notificationMessage) {
                                                navigator.clipboard.writeText(notificationMessage)
                                                setPaymentNotificationCopied(true)
                                                setTimeout(() => setPaymentNotificationCopied(false), 2500)
                                            }
                                        }}
                                        className={`inline-flex items-center gap-2 h-10 px-5 rounded-xl font-bold text-sm transition-colors ${
                                            paymentNotificationCopied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                        }`}
                                    >
                                        <Copy size={15} />
                                        {paymentNotificationCopied ? '복사 완료 ✓' : '메시지 복사'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )
            })()}

            {showCustomsTools && (
                <div ref={customsProgressSectionRef} style={{ order: customsToolOrderBase + 5 }} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black text-[#111827]">유니패스 수입 통관 조회</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            B/L 번호만 입력하면 MBL/HBL + 최근 3개년을 자동으로 시도해 조회합니다.
                        </p>
                    </div>
                    <Search size={18} className="text-[#e34219] mt-1" />
                </div>

                {autoBlNumber && !blNumberQuery && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                        <p className="text-[12px] font-semibold text-blue-700 flex-1">
                            매칭된 AWB: <span className="font-black">{autoBlNumber}</span>
                        </p>
                        <button
                            type="button"
                            onClick={() => setBlNumberQuery(autoBlNumber)}
                            className="h-7 px-3 rounded-md bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors shrink-0"
                        >
                            번호 불러오기
                        </button>
                    </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <input
                        type="text"
                        value={blNumberQuery}
                        onChange={(event) => setBlNumberQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !customsProgressLoading) {
                                handleCustomsProgressSearch()
                            }
                        }}
                        placeholder={autoBlNumber ? `매칭된 AWB: ${autoBlNumber} (위 버튼으로 불러오기)` : 'B/L 번호 입력 (예: 94000499505)'}
                        className="flex-1 h-11 px-3 rounded-lg border border-gray-300 text-[#111827] font-medium"
                    />
                    <button
                        type="button"
                        onClick={() => handleCustomsProgressSearch()}
                        disabled={customsProgressLoading}
                        className="h-11 px-6 bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                        {customsProgressLoading ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                조회중...
                            </>
                        ) : (
                            '조회하기'
                        )}
                    </button>
                </div>

                {customsProgressError && (
                    <p className="text-sm font-semibold text-[#e34219]">{customsProgressError}</p>
                )}

                {customsProgressResult && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                        <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span><span className="font-bold text-gray-800">B/L:</span> {customsProgressResult.blNo}</span>
                            <span><span className="font-bold text-gray-800">조회조건:</span> {customsProgressResult.query.kind} / {customsProgressResult.query.blYy}</span>
                            <span><span className="font-bold text-gray-800">결과건수(tCnt):</span> {customsProgressResult.tCnt}</span>
                        </div>

                        {customsProgressResult.ntceInfo && (
                            <p className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                {customsProgressResult.ntceInfo}
                            </p>
                        )}

                        {firstSummary && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                                <p className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                    관리자 또는 관세사가 직접 챙겨야 하는 단계는 배경색으로 강조됩니다.
                                </p>
                                <h4 className="text-sm font-black text-[#111827]">요약정보</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                    <div><span className="font-bold text-gray-700">화물관리번호:</span> {firstSummary.cargMtNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">진행상태:</span> {firstSummary.prgsStts || '-'}</div>
                                    <div><span className="font-bold text-gray-700">통관진행상태:</span> {firstSummary.csclPrgsStts || '-'}</div>
                                    <div><span className="font-bold text-gray-700">처리일시:</span> {formatYmdOrYmdHm(firstSummary.prcsDttm)}</div>
                                    <div><span className="font-bold text-gray-700">MBL:</span> {firstSummary.mblNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">HBL:</span> {firstSummary.hblNo || '-'}</div>
                                    <div><span className="font-bold text-gray-700">양륙항:</span> {firstSummary.dsprNm || '-'}</div>
                                    <div><span className="font-bold text-gray-700">입항일자:</span> {formatYmdOrYmdHm(firstSummary.etprDt)}</div>
                                    <div><span className="font-bold text-gray-700">선박/항공편:</span> {firstSummary.shipNm || '-'}</div>
                                    <div><span className="font-bold text-gray-700">품명:</span> {firstSummary.prnm || '-'}</div>
                                </div>
                            </div>
                        )}

                        {detailRows.length > 0 && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                                <h4 className="text-sm font-black text-[#111827]">진행이력</h4>
                                <p className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                    강조된 행은 관리자나 관세사가 직접 챙겨야 하는 단계이며, 각 행에 처리주체를 함께 표시합니다.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-700">
                                                <th className="text-left px-2 py-2 font-bold">처리일시</th>
                                                <th className="text-left px-2 py-2 font-bold">처리구분</th>
                                                <th className="text-left px-2 py-2 font-bold">반출입내용</th>
                                                <th className="text-left px-2 py-2 font-bold">신고번호</th>
                                                <th className="text-left px-2 py-2 font-bold">장치장</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailRows.map((row, index) => {
                                                const adminStep = getAdminActionStep(row)

                                                return (
                                                    <tr
                                                        key={`${row.prcsDttm || 'row'}-${index}`}
                                                        className={`border-t border-gray-100 text-gray-800 ${adminStep?.rowClassName || ''}`}
                                                    >
                                                        <td className="px-2 py-2">{formatYmdOrYmdHm(row.prcsDttm)}</td>
                                                        <td className="px-2 py-2">
                                                            <div className="flex flex-col gap-1">
                                                                <span>{row.cargTrcnRelaBsopTpcd || '-'}</span>
                                                                {adminStep && (
                                                                    <>
                                                                        <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${adminStep.badgeClassName}`}>
                                                                            {adminStep.label}
                                                                        </span>
                                                                        <span className="text-[11px] font-medium text-slate-600">
                                                                            처리주체: {adminStep.owner}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2">{row.rlbrCn || '-'}</td>
                                                        <td className="px-2 py-2">{row.dclrNo || '-'}</td>
                                                        <td className="px-2 py-2">{row.shedNm || '-'}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                </div>
                )}

            {showShippingTools && (
                <div
                    ref={shippingSectionRef}
                    style={{ order: shippingToolOrderBase + 5 }}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 bg-[#fff7f3] flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-[#111827] flex items-center gap-2">
                                <Package size={18} className="text-[#e34219]" />
                                로젠 송장 출력
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">수하인 정보를 입력하면 로젠 택배 운송장을 자동 발행합니다.</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">수하인 전화번호</label>
                                <input
                                    type="text"
                                    value={shippingRecipientPhone}
                                    onChange={(e) => setShippingRecipientPhone(e.target.value)}
                                    placeholder="010-0000-0000"
                                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">수하인명 (업체명)</label>
                                <input
                                    type="text"
                                    value={shippingRecipientName}
                                    onChange={(e) => setShippingRecipientName(e.target.value)}
                                    placeholder="업체명 또는 수하인명"
                                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">주소 (도로명 + 건물번호)</label>
                            <input
                                type="text"
                                value={shippingRecipientAddress}
                                onChange={(e) => setShippingRecipientAddress(e.target.value)}
                                placeholder="예: 창업로 57번길 7, 시흥동 343"
                                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">상세주소</label>
                            <input
                                type="text"
                                value={shippingRecipientDetailAddress}
                                onChange={(e) => setShippingRecipientDetailAddress(e.target.value)}
                                placeholder="상세주소 (선택)"
                                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => { void handleSubmitLogenShipping() }}
                                disabled={shippingSubmitting || !shippingRecipientPhone || !shippingRecipientName || !shippingRecipientAddress}
                                className="h-11 px-6 bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                            >
                                {shippingSubmitting ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        송장 출력 중...
                                    </>
                                ) : (
                                    '송장 출력 실행'
                                )}
                            </button>
                            {shippingSubmitting && (
                                <span className="text-xs font-semibold text-slate-500">{shippingProgressLabel}</span>
                            )}
                        </div>

                        {shippingError && (
                            <p className="text-sm font-semibold text-[#e34219]">{shippingError}</p>
                        )}
                        {shippingSuccess && (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                                <p className="text-sm font-bold text-emerald-700">{shippingSuccess}</p>
                                {shippingTrackingNumber && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl font-black text-emerald-900 tracking-wider">{shippingTrackingNumber}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(shippingTrackingNumber)
                                            }}
                                            className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                                        >
                                            <Copy size={13} className="inline mr-1" />
                                            복사
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

                </div>
            </div>
    )
}
