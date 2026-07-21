'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Cloud, CloudDrizzle, CloudFog, CloudHail, CloudLightning, CloudRain, CloudRainWind, CloudSnow, CloudSun, Copy, FileText, Loader2, Mail, Minus, Package, Plus, ScanSearch, Search, Send, Sparkles, Sun, Trash2, X } from 'lucide-react'
import Tesseract from 'tesseract.js'
import { extractLatestAutomationStep, resolveRemittanceStageFromStep } from '@/lib/remittanceProgress'
import {
    bestTrustedAwbCandidate,
    extractAwbCandidatesFromText,
    isValidAwbByCheckDigit,
    mergeAwbCandidate,
    normalizeOcrDigits,
    type AwbCandidate,
} from '@/lib/wormAwbExtraction'
import { emailBodyToDisplayText } from '@/lib/wormEmailBody'

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

type WormEmailAttachment = {
    filename: string
    contentType: string
    size: number
    index: number
    isPdf?: boolean
}

type WormEmailMatchType = 'INVOICE' | 'AWB_DOCUMENT'

type WormEmailListItem = {
    uid: string
    subject: string
    date: string
    hasAttachments: boolean
    awbNumber: string | null
    matchType: WormEmailMatchType | null
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

type MatchedWormEmailPayload = {
    invoiceEmails: WormEmailListItem[]
    invoiceEmailDetails: Record<string, WormEmailDetail>
    awbDocumentEmails: WormEmailListItem[]
    awbDocumentEmailDetails: Record<string, WormEmailDetail>
}

function createEmptyMatchedWormEmailPayload(): MatchedWormEmailPayload {
    return {
        invoiceEmails: [],
        invoiceEmailDetails: {},
        awbDocumentEmails: [],
        awbDocumentEmailDetails: {},
    }
}

type RemittanceRuntimeHealth = {
    ok?: boolean
    runtimeAvailable?: boolean
    runtimeUnavailable?: boolean
    runtime?: string | null
    resolvedExecutablePath?: string | null
    missingComponents?: string[]
    error?: string
}

type CustomsProgressResult = {
    blNo: string
    query: {
        kind: 'cargMtNo' | 'mblNo' | 'hblNo'
        blYy: string | null
        value?: string
        label?: string
    }
    tCnt: number
    ntceInfo: string
    summaryRecords: Array<Record<string, string>>
    detailRecords: Array<Record<string, string>>
}

type PipelineMode = 'AUTO' | 'SEMI' | 'MANUAL'
type PipelineRuntimeStatus = 'done' | 'active' | 'todo'
type AwbScanMode = 'fast' | 'precise'
type TesseractWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>
type PipelineSectionTarget = 'order' | 'inbox' | 'docInbox' | 'remittance' | 'customs' | 'cargoCustomsMail' | 'none'

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

type PipelinePhaseDefinition = {
    id: string
    label: string
    stepIds: number[]
    tone: 'red' | 'amber' | 'sky' | 'emerald' | 'slate'
}

function EmailBodyPreview({ loading, text }: { loading: boolean; text: string }) {
    const displayText = useMemo(() => emailBodyToDisplayText(text), [text])

    if (loading && !text) {
        return (
            <div className="w-full h-full min-h-[220px] flex items-center justify-center text-slate-400 font-medium">
                <Loader2 size={16} className="animate-spin mr-2" />
                메일 본문을 불러오는 중...
            </div>
        )
    }

    if (!displayText) {
        return (
            <div className="w-full min-h-[220px] flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-[13px] font-medium text-slate-400 dark:border-[#2a2a2a] dark:bg-[#1a1a1a]">
                표시할 본문 내용이 없습니다.
            </div>
        )
    }

    return (
        <div className="w-full whitespace-pre-wrap break-words leading-relaxed text-gray-800 dark:text-gray-100">
            {displayText}
        </div>
    )
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

type CalendarWeatherLocationKey = 'shanghai' | 'busanGangseo'

type CalendarDailyWeather = {
    date: string
    weatherCode: number | null
    weatherText: string
    maxTempC: number | null
    minTempC: number | null
}

type CalendarWeatherByDate = Record<string, Record<CalendarWeatherLocationKey, CalendarDailyWeather | null>>

type CalendarPriceColorType = 'stable' | 'rise' | 'spike' | 'pullback' | 'transition'

type CalendarMonthlyPriceInfo = {
    month: number
    priceStatus: string
    memo: string
    colorType: CalendarPriceColorType
}

type CalendarDayCell = {
    date: Date
    isCurrentMonth: boolean
    priceStatus: string
    memo: string
    colorType: CalendarPriceColorType
}

const CALENDAR_MONTHLY_PRICE_INFOS: CalendarMonthlyPriceInfo[] = [
    { month: 1, priceStatus: '최저가 / 안정', memo: '연중 가장 유리한 사입 시기', colorType: 'stable' },
    { month: 2, priceStatus: '최저가 / 안정', memo: '연중 가장 유리한 사입 시기', colorType: 'stable' },
    { month: 3, priceStatus: '상승 시작', memo: '가격이 오르기 시작하는 구간', colorType: 'rise' },
    { month: 4, priceStatus: '큰 폭 상승', memo: '수급 불안정으로 가격 부담이 큰 시기', colorType: 'spike' },
    { month: 5, priceStatus: '높은 가격 유지', memo: '높은 시세가 이어지는 구간', colorType: 'rise' },
    { month: 6, priceStatus: '소폭 하락', memo: '일시적인 가격 조정 구간', colorType: 'pullback' },
    { month: 7, priceStatus: '재상승', memo: '다시 가격이 오르는 구간', colorType: 'rise' },
    { month: 8, priceStatus: '재상승 / 고가 구간', memo: '다시 가격이 오르는 구간', colorType: 'rise' },
    { month: 9, priceStatus: '전환 구간', memo: '다음 저가 시즌 전환 준비 구간', colorType: 'transition' },
    { month: 10, priceStatus: '최저가 진입 / 안정', memo: '연중 가장 유리한 사입 시기', colorType: 'stable' },
    { month: 11, priceStatus: '최저가 / 안정', memo: '연중 가장 유리한 사입 시기', colorType: 'stable' },
    { month: 12, priceStatus: '최저가 / 안정', memo: '연중 가장 유리한 사입 시기', colorType: 'stable' },
]

const CALENDAR_MONTHLY_PRICE_INFO_BY_MONTH = new Map<number, CalendarMonthlyPriceInfo>(
    CALENDAR_MONTHLY_PRICE_INFOS.map((entry) => [entry.month, entry]),
)

const CALENDAR_WEATHER_LOCATION_CONFIGS: Array<{
    key: CalendarWeatherLocationKey
    latitude: number
    longitude: number
    timezone: string
}> = [
    {
        key: 'shanghai',
        latitude: 31.2304,
        longitude: 121.4737,
        timezone: 'Asia/Shanghai',
    },
    {
        key: 'busanGangseo',
        latitude: 35.2122,
        longitude: 128.9806,
        timezone: 'Asia/Seoul',
    },
]
const KOREAN_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

const CALENDAR_WEATHER_CODE_LABELS: Record<number, string> = {
    0: '맑음',
    1: '대체로 맑음',
    2: '부분 흐림',
    3: '흐림',
    45: '안개',
    48: '서리 안개',
    51: '이슬비',
    53: '이슬비',
    55: '강한 이슬비',
    61: '약한 비',
    63: '비',
    65: '강한 비',
    71: '약한 눈',
    73: '눈',
    75: '강한 눈',
    80: '소나기',
    81: '강한 소나기',
    82: '매우 강한 소나기',
    95: '뇌우',
    96: '뇌우/우박',
    99: '강한 뇌우/우박',
}

const DEFAULT_CUSTOMS_FORWARD_EMAIL = 'customs@beone.kr'
const CUSTOMS_FORWARD_SUBJECT_SUFFIX = '엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.'

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
    remittanceSendAmount: number | null
    remittanceSendAmountText: string | null
    remittanceTotalFee: number | null
    remittanceTotalFeeText: string | null
    remittanceExchangeRate: number | null
    remittanceExchangeRateText: string | null
    awbNumber: string | null
    awbEmailUid: string | null
    completedStepIds: number[]
    createdAt: string
    updatedAt: string
}

type RemittanceCandidate = {
    transactionId?: string | null
    detailUrl?: string
    dateText?: string
    recipient?: string
    amountUsdText?: string
    sendAmountKrwText?: string
    totalFeeKrwText?: string
    exchangeRateText?: string
    statusText?: string
    appliedAtIso?: string | null
}

const formatMoinDiagnosticSuffix = (diagnostic: unknown) => {
    if (!diagnostic || typeof diagnostic !== 'object') return ''

    const value = diagnostic as {
        url?: unknown
        lastSteps?: unknown
        inputs?: unknown
        buttons?: unknown
        bodyPreview?: unknown
        diagnosticError?: unknown
    }
    const parts: string[] = []

    if (typeof value.url === 'string' && value.url.trim()) {
        parts.push(`url=${value.url}`)
    }
    if (Array.isArray(value.lastSteps)) {
        const lastSteps = value.lastSteps
            .filter((step): step is string => typeof step === 'string' && step.trim().length > 0)
            .slice(-8)
        if (lastSteps.length > 0) {
            parts.push(`steps=${lastSteps.join(' -> ')}`)
        }
    }
    if (Array.isArray(value.inputs)) {
        const inputs = value.inputs
            .filter((input): input is { type?: unknown; name?: unknown; id?: unknown; placeholder?: unknown } => Boolean(input) && typeof input === 'object')
            .slice(0, 8)
            .map((input) => [
                typeof input.type === 'string' ? input.type : '',
                typeof input.name === 'string' ? input.name : '',
                typeof input.id === 'string' ? input.id : '',
                typeof input.placeholder === 'string' ? input.placeholder : '',
            ].filter(Boolean).join('/'))
            .filter(Boolean)
        if (inputs.length > 0) {
            parts.push(`inputs=${inputs.join(', ')}`)
        }
    }
    if (Array.isArray(value.buttons)) {
        const buttons = value.buttons
            .filter((button): button is { text?: unknown; href?: unknown; disabled?: unknown } => Boolean(button) && typeof button === 'object')
            .slice(0, 8)
            .map((button) => {
                const text = typeof button.text === 'string' && button.text.trim()
                    ? button.text.trim()
                    : (typeof button.href === 'string' ? button.href.trim() : '')
                if (!text) return ''
                return button.disabled === true ? `${text}(disabled)` : text
            })
            .filter(Boolean)
        if (buttons.length > 0) {
            parts.push(`buttons=${buttons.join(', ')}`)
        }
    }
    if (typeof value.bodyPreview === 'string' && value.bodyPreview.trim()) {
        parts.push(`body=${value.bodyPreview.trim().slice(0, 260)}`)
    }
    if (typeof value.diagnosticError === 'string' && value.diagnosticError.trim()) {
        parts.push(`diagError=${value.diagnosticError}`)
    }

    return parts.length > 0 ? `\n진단: ${parts.join(' | ')}` : ''
}

type WormForwardLogItem = {
    id: string
    orderId: string | null
    orderNumber: string | null
    toEmail: string
    fromEmail: string
    subject: string
    attachmentCount: number
    sentByUserId: string | null
    sentByUserName: string | null
    createdAt: string
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
        title: '선적 서류 수신 및 AWB OCR',
        summary: 'SKM 문서에서 AWB를 OCR로 추출하고 캐시에 저장합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['첨부 PDF OCR 분석', 'AWB 후보 점수화', 'DB 캐시 저장'],
        actionLabel: 'AWB 메일 조회',
        target: 'docInbox',
    },
    {
        id: 5,
        title: '유니패스 수입 통관 조회',
        summary: 'AWB/B-L 번호로 통관 진행 정보를 조회하고 개입 단계를 강조합니다.',
        mode: 'SEMI',
        owner: '관리자 / 관세사',
        details: ['MBL/HBL + 최근 3개년 자동 조회', '진행이력 개입 단계 강조', '처리주체 표시'],
        actionLabel: 'UNI-PASS 조회',
        target: 'customs',
    },
    {
        id: 6,
        title: '통관 승인 문서 수령',
        summary: '통관 완료 후 필요한 문서를 수령/정리합니다.',
        mode: 'MANUAL',
        owner: '관리자 / 관세사',
        details: ['통관 완료 확인', '문서 수령', '내부 공유'],
        actionLabel: '수동 처리',
        target: 'none',
    },
    {
        id: 7,
        title: '카고/관세사 문서 전달',
        summary: '필요 첨부파일을 지정 이메일로 전달합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['첨부파일 선택', '수신자 입력', '메일 전송 확인'],
        actionLabel: '문서전달',
        target: 'cargoCustomsMail',
    },
    {
        id: 8,
        title: '창고료 청구 메일 수신',
        summary: '창고료 관련 메일을 감지하고 처리 대상을 표시합니다.',
        mode: 'AUTO',
        owner: '시스템',
        details: ['INBOX 메일 스캔', '청구 메일 식별', '후속 단계 알림'],
        actionLabel: '수동 처리',
        target: 'none',
    },
    {
        id: 9,
        title: '창고료 결제',
        summary: '청구 금액을 확인하고 결제를 완료합니다.',
        mode: 'SEMI',
        owner: '관리자',
        details: ['결제 대상 확인', '결제 링크 이동', '완료 체크'],
        actionLabel: '수동 결제',
        target: 'none',
    },
    {
        id: 10,
        title: '카고 현장 픽업',
        summary: '최종 현장 픽업을 수행하고 다음 사이클로 종료합니다.',
        mode: 'MANUAL',
        owner: '관리자',
        details: ['픽업 일정 확인', '현장 수령', '사이클 종료'],
        actionLabel: '수동 픽업',
        target: 'none',
    },
]

const PIPELINE_PHASES: PipelinePhaseDefinition[] = [
    { id: 'order', label: '발주', stepIds: [1, 2], tone: 'red' },
    { id: 'remittance', label: '송금', stepIds: [3], tone: 'amber' },
    { id: 'document', label: '선적서류', stepIds: [4], tone: 'sky' },
    { id: 'customs', label: '통관', stepIds: [5, 6, 7], tone: 'emerald' },
    { id: 'release', label: '출고', stepIds: [8, 9, 10], tone: 'slate' },
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

function normalizeCustomsBlNo(input: string) {
    return input
        .replace(/\s+/g, '')
        .trim()
        .replace(/[^0-9a-zA-Z]/g, '')
        .toUpperCase()
}

const formatRemittanceAutomationError = (message: string) => {
    const normalized = message.replace(/\s+/g, ' ').trim()
    if (!normalized) return '송금 자동화 중 오류가 발생했습니다.'

    if (/MOIN_BIZPLUS_LOGIN_ID|MOIN_BIZPLUS_LOGIN_PASSWORD|Server is not configured/i.test(normalized)) {
        return '모인 계정 환경변수가 설정되지 않았습니다. 서버 환경변수에 MOIN_BIZPLUS_LOGIN_ID와 MOIN_BIZPLUS_LOGIN_PASSWORD를 등록한 뒤 다시 실행해 주세요.'
    }

    if (/브라우저 자동화 런타임|No server browser runtime available|BROWSER_RUNTIME|runtimeUnavailable/i.test(normalized)) {
        return '브라우저 자동화 런타임이 준비되지 않았습니다. 서버의 Chrome/Edge 실행 경로 또는 Chromium 런타임 설정을 확인해 주세요.'
    }

    if (/Select company: Could not find target company text/i.test(normalized)) {
        return '모인 수취인 목록에서 Shanghai Oikki Trading 거래처를 찾지 못했습니다. 수취인 검색/목록 화면이 바뀌었거나 해당 거래처가 숨김 처리되었을 수 있습니다.'
    }

    const withoutPageDump = normalized
        .replace(/\s*\|\s*page-text\(first 800\):.*$/i, '')
        .replace(/\s*\[steps:.*$/i, '')
        .replace(/\s*\[diagnostic:.*$/i, '')
        .replace(/\s*\[debug:.*$/i, '')
        .trim()

    return withoutPageDump.length > 420
        ? `${withoutPageDump.slice(0, 420)}...`
        : withoutPageDump
}

function getPipelineModeBadgeClass(mode: PipelineMode) {
    if (mode === 'AUTO') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (mode === 'SEMI') return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-slate-200 dark:bg-[#2a2a2a] text-slate-700 dark:text-gray-300 border-slate-300 dark:border-[#333]'
}

function getPipelineModeLabel(mode: PipelineMode) {
    if (mode === 'AUTO') return '완전자동'
    if (mode === 'SEMI') return '반자동'
    return '수동'
}

function getPipelineRuntimeBadgeClass(status: PipelineRuntimeStatus) {
    if (status === 'done') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'active') return 'bg-red-100 text-red-800 border-red-200'
    return 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-600 dark:text-gray-400 border-slate-200 dark:border-[#2a2a2a]'
}

function getPipelineRuntimeLabel(status: PipelineRuntimeStatus) {
    if (status === 'done') return '완료'
    if (status === 'active') return '진행중'
    return '대기'
}

function getPipelinePhaseClass(tone: PipelinePhaseDefinition['tone']) {
    if (tone === 'red') return 'border-[#ffd7cc] bg-[#fff7f3] text-[#d9361b]'
    if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-800'
    if (tone === 'sky') return 'border-sky-200 bg-sky-50 text-sky-800'
    if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getWormOrderStatusLabel(status: string) {
    if (status === 'COMPLETED') return '입고완료'
    if (status === 'REMITTANCE_APPLIED') return '송금완료'
    if (status === 'DRAFT') return '작성중'
    return status
}

function getWormOrderStatusClass(status: string) {
    if (status === 'COMPLETED') return 'bg-blue-100 text-blue-800 border-blue-200'
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
        cardActiveClass: 'bg-green-50',
        cardActiveBorderClass: 'border-green-400',
        cardTagClass: 'bg-green-500 text-white',
    },
    {
        id: 'red',
        label: '홍갯지렁이',
        cardActiveClass: 'bg-red-50',
        cardActiveBorderClass: 'border-red-400',
        cardTagClass: 'bg-red-500 text-white',
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

function formatYmdWithKoreanWeekday(ymd: string, separator: '-' | '/' = '-') {
    const date = parseYmdToLocalDate(ymd)
    if (!date) return separator === '/' ? ymd.replace(/-/g, '/') : ymd

    const dateText = separator === '/'
        ? ymd.replace(/-/g, '/')
        : ymd
    return `${dateText} (${KOREAN_WEEKDAY_LABELS[date.getDay()]})`
}

function clampCalendarWeatherRange(startDate: string, endDate: string) {
    const start = parseYmdToLocalDate(startDate)
    const end = parseYmdToLocalDate(endDate)
    if (!start || !end) return null

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const minDate = new Date(today)
    minDate.setDate(minDate.getDate() - 94)
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + 14)

    const clampedStart = start < minDate ? minDate : start
    const clampedEnd = end > maxDate ? maxDate : end
    if (clampedStart > clampedEnd) return null

    return {
        startDate: formatLocalDateToYmd(clampedStart),
        endDate: formatLocalDateToYmd(clampedEnd),
    }
}

function toCalendarWeatherTextByCode(code: number | null) {
    if (code === null) return '정보 없음'
    return CALENDAR_WEATHER_CODE_LABELS[code] || '정보 없음'
}

function formatKstDateDot(date: Date) {
    if (!Number.isFinite(date.getTime())) return '-'

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
    const month = parts.find((part) => part.type === 'month')?.value ?? '00'
    const day = parts.find((part) => part.type === 'day')?.value ?? '00'
    return `${year}.${month}.${day}`
}

function toValidDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null

    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isFinite(date.getTime()) ? date : null
}

function formatSafeDateTime(
    value: unknown,
    options?: Intl.DateTimeFormatOptions,
    fallback = '-',
) {
    const date = toValidDate(value)
    if (!date) return fallback

    try {
        return new Intl.DateTimeFormat('ko-KR', options).format(date)
    } catch {
        return fallback
    }
}

function formatSafeDate(value: unknown, fallback = '-') {
    return formatSafeDateTime(value, undefined, fallback)
}

function getCalendarMonthlyPriceInfo(month: number) {
    return CALENDAR_MONTHLY_PRICE_INFO_BY_MONTH.get(month) || null
}

function getCalendarPriceBadgeClass(colorType: CalendarPriceColorType, selected = false) {
    if (selected) return 'bg-white/20 text-white border border-white/30'
    if (colorType === 'stable') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    if (colorType === 'rise') return 'bg-orange-50 text-orange-700 border border-orange-200'
    if (colorType === 'spike') return 'bg-rose-50 text-rose-700 border border-rose-200'
    if (colorType === 'pullback') return 'bg-amber-50 text-amber-700 border border-amber-200'
    return 'bg-slate-100 text-slate-700 border border-slate-200'
}

function getCalendarPriceTintClass(colorType: CalendarPriceColorType) {
    if (colorType === 'stable') return 'ring-1 ring-emerald-100'
    if (colorType === 'rise') return 'ring-1 ring-orange-100'
    if (colorType === 'spike') return 'ring-1 ring-rose-100'
    if (colorType === 'pullback') return 'ring-1 ring-amber-100'
    return 'ring-1 ring-slate-200'
}

const HEAVY_RAIN_WEATHER_CODES = new Set<number>([65, 81, 82, 95, 96, 99])
const RAIN_WEATHER_CODES = new Set<number>([51, 53, 55, 61, 63, 80])

function classifyDayPrecipitation(
    shanghai: CalendarDailyWeather | null,
    busanGangseo: CalendarDailyWeather | null,
): 'heavy' | 'rain' | null {
    const codes = [shanghai?.weatherCode, busanGangseo?.weatherCode].filter(
        (code): code is number => typeof code === 'number',
    )
    if (codes.some((code) => HEAVY_RAIN_WEATHER_CODES.has(code))) return 'heavy'
    if (codes.some((code) => RAIN_WEATHER_CODES.has(code))) return 'rain'
    return null
}

function getCalendarRainBgClass(level: 'heavy' | 'rain' | null) {
    if (level === 'heavy') return 'bg-blue-100 border-blue-300 hover:bg-blue-200 dark:bg-blue-900/40 dark:border-blue-700 dark:hover:bg-blue-900/60'
    if (level === 'rain') return 'bg-sky-50 border-sky-200 hover:bg-sky-100 dark:bg-sky-900/30 dark:border-sky-800 dark:hover:bg-sky-900/50'
    return ''
}

function getCalendarDayOfWeekBgClass(dayOfWeek: number) {
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:border-rose-800 dark:hover:bg-rose-900/50'
    if (dayOfWeek === 5) return 'bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-900/30 dark:border-orange-800 dark:hover:bg-orange-900/50'
    return ''
}

const CHINESE_PUBLIC_HOLIDAYS: Record<string, string> = {
    // 2025
    '2025-01-01': '원단 (元旦)',
    '2025-01-28': '춘절 (除夕)',
    '2025-01-29': '춘절 (春节)',
    '2025-01-30': '춘절',
    '2025-01-31': '춘절',
    '2025-02-01': '춘절',
    '2025-02-02': '춘절',
    '2025-02-03': '춘절',
    '2025-02-04': '춘절',
    '2025-04-04': '청명절 (清明节)',
    '2025-04-05': '청명절',
    '2025-04-06': '청명절',
    '2025-05-01': '노동절 (劳动节)',
    '2025-05-02': '노동절',
    '2025-05-03': '노동절',
    '2025-05-04': '노동절',
    '2025-05-05': '노동절',
    '2025-05-31': '단오절 (端午节)',
    '2025-06-01': '단오절',
    '2025-06-02': '단오절',
    '2025-10-01': '중추절·국경절 (中秋节·国庆节)',
    '2025-10-02': '국경절',
    '2025-10-03': '국경절',
    '2025-10-04': '국경절',
    '2025-10-05': '국경절',
    '2025-10-06': '국경절',
    '2025-10-07': '국경절',
    '2025-10-08': '국경절',
    // 2026
    '2026-01-01': '원단 (元旦)',
    '2026-02-16': '춘절 (除夕)',
    '2026-02-17': '춘절 (春节)',
    '2026-02-18': '춘절',
    '2026-02-19': '춘절',
    '2026-02-20': '춘절',
    '2026-02-21': '춘절',
    '2026-02-22': '춘절',
    '2026-04-04': '청명절 (清明节)',
    '2026-04-05': '청명절',
    '2026-04-06': '청명절',
    '2026-05-01': '노동절 (劳动节)',
    '2026-05-02': '노동절',
    '2026-05-03': '노동절',
    '2026-05-04': '노동절',
    '2026-05-05': '노동절',
    '2026-06-19': '단오절 (端午节)',
    '2026-06-20': '단오절',
    '2026-06-21': '단오절',
    '2026-09-25': '중추절 (中秋节)',
    '2026-09-26': '중추절',
    '2026-09-27': '중추절',
    '2026-10-01': '국경절 (国庆节)',
    '2026-10-02': '국경절',
    '2026-10-03': '국경절',
    '2026-10-04': '국경절',
    '2026-10-05': '국경절',
    '2026-10-06': '국경절',
    '2026-10-07': '국경절',
    // 2027 (잠정)
    '2027-01-01': '원단 (元旦)',
    '2027-02-06': '춘절 (除夕)',
    '2027-02-07': '춘절 (春节)',
    '2027-02-08': '춘절',
    '2027-02-09': '춘절',
    '2027-02-10': '춘절',
    '2027-02-11': '춘절',
    '2027-02-12': '춘절',
    '2027-04-04': '청명절',
    '2027-04-05': '청명절',
    '2027-04-06': '청명절',
    '2027-05-01': '노동절',
    '2027-05-02': '노동절',
    '2027-05-03': '노동절',
    '2027-05-04': '노동절',
    '2027-05-05': '노동절',
    '2027-06-09': '단오절',
    '2027-06-10': '단오절',
    '2027-06-11': '단오절',
    '2027-09-15': '중추절',
    '2027-09-16': '중추절',
    '2027-09-17': '중추절',
    '2027-10-01': '국경절',
    '2027-10-02': '국경절',
    '2027-10-03': '국경절',
    '2027-10-04': '국경절',
    '2027-10-05': '국경절',
    '2027-10-06': '국경절',
    '2027-10-07': '국경절',
}

function getChineseHolidayName(ymd: string): string | null {
    return CHINESE_PUBLIC_HOLIDAYS[ymd] || null
}

function getChineseHolidayShortLabel(fullName: string): string {
    const koreanPart = fullName.split(' ')[0] || fullName
    const compact = koreanPart.replace('·', '/')
    if (compact.length > 4) return `${compact.slice(0, 3)}…`
    return compact
}

const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
    // 2025
    '2025-01-01': '신정',
    '2025-01-27': '임시공휴일',
    '2025-01-28': '설날 연휴',
    '2025-01-29': '설날',
    '2025-01-30': '설날 연휴',
    '2025-03-01': '삼일절',
    '2025-03-03': '대체공휴일 (삼일절)',
    '2025-05-05': '어린이날·부처님오신날',
    '2025-05-06': '대체공휴일',
    '2025-06-06': '현충일',
    '2025-08-15': '광복절',
    '2025-10-03': '개천절',
    '2025-10-05': '추석 연휴',
    '2025-10-06': '추석',
    '2025-10-07': '추석 연휴',
    '2025-10-08': '대체공휴일 (추석)',
    '2025-10-09': '한글날',
    '2025-12-25': '성탄절',
    // 2026
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-01': '삼일절',
    '2026-03-02': '대체공휴일 (삼일절)',
    '2026-05-05': '어린이날',
    '2026-05-24': '부처님오신날',
    '2026-05-25': '대체공휴일 (부처님오신날)',
    '2026-06-06': '현충일',
    '2026-08-15': '광복절',
    '2026-08-17': '대체공휴일 (광복절)',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-09-28': '대체공휴일 (추석)',
    '2026-10-03': '개천절',
    '2026-10-05': '대체공휴일 (개천절)',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절',
    // 2027 (잠정)
    '2027-01-01': '신정',
    '2027-02-06': '설날 연휴',
    '2027-02-07': '설날',
    '2027-02-08': '설날 연휴',
    '2027-03-01': '삼일절',
    '2027-05-05': '어린이날',
    '2027-05-13': '부처님오신날',
    '2027-06-06': '현충일',
    '2027-06-07': '대체공휴일 (현충일)',
    '2027-08-15': '광복절',
    '2027-08-16': '대체공휴일 (광복절)',
    '2027-09-14': '추석 연휴',
    '2027-09-15': '추석',
    '2027-09-16': '추석 연휴',
    '2027-10-03': '개천절',
    '2027-10-04': '대체공휴일 (개천절)',
    '2027-10-09': '한글날',
    '2027-12-25': '성탄절',
}

function getKoreanHolidayName(ymd: string): string | null {
    return KOREAN_PUBLIC_HOLIDAYS[ymd] || null
}

function getKoreanHolidayShortLabel(fullName: string): string {
    const main = fullName.split(' (')[0]
    const compact = main.replace('·', '/').replace(' 연휴', '')
    if (compact.length > 5) return `${compact.slice(0, 4)}…`
    return compact
}

function getCalendarWeekdayHeaderClass(dayOfWeek: number) {
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'text-red-500 dark:text-red-400'
    if (dayOfWeek === 5) return 'text-orange-500 dark:text-orange-400'
    return 'text-slate-400'
}

function buildMonthCalendarDays(year: number, month: number): CalendarDayCell[] {
    const firstDay = new Date(year, month, 1)
    const firstWeekday = firstDay.getDay()
    const start = new Date(year, month, 1 - firstWeekday)
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start)
        date.setDate(start.getDate() + index)
        const monthlyPriceInfo = getCalendarMonthlyPriceInfo(date.getMonth() + 1)
        return {
            date,
            isCurrentMonth: date.getMonth() === month,
            priceStatus: monthlyPriceInfo?.priceStatus || '-',
            memo: monthlyPriceInfo?.memo || '',
            colorType: monthlyPriceInfo?.colorType || 'transition',
        }
    })
}

function formatCalendarWeatherText(weather: CalendarDailyWeather | null) {
    if (!weather) return '-'
    const maxText = weather.maxTempC !== null ? `${weather.maxTempC}` : '-'
    const minText = weather.minTempC !== null ? `${weather.minTempC}` : '-'
    return `${weather.weatherText} ${maxText}/${minText}°`
}

function formatCalendarWeatherTempText(weather: CalendarDailyWeather | null) {
    if (!weather) return '-'
    const maxText = weather.maxTempC !== null ? `${weather.maxTempC}` : '-'
    const minText = weather.minTempC !== null ? `${weather.minTempC}` : '-'
    return `${maxText}/${minText}°`
}

type WeatherIconRender = {
    Icon: typeof Sun
    colorClass: string
}

function getCalendarWeatherIcon(weather: CalendarDailyWeather | null): WeatherIconRender | null {
    if (!weather || weather.weatherCode === null) return null
    const code = weather.weatherCode
    if (code === 0 || code === 1) return { Icon: Sun, colorClass: 'text-amber-500' }
    if (code === 2) return { Icon: CloudSun, colorClass: 'text-amber-400' }
    if (code === 3) return { Icon: Cloud, colorClass: 'text-slate-400' }
    if (code === 45 || code === 48) return { Icon: CloudFog, colorClass: 'text-slate-400' }
    if (code === 51 || code === 53 || code === 55) return { Icon: CloudDrizzle, colorClass: 'text-sky-500' }
    if (code === 61 || code === 63 || code === 80) return { Icon: CloudRain, colorClass: 'text-sky-600' }
    if (code === 65 || code === 81 || code === 82) return { Icon: CloudRainWind, colorClass: 'text-blue-600' }
    if (code === 71 || code === 73 || code === 75) return { Icon: CloudSnow, colorClass: 'text-sky-300' }
    if (code === 96) return { Icon: CloudHail, colorClass: 'text-indigo-600' }
    if (code === 95 || code === 99) return { Icon: CloudLightning, colorClass: 'text-indigo-600' }
    return { Icon: Cloud, colorClass: 'text-slate-400' }
}

function isCalendarWeatherLocationKey(value: unknown): value is CalendarWeatherLocationKey {
    return value === 'shanghai' || value === 'busanGangseo'
}

function toCalendarDailyWeather(value: unknown): CalendarDailyWeather | null {
    if (!value || typeof value !== 'object') return null
    const candidate = value as Record<string, unknown>
    const date = typeof candidate.date === 'string' ? candidate.date : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

    const weatherCode = typeof candidate.weatherCode === 'number' && Number.isFinite(candidate.weatherCode)
        ? candidate.weatherCode
        : null
    const weatherText = typeof candidate.weatherText === 'string' && candidate.weatherText.trim()
        ? candidate.weatherText
        : '정보 없음'
    const maxTempC = typeof candidate.maxTempC === 'number' && Number.isFinite(candidate.maxTempC)
        ? candidate.maxTempC
        : null
    const minTempC = typeof candidate.minTempC === 'number' && Number.isFinite(candidate.minTempC)
        ? candidate.minTempC
        : null

    return {
        date,
        weatherCode,
        weatherText,
        maxTempC,
        minTempC,
    }
}

function buildEmptyCalendarWeatherByDate(calendarDays: CalendarDayCell[]): CalendarWeatherByDate {
    const nextWeatherByDate: CalendarWeatherByDate = {}
    calendarDays.forEach((dayCell) => {
        const ymd = formatLocalDateToYmd(dayCell.date)
        nextWeatherByDate[ymd] = {
            shanghai: null,
            busanGangseo: null,
        }
    })
    return nextWeatherByDate
}

function mergeCalendarWeatherLocations(
    calendarDays: CalendarDayCell[],
    locations: unknown[],
): CalendarWeatherByDate {
    const nextWeatherByDate = buildEmptyCalendarWeatherByDate(calendarDays)

    locations.forEach((location: unknown) => {
        if (!location || typeof location !== 'object') return
        const candidate = location as Record<string, unknown>
        const key = candidate.key
        if (!isCalendarWeatherLocationKey(key)) return
        const dailyItems = Array.isArray(candidate.daily) ? candidate.daily : []
        dailyItems.forEach((dailyItemRaw: unknown) => {
            const dailyItem = toCalendarDailyWeather(dailyItemRaw)
            if (!dailyItem?.date) return
            const current = nextWeatherByDate[dailyItem.date] || {
                shanghai: null,
                busanGangseo: null,
            }
            current[key] = dailyItem
            nextWeatherByDate[dailyItem.date] = current
        })
    })

    return nextWeatherByDate
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

const WORM_EMAIL_CACHE_STORAGE_KEY = 'beico-worm-order-email-cache-v1'
const WORM_ACTIVE_ORDER_STORAGE_KEY = 'beico-worm-order-active-id-v1'
const WORM_EMAIL_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

function readStoredActiveWormOrderId() {
    if (typeof window === 'undefined') return null

    try {
        return window.localStorage.getItem(WORM_ACTIVE_ORDER_STORAGE_KEY) || null
    } catch (error) {
        console.error('Failed to restore active worm order id', error)
        return null
    }
}

function writeStoredActiveWormOrderId(orderId: string | null) {
    if (typeof window === 'undefined') return

    try {
        if (orderId) {
            window.localStorage.setItem(WORM_ACTIVE_ORDER_STORAGE_KEY, orderId)
        } else {
            window.localStorage.removeItem(WORM_ACTIVE_ORDER_STORAGE_KEY)
        }
    } catch (error) {
        console.error('Failed to persist active worm order id', error)
    }
}

function readUrlActiveWormOrderId() {
    if (typeof window === 'undefined') return null

    try {
        const params = new URL(window.location.href).searchParams
        return (params.get('wormOrderId') || params.get('orderId') || '').trim() || null
    } catch (error) {
        console.error('Failed to read active worm order id from URL', error)
        return null
    }
}

function writeUrlActiveWormOrderId(orderId: string | null) {
    if (typeof window === 'undefined') return

    try {
        const url = new URL(window.location.href)
        if (orderId) {
            url.searchParams.set('wormOrderId', orderId)
        } else {
            url.searchParams.delete('wormOrderId')
        }
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    } catch (error) {
        console.error('Failed to persist active worm order id to URL', error)
    }
}

function normalizeWormEmailMatchType(value: unknown): WormEmailMatchType | null {
    if (value === 'INVOICE' || value === 'AWB_DOCUMENT') return value
    return null
}

function isPdfEmailAttachment(attachment: WormEmailAttachment) {
    return (
        attachment.isPdf === true ||
        attachment.filename.toLowerCase().endsWith('.pdf') ||
        attachment.contentType.toLowerCase().includes('pdf')
    )
}

function isJpegEmailAttachment(attachment: WormEmailAttachment) {
    const filename = attachment.filename.toLowerCase()
    const contentType = attachment.contentType.toLowerCase()
    return filename.endsWith('.jpg') || filename.endsWith('.jpeg') || contentType === 'image/jpeg' || contentType === 'image/jpg'
}

function formatAttachmentFileSize(size: number) {
    if (!Number.isFinite(size) || size <= 0) return '-'
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10}KB`
    return `${Math.round(size / 1024 / 102.4) / 10}MB`
}

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
        matchType: normalizeWormEmailMatchType(candidate.matchType),
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

type SummaryCurrency = 'krw' | 'usd' | 'any'

function parseSummaryAmountByCurrency(value: string | null, currency: SummaryCurrency) {
    if (!value) return null
    const tokenRegex = /-?\d[\d,]*(?:\.\d+)?/g
    const usdMarkerRegex = /US\$|USD/i
    const krwMarkerRegex = /KRW|\u20A9|\uC6D0/i
    const candidates: Array<{ amount: number; currency: SummaryCurrency }> = []
    let match: RegExpExecArray | null = null

    while ((match = tokenRegex.exec(value)) !== null) {
        const numeric = Number((match[0] || '').replace(/,/g, ''))
        if (!Number.isFinite(numeric)) continue

        const start = match.index
        const end = start + match[0].length
        const contextStart = Math.max(0, start - 8)
        const contextEnd = Math.min(value.length, end + 8)
        const marker = value.slice(contextStart, contextEnd)
        const inferred: SummaryCurrency =
            usdMarkerRegex.test(marker)
                ? 'usd'
                : krwMarkerRegex.test(marker)
                    ? 'krw'
                    : 'any'
        candidates.push({ amount: numeric, currency: inferred })
    }

    if (candidates.length === 0) return null
    if (currency === 'any') return candidates[0]?.amount ?? null
    return candidates.find((candidate) => candidate.currency === currency)?.amount ?? null
}

function parseSummaryRate(value: string | null) {
    if (!value) return null
    const matches = value.match(/-?\d[\d,]*(?:\.\d+)?/g)
    if (!matches || matches.length === 0) return null
    const parsed = Number(matches[matches.length - 1].replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

function pickPlausibleKrwAmount(candidates: Array<number | null>, expected: number | null) {
    const normalized = candidates
        .filter((candidate): candidate is number => candidate !== null && Number.isFinite(candidate) && candidate > 0)

    if (normalized.length === 0) return expected
    if (expected === null || !Number.isFinite(expected) || expected <= 0) return normalized[0]

    const plausible = normalized.filter((candidate) => {
        const ratio = candidate / expected
        return ratio >= 0.75 && ratio <= 1.35
    })

    if (plausible.length > 0) {
        return plausible.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0]
    }

    return expected
}

function resolveRemittanceSendUsd(order: WormOrderListItem) {
    const fromSendTextUsd = parseSummaryAmountByCurrency(order.remittanceSendAmountText, 'usd')
    if (fromSendTextUsd !== null) return fromSendTextUsd

    const fromFinalReceiveTextUsd = parseSummaryAmountByCurrency(order.remittanceFinalReceiveAmountText, 'usd')
    if (fromFinalReceiveTextUsd !== null) return fromFinalReceiveTextUsd

    return null
}

function resolveRemittanceSendKrw(order: WormOrderListItem): number | null {
    const fromSendTextKrw = parseSummaryAmountByCurrency(order.remittanceSendAmountText, 'krw')
    if (fromSendTextKrw !== null) return fromSendTextKrw

    if (order.remittanceSendAmount !== null) return order.remittanceSendAmount

    const originKrw = resolveRemittanceOriginKrw(order)
    const feeKrw = resolveRemittanceFeeKrw(order) ?? 0
    return originKrw !== null ? Math.round(originKrw + feeKrw) : null
}

function resolveRemittanceFeeKrw(order: WormOrderListItem): number | null {
    const fromTotalFeeTextKrw = parseSummaryAmountByCurrency(order.remittanceTotalFeeText, 'krw')
    if (fromTotalFeeTextKrw !== null) return fromTotalFeeTextKrw

    if (order.remittanceTotalFee !== null) return order.remittanceTotalFee
    return null
}

function resolveRemittanceOriginKrw(order: WormOrderListItem): number | null {
    const directSendKrw = parseSummaryAmountByCurrency(order.remittanceSendAmountText, 'krw')
        ?? order.remittanceSendAmount
    const feeKrw = resolveRemittanceFeeKrw(order)
    if (directSendKrw !== null && feeKrw !== null) {
        const originKrw = directSendKrw - feeKrw
        if (originKrw >= 0) return originKrw
    }

    const rate = parseSummaryRate(order.remittanceExchangeRateText) ?? order.remittanceExchangeRate
    const usdAmount = resolveRemittanceSendUsd(order)
    if (!rate || rate <= 0 || usdAmount === null) return null
    return Math.round(usdAmount * rate)
}

function resolveRemittanceTotalPaidKrw(order: WormOrderListItem): number | null {
    const totalPaidKrw = resolveRemittanceSendKrw(order)
    if (totalPaidKrw !== null) return totalPaidKrw

    const originKrw = resolveRemittanceOriginKrw(order)
    if (originKrw === null) return null
    const feeKrw = resolveRemittanceFeeKrw(order) ?? 0
    return Math.round(originKrw + feeKrw)
}

function isRemittanceSummaryComplete(order: WormOrderListItem) {
    const sendAmountUsd = resolveRemittanceSendUsd(order)
    const totalPaidKrw = resolveRemittanceTotalPaidKrw(order)
    const totalFeeKrw = resolveRemittanceFeeKrw(order)
    const exchangeRate = parseSummaryRate(order.remittanceExchangeRateText) ?? order.remittanceExchangeRate

    return (
        sendAmountUsd !== null &&
        totalPaidKrw !== null &&
        totalFeeKrw !== null &&
        exchangeRate !== null &&
        Number.isFinite(sendAmountUsd) &&
        Number.isFinite(totalPaidKrw) &&
        Number.isFinite(totalFeeKrw) &&
        Number.isFinite(exchangeRate)
    )
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
        isPdf: candidate.isPdf === true,
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

function sanitizeWormEmailDetailsMap(value: unknown, emails: WormEmailListItem[]) {
    if (!value || typeof value !== 'object') return {}
    const emailUidSet = new Set(emails.map((email) => email.uid))
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([uid, detail]) => {
                if (!emailUidSet.has(uid)) return null
                const sanitized = sanitizeWormEmailDetail(detail)
                if (!sanitized || sanitized.uid !== uid) return null
                return [uid, sanitized] as const
            })
            .filter((entry): entry is readonly [string, WormEmailDetail] => entry !== null),
    ) as Record<string, WormEmailDetail>
}

function sanitizeMatchedWormEmailPayload(value: unknown): MatchedWormEmailPayload {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    const invoiceEmails = Array.isArray(source.invoiceEmails)
        ? source.invoiceEmails
            .map((email) => sanitizeWormEmailListItem(email))
            .filter((email): email is WormEmailListItem => email !== null)
        : []
    const awbDocumentEmails = Array.isArray(source.awbDocumentEmails)
        ? source.awbDocumentEmails
            .map((email) => sanitizeWormEmailListItem(email))
            .filter((email): email is WormEmailListItem => email !== null)
        : []

    return {
        invoiceEmails,
        invoiceEmailDetails: sanitizeWormEmailDetailsMap(source.invoiceEmailDetails, invoiceEmails),
        awbDocumentEmails,
        awbDocumentEmailDetails: sanitizeWormEmailDetailsMap(source.awbDocumentEmailDetails, awbDocumentEmails),
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

function buildRemittancePricingSummaryFromOrder(
    order: Pick<
        WormOrderListItem,
        'remittanceFinalReceiveAmountText' | 'remittanceSendAmountText' | 'remittanceTotalFeeText' | 'remittanceExchangeRateText'
    > | null | undefined,
): RemittancePricingSummary | null {
    if (!order) return null

    const summary: RemittancePricingSummary = {
        finalReceiveAmount: order.remittanceFinalReceiveAmountText?.trim() || '',
        sendAmount: order.remittanceSendAmountText?.trim() || '',
        totalFee: order.remittanceTotalFeeText?.trim() || '',
        exchangeRate: order.remittanceExchangeRateText?.trim() || '',
    }

    if (!summary.finalReceiveAmount && !summary.sendAmount && !summary.totalFee && !summary.exchangeRate) {
        return null
    }

    return summary
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
        remittanceSendAmount: typeof candidate.remittanceSendAmount === 'number' && Number.isFinite(candidate.remittanceSendAmount) ? candidate.remittanceSendAmount : null,
        remittanceSendAmountText: typeof candidate.remittanceSendAmountText === 'string' ? candidate.remittanceSendAmountText : null,
        remittanceTotalFee: typeof candidate.remittanceTotalFee === 'number' && Number.isFinite(candidate.remittanceTotalFee) ? candidate.remittanceTotalFee : null,
        remittanceTotalFeeText: typeof candidate.remittanceTotalFeeText === 'string' ? candidate.remittanceTotalFeeText : null,
        remittanceExchangeRate: typeof candidate.remittanceExchangeRate === 'number' && Number.isFinite(candidate.remittanceExchangeRate) ? candidate.remittanceExchangeRate : null,
        remittanceExchangeRateText: typeof candidate.remittanceExchangeRateText === 'string' ? candidate.remittanceExchangeRateText : null,
        awbNumber: typeof candidate.awbNumber === 'string' ? candidate.awbNumber : null,
        awbEmailUid: typeof candidate.awbEmailUid === 'string' ? candidate.awbEmailUid : null,
        completedStepIds: Array.isArray(candidate.completedStepIds)
            ? candidate.completedStepIds.filter((stepId): stepId is number => Number.isInteger(stepId))
            : [],
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

async function detectAwbBarcodeCandidates(canvas: HTMLCanvasElement, source: string) {
    type DetectedBarcode = { rawValue?: string }
    type BarcodeDetectorInstance = { detect: (input: HTMLCanvasElement) => Promise<DetectedBarcode[]> }
    type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!Detector) return []

    try {
        const detector = new Detector({ formats: ['code_128', 'code_39'] })
        const detected = await detector.detect(canvas)
        const byValue = new Map<string, AwbCandidate>()
        for (const barcode of detected) {
            if (!barcode.rawValue) continue
            const candidates = extractAwbCandidatesFromText(barcode.rawValue, `${source},barcode`, 700)
            for (const candidate of candidates) mergeAwbCandidate(byValue, candidate)
        }
        return Array.from(byValue.values()).sort((left, right) => right.score - left.score)
    } catch {
        return []
    }
}

export default function WormOrderPage() {
    const today = new Date().toISOString().split('T')[0]
    const [quantitiesByType, setQuantitiesByType] = useState<Record<WormTypeId, Record<string, number>>>(createInitialQuantitiesByType)
    const [receiveDate, setReceiveDate] = useState(today)
    const [calendarCursor, setCalendarCursor] = useState(() => {
        const base = parseYmdToLocalDate(today) || new Date()
        return { year: base.getFullYear(), month: base.getMonth() }
    })
    const [calendarWeatherByDate, setCalendarWeatherByDate] = useState<CalendarWeatherByDate>({})
    const [calendarWeatherLoading, setCalendarWeatherLoading] = useState(false)
    const [calendarWeatherError, setCalendarWeatherError] = useState('')
    const [generatedMessage, setGeneratedMessage] = useState('')
    const [validationError, setValidationError] = useState('')
    const [orderCreateError, setOrderCreateError] = useState('')
    const [orderCreateNotice, setOrderCreateNotice] = useState('')
    const [creatingOrder, setCreatingOrder] = useState(false)
    const [copied, setCopied] = useState(false)
    const [transferAmountUsd, setTransferAmountUsd] = useState('')
    const [invoicePdf, setInvoicePdf] = useState<File | null>(null)
    const [useManualRemittanceInput, setUseManualRemittanceInput] = useState(false)
    const [invoicePreviewUrl, setInvoicePreviewUrl] = useState('')
    const [invoicePreviewLoading, setInvoicePreviewLoading] = useState(false)
    const [invoicePreviewError, setInvoicePreviewError] = useState('')
    const [remittanceError, setRemittanceError] = useState('')
    const [remittanceSuccess, setRemittanceSuccess] = useState('')
    const [remittanceSubmitting, setRemittanceSubmitting] = useState(false)
    const [remittanceCancelling, setRemittanceCancelling] = useState(false)
    const [remittanceServerRunActive, setRemittanceServerRunActive] = useState(false)
    const [remittanceProgress, setRemittanceProgress] = useState(0)
    const [remittanceProgressLabel, setRemittanceProgressLabel] = useState('대기 중')
    const [remittanceAttemptsRemaining, setRemittanceAttemptsRemaining] = useState<number | null>(null)
    const [remittanceLockedUntil, setRemittanceLockedUntil] = useState<number | null>(null)
    const [remittanceLockTick, setRemittanceLockTick] = useState(0)
    const [remittancePricingSummary, setRemittancePricingSummary] = useState<RemittancePricingSummary | null>(null)
    const [remittancePricingSummaryOrderId, setRemittancePricingSummaryOrderId] = useState<string | null>(null)
    const [remittanceSaveInfo, setRemittanceSaveInfo] = useState<{ orderNumber: string; savedAt: string } | null>(null)
    const [remittanceSaveWarning, setRemittanceSaveWarning] = useState('')
    const [activeWormOrder, setActiveWormOrder] = useState<WormOrderSnapshot | null>(null)
    const [wormOrderList, setWormOrderList] = useState<WormOrderListItem[]>([])
    const [selectedWormOrderYearMonth, setSelectedWormOrderYearMonth] = useState('')
    const [wormOrderListLoading, setWormOrderListLoading] = useState(false)
    const [wormOrderListError, setWormOrderListError] = useState('')
    const [deletingWormOrderId, setDeletingWormOrderId] = useState<string | null>(null)
    const [importingWormOrderId, setImportingWormOrderId] = useState<string | null>(null)
    const [remittanceCandidates, setRemittanceCandidates] = useState<RemittanceCandidate[] | null>(null)
    const [remittanceCandidatesOrder, setRemittanceCandidatesOrder] = useState<WormOrderListItem | null>(null)
    const [remittanceCandidatePicking, setRemittanceCandidatePicking] = useState<string | null>(null)
    const [remittanceCandidateError, setRemittanceCandidateError] = useState('')
    const [manualRemittanceOrder, setManualRemittanceOrder] = useState<WormOrderListItem | null>(null)
    const [manualRemittanceForm, setManualRemittanceForm] = useState({
        appliedAt: '',
        finalReceiveAmountUsd: '',
        sendAmountKrw: '',
        totalFeeKrw: '',
        exchangeRate: '',
    })
    const [manualRemittanceSaving, setManualRemittanceSaving] = useState(false)
    const [manualRemittanceError, setManualRemittanceError] = useState('')
    const [blNumberQuery, setBlNumberQuery] = useState('')
    const [customsProgressResult, setCustomsProgressResult] = useState<CustomsProgressResult | null>(null)
    const [customsProgressError, setCustomsProgressError] = useState('')
    const [customsProgressLoading, setCustomsProgressLoading] = useState(false)
    const [pendingCustomsLookupBlNo, setPendingCustomsLookupBlNo] = useState('')
    const orderSectionRef = useRef<HTMLDivElement>(null)
    const inboxSectionRef = useRef<HTMLDivElement>(null)
    const docInboxSectionRef = useRef<HTMLDivElement>(null)
    const remittanceSectionRef = useRef<HTMLDivElement>(null)
    const customsProgressSectionRef = useRef<HTMLDivElement>(null)
    const cargoCustomsMailSectionRef = useRef<HTMLDivElement>(null)
    const remittanceProgressTimerRef = useRef<number | null>(null)
    const remittanceRequestAbortControllerRef = useRef<AbortController | null>(null)
    const remittanceCancelRequestedRef = useRef(false)
    const invoicePreviewUrlRef = useRef<string | null>(null)
    const invoicePreviewTaskIdRef = useRef(0)
    const customsProgressCacheRef = useRef<Map<string, { savedAt: number; result: CustomsProgressResult | null; error: string }>>(new Map())
    const calendarWeatherRequestIdRef = useRef(0)
    const activeWormOrderIdRef = useRef<string | null>(null)
    const lastAutoCustomsLookupKeyRef = useRef('')
    const hasLoadedWormOrdersRef = useRef(false)
    const lastResetWormOrderIdRef = useRef<string | null | undefined>(undefined)
    const emailFetchRequestIdRef = useRef(0)
    const matchedEmailRestoreRequestIdRef = useRef(0)
    const emailDetailRequestIdRef = useRef(0)
    const docEmailFetchRequestIdRef = useRef(0)
    const docEmailDetailRequestIdRef = useRef(0)
    const forwardLogsRequestIdRef = useRef(0)
    const customsProgressRequestIdRef = useRef(0)
    const awbOcrRequestIdRef = useRef(0)
    const lastActivePipelineStepRef = useRef<number | null>(null)
    const awbOcrWorkerRef = useRef<TesseractWorker | null>(null)
    const awbOcrWorkerPromiseRef = useRef<Promise<TesseractWorker> | null>(null)
    const awbOcrProgressReporterRef = useRef<(label: string) => void>(() => undefined)

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
    const [unmatchingEmailUid, setUnmatchingEmailUid] = useState<string | null>(null)
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
    const [dbMatchedEmails, setDbMatchedEmails] = useState<MatchedWormEmailPayload>(() => createEmptyMatchedWormEmailPayload())

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
        setDocEmails((prev) => prev.map((email) => (
            email.uid === uid
                ? { ...email, awbNumber: normalizedAwb }
                : email
        )))
        setDocEmailDetails((prev) => (
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

    const applyAwbToCustomsLookup = useCallback((awb: string, options?: { runLookup?: boolean }) => {
        const normalizedAwb = normalizeCustomsBlNo(awb)
        if (!normalizedAwb) return

        setBlNumberQuery(normalizedAwb)
        setCustomsProgressError('')
        setCustomsProgressResult(null)

        if (options?.runLookup !== false) {
            setPendingCustomsLookupBlNo(normalizedAwb)
        }
    }, [])

    const persistAwbCache = useCallback(async (
        uid: string,
        awb: string,
        emailMeta?: Pick<WormEmailDetail, 'subject' | 'date'> | null,
    ) => {
        const normalizedAwb = awb.replace(/\s+/g, '').trim()
        if (!uid || !normalizedAwb) return

        const fallbackEmail = emails.find((email) => email.uid === uid)
            || docEmails.find((email) => email.uid === uid)
            || null
        applyAwbNumberToEmailState(uid, normalizedAwb)
        applyAwbToCustomsLookup(normalizedAwb)
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
            const result = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : 'Failed to save AWB cache.')
            }
            setAwbMonitorNotice(
                result?.monitor?.notifiedAt
                    ? '유니패스 수입신고 수리 완료 알림이 발송되었습니다.'
                    : '유니패스 자동 모니터링 등록됨 · 수입신고 수리 완료 시 contact@beiko.com으로 알립니다.',
            )
        } catch (error) {
            console.warn('Failed to persist AWB cache:', error)
            setAwbMonitorNotice('AWB는 확인했지만 유니패스 자동 모니터링 등록에 실패했습니다.')
        }
    }, [applyAwbNumberToEmailState, applyAwbToCustomsLookup, emails, docEmails])

    // ── AWB OCR 관련 State ──
    const [awbNumber, setAwbNumber] = useState<string | null>(null)
    const [awbLoading, setAwbLoading] = useState(false)
    const [awbProgressLabel, setAwbProgressLabel] = useState('')
    const [awbError, setAwbError] = useState('')
    const [awbCandidates, setAwbCandidates] = useState<AwbCandidate[]>([])
    const [awbMonitorNotice, setAwbMonitorNotice] = useState('')
    const [awbScanMode, setAwbScanMode] = useState<AwbScanMode>('fast')
    const [awbManualInput, setAwbManualInput] = useState('')
    const [awbCopied, setAwbCopied] = useState(false)

    useEffect(() => {
        if (!awbNumber || awbLoading) return

        const controller = new AbortController()
        fetch(`/api/admin/worm-order/customs-monitor?awbNumber=${encodeURIComponent(awbNumber)}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json().catch(() => null)
                if (!response.ok) throw new Error(result?.error || '모니터링 상태 조회 실패')
                return result?.monitor || null
            })
            .then((monitor) => {
                if (!monitor) return
                if (monitor.notifiedAt || monitor.status === 'COMPLETED') {
                    setAwbMonitorNotice('수입신고 수리 완료 · contact@beiko.com 알림 발송 완료')
                    return
                }
                const progress = typeof monitor.lastStatus === 'string' && monitor.lastStatus
                    ? ` · ${monitor.lastStatus}`
                    : ' · 유니패스 조회 대기'
                setAwbMonitorNotice(`유니패스 자동 모니터링 중${progress}`)
            })
            .catch((error) => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                console.warn('Failed to load AWB monitor status:', error)
            })

        return () => controller.abort()
    }, [awbLoading, awbNumber])

    // ── 관세사 메일 전달 관련 State ──
    const [forwardEmail, setForwardEmail] = useState(DEFAULT_CUSTOMS_FORWARD_EMAIL)
    const [forwarding, setForwarding] = useState(false)
    const [forwardError, setForwardError] = useState('')
    const [forwardSuccess, setForwardSuccess] = useState('')
    const [forwardLogs, setForwardLogs] = useState<WormForwardLogItem[]>([])
    const [forwardLogsLoading, setForwardLogsLoading] = useState(false)
    const [forwardLogsError, setForwardLogsError] = useState('')

    useEffect(() => {
        activeWormOrderIdRef.current = activeWormOrder?.id ?? null
    }, [activeWormOrder?.id])

    useEffect(() => {
        if (!hasLoadedWormOrdersRef.current && !activeWormOrder?.id) return
        writeStoredActiveWormOrderId(activeWormOrder?.id ?? null)
        writeUrlActiveWormOrderId(activeWormOrder?.id ?? null)
    }, [activeWormOrder?.id])

    const loadForwardLogs = useCallback(async (orderId: string) => {
        if (!orderId) return
        const requestId = ++forwardLogsRequestIdRef.current
        setForwardLogsLoading(true)
        setForwardLogsError('')
        try {
            const query = new URLSearchParams({
                orderId,
                limit: '20',
            })
            const res = await fetch(`/api/admin/worm-order/emails/forward?${query.toString()}`, { cache: 'no-store' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                throw new Error(typeof data?.error === 'string' ? data.error : '발송 이력을 불러오지 못했습니다.')
            }
            const nextLogs = Array.isArray(data?.logs) ? data.logs : []
            if (requestId !== forwardLogsRequestIdRef.current || activeWormOrderIdRef.current !== orderId) return
            setForwardLogs(nextLogs)
        } catch (error) {
            if (requestId !== forwardLogsRequestIdRef.current || activeWormOrderIdRef.current !== orderId) return
            setForwardLogsError(error instanceof Error ? error.message : '발송 이력을 불러오지 못했습니다.')
        } finally {
            if (requestId === forwardLogsRequestIdRef.current && activeWormOrderIdRef.current === orderId) {
                setForwardLogsLoading(false)
            }
        }
    }, [])

    useEffect(() => {
        if (!activeWormOrder?.id) {
            forwardLogsRequestIdRef.current += 1
            setForwardLogs([])
            setForwardLogsLoading(false)
            setForwardLogsError('')
            return
        }
        void loadForwardLogs(activeWormOrder.id)
    }, [activeWormOrder?.id, loadForwardLogs])

    const handleForwardEmail = async () => {
        if (!forwardEmail.trim()) {
            setForwardError('받을 이메일 주소를 입력해주세요.')
            return
        }
        if (!matchedInvoiceEmail?.uid || !matchedAwbUid) {
            setForwardError('인보이스/AWB 메일 매칭이 완료된 후 발송할 수 있습니다.')
            return
        }
        setForwarding(true)
        setForwardError('')
        setForwardSuccess('')

        try {
            const res = await fetch('/api/admin/worm-order/emails/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uids: [matchedInvoiceEmail.uid, matchedAwbUid],
                    toEmail: forwardEmail.trim(),
                    orderId: activeWormOrder?.id || null,
                    forwardDate: customsForwardDate || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '이메일 전달 실패')
            if (typeof data?.warning === 'string' && data.warning.trim()) {
                setForwardError(data.warning)
            }
            setForwardSuccess('메일과 첨부파일이 지정된 주소로 성공적으로 전달되었습니다.')
            if (activeWormOrder?.id) {
                await loadForwardLogs(activeWormOrder.id)
            }
            setTimeout(() => setForwardSuccess(''), 5000)
        } catch (error: unknown) {
            setForwardError(error instanceof Error ? error.message : '이메일 전달에 실패했습니다.')
        } finally {
            setForwarding(false)
        }
    }

    // ── 자동 페치 & 게이지 관련 State ──
    const [fetchProgress, setFetchProgress] = useState(0)
    const [selectedPipelineStepId, setSelectedPipelineStepId] = useState(1)
    const [orderListOpen, setOrderListOpen] = useState(false)
    const [manualStepSaving, setManualStepSaving] = useState(false)
    const [manualStepNotice, setManualStepNotice] = useState('')

    const getAwbOcrWorker = useCallback(async (onProgress: (label: string) => void) => {
        awbOcrProgressReporterRef.current = onProgress
        if (awbOcrWorkerRef.current) return awbOcrWorkerRef.current
        if (awbOcrWorkerPromiseRef.current) return awbOcrWorkerPromiseRef.current

        onProgress('문자 인식 엔진을 준비하는 중...')
        const promise = Tesseract.createWorker('eng', 1, {
            logger: (message) => {
                if (message.status === 'recognizing text' && typeof message.progress === 'number') {
                    awbOcrProgressReporterRef.current(`이미지 문자 인식 중... ${Math.round(message.progress * 100)}%`)
                }
            },
        }).then(async (worker) => {
            await worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
                preserve_interword_spaces: '1',
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._:/ ',
            } as Parameters<TesseractWorker['setParameters']>[0])
            awbOcrWorkerRef.current = worker
            return worker
        }).finally(() => {
            awbOcrWorkerPromiseRef.current = null
        })
        awbOcrWorkerPromiseRef.current = promise
        return promise
    }, [])

    const cancelAwbOcr = useCallback(() => {
        awbOcrRequestIdRef.current += 1
        setAwbLoading(false)
        setAwbProgressLabel('')
        const worker = awbOcrWorkerRef.current
        awbOcrWorkerRef.current = null
        awbOcrWorkerPromiseRef.current = null
        if (worker) void worker.terminate().catch(() => undefined)
    }, [])

    useEffect(() => () => {
        const worker = awbOcrWorkerRef.current
        awbOcrWorkerRef.current = null
        if (worker) void worker.terminate().catch(() => undefined)
    }, [])

    useEffect(() => {
        if (!docHasFetched || awbOcrWorkerRef.current || awbOcrWorkerPromiseRef.current) return
        const timeoutId = window.setTimeout(() => {
            void getAwbOcrWorker(() => undefined).catch(() => undefined)
        }, 800)
        return () => window.clearTimeout(timeoutId)
    }, [docHasFetched, getAwbOcrWorker])

    // ── 메일 선택 시 SKM 첨부파일 OCR 자동 실행 ──
    const ocrOnePdf = useCallback(async (
        uid: string,
        attIndex: number,
        onProgress: (label: string) => void,
        mode: AwbScanMode,
    ): Promise<AwbCandidate[]> => {
        onProgress('첨부 문서를 불러오는 중...')
        const params = new URLSearchParams({ uid, index: String(attIndex), raw: '1', inline: '1' })
        const res = await fetch(`/api/admin/worm-order/emails/attachment?${params.toString()}`, {
            cache: 'no-store',
        })
        if (!res.ok) {
            const payload = await res.json().catch(() => null)
            throw new Error(payload?.error || `첨부 문서를 불러오지 못했습니다. (HTTP ${res.status})`)
        }
        const blob = await res.blob()
        if (blob.size === 0) throw new Error('첨부 문서가 비어 있습니다.')

        onProgress('PDF 문서를 분석하는 중...')
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        const byValue = new Map<string, AwbCandidate>()
        const pageLimit = mode === 'fast' ? Math.min(pdf.numPages, 1) : Math.min(pdf.numPages, 3)

        // 텍스트 레이어가 있으면 무거운 이미지 OCR을 실행하지 않는다.
        for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
            const page = await pdf.getPage(pageNum)
            try {
                const textContent = await page.getTextContent()
                const pageText = (textContent.items || [])
                    .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
                    .filter(Boolean)
                    .join('\n')
                const textCandidates = extractAwbCandidatesFromText(
                    pageText,
                    `file=${attIndex},page=${pageNum},text`,
                    130,
                )
                for (const candidate of textCandidates) mergeAwbCandidate(byValue, candidate)
            } catch (error) {
                console.warn(`[AWB OCR] text-layer parse failed file=${attIndex},page=${pageNum}`, error)
            }
        }

        const textRanked = Array.from(byValue.values()).sort((a, b) => b.score - a.score)
        if (bestTrustedAwbCandidate(textRanked)) return textRanked

        let worker: TesseractWorker | null = null
        for (let pageNum = 1; pageNum <= pageLimit; pageNum++) {
                onProgress(`PDF ${pageNum}/${pageLimit}페이지를 빠르게 읽는 중...`)
                const page = await pdf.getPage(pageNum)
                const baseScale = mode === 'fast' ? 1.55 : 2.2
                const maxDimension = mode === 'fast' ? 1800 : 2800
                const initialViewport = page.getViewport({ scale: baseScale })
                const scaleRatio = Math.min(1, maxDimension / Math.max(initialViewport.width, initialViewport.height))
                const viewport = scaleRatio < 1 ? page.getViewport({ scale: baseScale * scaleRatio }) : initialViewport
                const canvas = document.createElement('canvas')
                canvas.width = Math.max(1, Math.floor(viewport.width))
                canvas.height = Math.max(1, Math.floor(viewport.height))
                const ctx = canvas.getContext('2d')!
                await page.render({ canvasContext: ctx, viewport }).promise

                onProgress('AWB 바코드를 확인하는 중...')
                const barcodeCandidates = await detectAwbBarcodeCandidates(canvas, `file=${attIndex},page=${pageNum}`)
                for (const candidate of barcodeCandidates) mergeAwbCandidate(byValue, candidate)
                const barcodeRanked = Array.from(byValue.values()).sort((left, right) => right.score - left.score)
                if (bestTrustedAwbCandidate(barcodeRanked)) return barcodeRanked

                const fullBinary = createCanvasFromSource(canvas)
                applyBinaryThreshold(fullBinary, 165)
                const topRaw = createTopCropCanvas(canvas, mode === 'fast' ? 0.48 : 0.42)
                const topBinary = createCanvasFromSource(topRaw)
                applyBinaryThreshold(topBinary, 165)

                const variants: Array<{ name: string; canvas: HTMLCanvasElement; boost: number }> = mode === 'fast'
                    ? [{ name: 'ocr-fast-top', canvas: topBinary, boost: 180 }]
                    : [
                        { name: 'ocr-top-raw', canvas: topRaw, boost: 100 },
                        { name: 'ocr-top-binary', canvas: topBinary, boost: 140 },
                        { name: 'ocr-full-binary', canvas: fullBinary, boost: 60 },
                    ]

                for (const variant of variants) {
                    worker ||= await getAwbOcrWorker(onProgress)
                    const result = await worker.recognize(variant.canvas)
                    const ocrText = result.data.text || ''

                    const candidates = extractAwbCandidatesFromText(
                        ocrText,
                        `file=${attIndex},page=${pageNum},${variant.name}`,
                        variant.boost,
                    )
                    for (const c of candidates) {
                        mergeAwbCandidate(byValue, c)
                    }

                    const currentRanked = Array.from(byValue.values()).sort((a, b) => b.score - a.score)
                    if (bestTrustedAwbCandidate(currentRanked)) return currentRanked
                }
            }

        return Array.from(byValue.values()).sort((a, b) => b.score - a.score)
    }, [getAwbOcrWorker])

    const runAwbOcr = useCallback(async (
        emailMeta: Pick<WormEmailDetail, 'uid' | 'subject' | 'date' | 'skmIndices'>,
        mode: AwbScanMode = 'fast',
    ) => {
        const requestId = ++awbOcrRequestIdRef.current
        setAwbNumber(null)
        setAwbLoading(true)
        setAwbScanMode(mode)
        setAwbProgressLabel(mode === 'fast' ? 'AWB 빠른 분석을 시작합니다...' : 'AWB 정밀 분석을 시작합니다...')
        setAwbError('')
        setAwbCandidates([])
        setAwbMonitorNotice('')
        try {
            const byValue = new Map<string, AwbCandidate>()
            const targetIndexes = mode === 'fast' ? emailMeta.skmIndices.slice(0, 1) : emailMeta.skmIndices
            for (const idx of targetIndexes) {
                const foundList = await ocrOnePdf(emailMeta.uid, idx, setAwbProgressLabel, mode)
                for (const c of foundList) {
                    mergeAwbCandidate(byValue, c)
                }
                if (bestTrustedAwbCandidate(Array.from(byValue.values()))) break
            }

            const ranked = Array.from(byValue.values()).sort((a, b) => b.score - a.score)
            if (requestId !== awbOcrRequestIdRef.current) return
            setAwbCandidates(ranked.filter((candidate) => isValidAwbByCheckDigit(candidate.value)).slice(0, 6))

            const trusted = bestTrustedAwbCandidate(ranked)
            if (trusted) {
                const resolvedAwb = trusted.value
                setAwbNumber(resolvedAwb)
                await persistAwbCache(emailMeta.uid, resolvedAwb, emailMeta)
                return
            }

            setAwbError(mode === 'fast'
                ? '빠른 분석에서 AWB를 찾지 못했습니다. 정밀 재스캔 또는 직접 입력을 사용해주세요.'
                : '정밀 분석에서도 AWB를 확정하지 못했습니다. 후보를 선택하거나 직접 입력해주세요.')
        } catch (error: unknown) {
            if (requestId !== awbOcrRequestIdRef.current) return
            console.error('AWB OCR Error:', error)
            setAwbError(error instanceof Error ? error.message : 'OCR 처리 실패')
        } finally {
            if (requestId === awbOcrRequestIdRef.current) {
                setAwbLoading(false)
                setAwbProgressLabel('')
            }
        }
    }, [ocrOnePdf, persistAwbCache])

    const fetchEmailDetail = useCallback(async (uid: string): Promise<WormEmailDetail | null> => {
        const cachedDetail = emailDetails[uid]
        if (cachedDetail && cachedDetail.text.trim().length > 0) {
            return cachedDetail
        }

        const requestId = ++emailDetailRequestIdRef.current
        setLoadingEmailDetail(true)
        try {
            const res = await fetch(`/api/admin/worm-order/emails/detail?uid=${encodeURIComponent(uid)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '메일 상세 조회 실패')

            if (requestId !== emailDetailRequestIdRef.current) return null
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
        } catch (error: unknown) {
            if (requestId !== emailDetailRequestIdRef.current) return null
            setEmailError(error instanceof Error ? error.message : '메일 상세 조회 실패')
            return null
        } finally {
            if (requestId === emailDetailRequestIdRef.current) {
                setLoadingEmailDetail(false)
            }
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
        setAwbProgressLabel('')
        setAwbError('')
        setAwbMonitorNotice('')
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

            await page.render({ canvasContext, viewport }).promise
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
            const response = await fetch('/api/admin/worm-order/orders?limit=500', {
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

            const storedActiveOrderId = readStoredActiveWormOrderId()
            const urlActiveOrderId = readUrlActiveWormOrderId()
            const toOrderSnapshot = (order: WormOrderListItem): WormOrderSnapshot => ({
                id: order.id,
                orderNumber: order.orderNumber,
                receiveDate: toKstDateInputString(order.receiveDate) || '',
            })

            hasLoadedWormOrdersRef.current = true
            setWormOrderList(nextList)
            setActiveWormOrder((prev) => {
                const preferredOrderId = urlActiveOrderId || prev?.id || storedActiveOrderId

                if (preferredOrderId) {
                    const matched = nextList.find((item) => item.id === preferredOrderId)
                    if (matched) {
                        const receiveDateText = toKstDateInputString(matched.receiveDate) || prev?.receiveDate || ''
                        return {
                            id: matched.id,
                            orderNumber: matched.orderNumber,
                            receiveDate: receiveDateText,
                        }
                    }
                }

                const latest = nextList[0]
                if (!latest) return null
                return toOrderSnapshot(latest)
            })
        } catch (error) {
            setWormOrderListError(error instanceof Error ? error.message : '발주 리스트를 불러오지 못했습니다.')
        } finally {
            if (!silent) {
                setWormOrderListLoading(false)
            }
        }
    }, [])

    const resetOrderScopedUiState = useCallback(() => {
        emailFetchRequestIdRef.current += 1
        matchedEmailRestoreRequestIdRef.current += 1
        emailDetailRequestIdRef.current += 1
        docEmailFetchRequestIdRef.current += 1
        docEmailDetailRequestIdRef.current += 1
        forwardLogsRequestIdRef.current += 1
        customsProgressRequestIdRef.current += 1
        awbOcrRequestIdRef.current += 1
        invoicePreviewTaskIdRef.current += 1

        if (remittanceProgressTimerRef.current) {
            window.clearInterval(remittanceProgressTimerRef.current)
            remittanceProgressTimerRef.current = null
        }
        setQuantitiesByType(createInitialQuantitiesByType())
        setGeneratedMessage('')
        setValidationError('')
        setOrderCreateError('')
        setOrderCreateNotice('')
        setCopied(false)

        setEmails([])
        setEmailDetails({})
        setSelectedEmailUid(null)
        setHasFetched(false)
        setLoadingEmails(false)
        setLoadingEmailDetail(false)
        setMatchingEmailUid(null)
        setUnmatchingEmailUid(null)
        setInvoiceOcrRunningUid(null)
        setEmailError('')
        setEmailMatchMessage('')
        setFetchProgress(0)
        setEmailCacheSavedAt(null)
        setUsingOfflineEmailCache(false)

        setDocEmails([])
        setDocEmailDetails({})
        setSelectedDocEmailUid(null)
        setDocHasFetched(false)
        setDbMatchedEmails(createEmptyMatchedWormEmailPayload())
        setLoadingDocEmails(false)
        setLoadingDocEmailDetail(false)
        setMatchingDocEmailUid(null)
        setUnmatchingDocEmailUid(null)
        setDocEmailError('')
        setDocEmailMatchMessage('')
        setDocFetchProgress(0)

        setAwbNumber(null)
        setAwbLoading(false)
        setAwbError('')
        setAwbCandidates([])

        setBlNumberQuery('')
        setCustomsProgressResult(null)
        setCustomsProgressError('')
        setCustomsProgressLoading(false)

        setForwardError('')
        setForwardSuccess('')
        setForwardLogs([])
        setForwardLogsLoading(false)
        setForwardLogsError('')
        setForwardEmail(DEFAULT_CUSTOMS_FORWARD_EMAIL)

        setTransferAmountUsd('')
        setInvoicePdf(null)
        setUseManualRemittanceInput(false)
        setInvoicePreviewLoading(false)
        setInvoicePreviewError('')
        replaceInvoicePreviewUrl(null)

        setRemittanceError('')
        setRemittanceSuccess('')
        setRemittanceProgress(0)
        setRemittanceProgressLabel('대기 중')
        setRemittanceAttemptsRemaining(null)
        setRemittanceLockedUntil(null)
        setRemittancePricingSummary(null)
        setRemittancePricingSummaryOrderId(null)
        setRemittanceSaveInfo(null)
        setRemittanceSaveWarning('')
        setRemittanceCandidates(null)
        setRemittanceCandidatesOrder(null)
        setRemittanceCandidatePicking(null)
        setRemittanceCandidateError('')
        setManualRemittanceOrder(null)
        setManualRemittanceForm({
            appliedAt: '',
            finalReceiveAmountUsd: '',
            sendAmountKrw: '',
            totalFeeKrw: '',
            exchangeRate: '',
        })
        setManualRemittanceError('')

    }, [replaceInvoicePreviewUrl])

    const restoreMatchedEmailsForOrder = useCallback(async (order: WormOrderSnapshot) => {
        const requestId = ++matchedEmailRestoreRequestIdRef.current
        const orderId = order.id

        try {
            const response = await fetch(`/api/admin/worm-order/emails/matched?orderId=${encodeURIComponent(orderId)}`, {
                cache: 'no-store',
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '매칭된 메일을 불러오지 못했습니다.')
            }
            if (requestId !== matchedEmailRestoreRequestIdRef.current || activeWormOrderIdRef.current !== orderId) return

            const payload = sanitizeMatchedWormEmailPayload(result)
            setDbMatchedEmails(payload)

            setEmails(payload.invoiceEmails)
            setEmailDetails(payload.invoiceEmailDetails)
            setSelectedEmailUid(payload.invoiceEmails[0]?.uid || null)
            setHasFetched(payload.invoiceEmails.length > 0)
            if (payload.invoiceEmails.length > 0) {
                setEmailMatchMessage(`DB에 저장된 매칭 인보이스 메일 ${payload.invoiceEmails.length}건을 불러왔습니다.`)
            }
            setUsingOfflineEmailCache(false)
            setEmailCacheSavedAt(null)

            setDocEmails(payload.awbDocumentEmails)
            setDocEmailDetails(payload.awbDocumentEmailDetails)
            setSelectedDocEmailUid(payload.awbDocumentEmails[0]?.uid || null)
            setDocHasFetched(payload.awbDocumentEmails.length > 0)
            if (payload.awbDocumentEmails.length > 0) {
                setDocEmailMatchMessage(`DB에 저장된 매칭 AWB 문서 메일 ${payload.awbDocumentEmails.length}건을 불러왔습니다.`)
            }

            const firstAwbEmail = payload.awbDocumentEmails.find((email) => email.awbNumber)
            const firstAwbUid = firstAwbEmail?.uid || payload.awbDocumentEmails[0]?.uid || null
            const restoredAwb = firstAwbEmail?.awbNumber
                || (firstAwbUid ? payload.awbDocumentEmailDetails[firstAwbUid]?.awbNumber : null)
                || null
            if (restoredAwb) {
                setAwbNumber(restoredAwb)
            }
        } catch (error) {
            if (requestId !== matchedEmailRestoreRequestIdRef.current || activeWormOrderIdRef.current !== orderId) return
            const message = error instanceof Error ? error.message : '매칭된 메일을 불러오지 못했습니다.'
            setEmailError(message)
            setDocEmailError(message)
        }
    }, [])

    useEffect(() => {
        const nextOrderId = activeWormOrder?.id ?? null
        if (lastResetWormOrderIdRef.current === nextOrderId) return

        lastResetWormOrderIdRef.current = nextOrderId
        resetOrderScopedUiState()
    }, [activeWormOrder?.id, resetOrderScopedUiState])

    useEffect(() => {
        if (!activeWormOrder?.id) return
        void restoreMatchedEmailsForOrder(activeWormOrder)
    }, [activeWormOrder?.id, restoreMatchedEmailsForOrder])

    const handleSelectWormOrder = useCallback((order: WormOrderListItem) => {
        const receiveDateText = toKstDateInputString(order.receiveDate)
        const isSameOrder = activeWormOrder?.id === order.id

        setActiveWormOrder({
            id: order.id,
            orderNumber: order.orderNumber,
            receiveDate: receiveDateText || '',
        })
        writeStoredActiveWormOrderId(order.id)
        writeUrlActiveWormOrderId(order.id)
        if (receiveDateText) {
            setReceiveDate(receiveDateText)
        }
        setOrderListOpen(false)
        setManualStepNotice('')

        // Keep already-fetched inbox state when user re-selects the same order.
        if (isSameOrder) return

        activeWormOrderIdRef.current = order.id
        lastResetWormOrderIdRef.current = order.id
        resetOrderScopedUiState()
    }, [activeWormOrder?.id, resetOrderScopedUiState])

    const handleImportRemittanceHistory = useCallback(async (order: WormOrderListItem) => {
        const shouldImport = window.confirm(
            `${order.orderNumber} 발주의 송금 정보를 모인 비즈플러스 거래내역에서 가져옵니다.\n\n` +
            `브라우저 자동화로 약 30~60초가 소요됩니다. 계속할까요?`,
        )
        if (!shouldImport) return

        setWormOrderListError('')
        setImportingWormOrderId(order.id)
        try {
            const response = await fetch('/api/admin/worm-order/remittance/history-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    targetDate: order.receiveDate
                        ? toKstDateInputString(order.receiveDate)
                        : null,
                }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.ok) {
                const items: RemittanceCandidate[] = Array.isArray(result?.items) ? result.items : []
                if (items.length > 0) {
                    setRemittanceCandidates(items.slice(0, 12))
                    setRemittanceCandidatesOrder(order)
                    setRemittanceCandidateError('')
                    return
                }
                const baseMsg = typeof result?.error === 'string' ? result.error : '송금 정보 가져오기에 실패했습니다.'
                throw new Error(`${baseMsg}${formatMoinDiagnosticSuffix(result?.diagnostic)}`)
            }
            await fetchWormOrders()
            alert(result?.message || '송금 정보를 가져와 저장했습니다.')
        } catch (error) {
            setWormOrderListError(error instanceof Error ? error.message : '송금 정보 가져오기 중 오류가 발생했습니다.')
        } finally {
            setImportingWormOrderId(null)
        }
    }, [fetchWormOrders])

    const handlePickRemittanceCandidate = useCallback(async (candidate: RemittanceCandidate) => {
        const order = remittanceCandidatesOrder
        if (!order) return
        const transactionId = candidate.transactionId
        if (!transactionId) {
            setRemittanceCandidateError('이 후보는 거래 ID가 없어서 자동으로 가져올 수 없습니다. 직접 입력으로 저장해 주세요.')
            return
        }
        setRemittanceCandidateError('')
        setRemittanceCandidatePicking(transactionId)
        try {
            const response = await fetch('/api/admin/worm-order/remittance/history-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    transactionId,
                }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.ok) {
                const baseMsg = typeof result?.error === 'string' ? result.error : '선택한 거래에서 정보를 가져오지 못했습니다.'
                throw new Error(`${baseMsg}${formatMoinDiagnosticSuffix(result?.diagnostic)}`)
            }
            setRemittanceCandidates(null)
            setRemittanceCandidatesOrder(null)
            await fetchWormOrders()
            alert(result?.message || '송금 정보를 가져와 저장했습니다.')
        } catch (error) {
            setRemittanceCandidateError(error instanceof Error ? error.message : '선택한 거래 가져오기에 실패했습니다.')
        } finally {
            setRemittanceCandidatePicking(null)
        }
    }, [remittanceCandidatesOrder, fetchWormOrders])

    const openManualRemittanceModal = useCallback((order: WormOrderListItem) => {
        const initialAppliedAt = (() => {
            const base = order.remittanceAppliedAt
                ? new Date(order.remittanceAppliedAt)
                : (order.receiveDate ? new Date(order.receiveDate) : new Date())
            const offsetMs = base.getTimezoneOffset() * 60000
            return new Date(base.getTime() - offsetMs).toISOString().slice(0, 16)
        })()
        const parseLeadingNumber = (value: string | null) => {
            if (!value) return ''
            const match = value.match(/-?\d[\d,]*(?:\.\d+)?/)
            return match ? match[0].replace(/,/g, '') : ''
        }
        const parseTrailingRate = (value: string | null) => {
            if (!value) return ''
            const matches = value.match(/-?\d[\d,]*(?:\.\d+)?/g)
            if (!matches || matches.length === 0) return ''
            return matches[matches.length - 1].replace(/,/g, '')
        }
        setManualRemittanceOrder(order)
        setManualRemittanceForm({
            appliedAt: initialAppliedAt,
            finalReceiveAmountUsd: parseLeadingNumber(order.remittanceFinalReceiveAmountText),
            sendAmountKrw: order.remittanceSendAmount !== null
                ? String(order.remittanceSendAmount)
                : parseLeadingNumber(order.remittanceSendAmountText),
            totalFeeKrw: order.remittanceTotalFee !== null
                ? String(order.remittanceTotalFee)
                : parseLeadingNumber(order.remittanceTotalFeeText),
            exchangeRate: order.remittanceExchangeRate !== null
                ? String(order.remittanceExchangeRate)
                : parseTrailingRate(order.remittanceExchangeRateText),
        })
        setManualRemittanceError('')
    }, [])

    const handleSaveManualRemittance = useCallback(async () => {
        if (!manualRemittanceOrder) return
        setManualRemittanceSaving(true)
        setManualRemittanceError('')
        try {
            const appliedAtIso = manualRemittanceForm.appliedAt
                ? new Date(manualRemittanceForm.appliedAt).toISOString()
                : null
            const response = await fetch('/api/admin/worm-order/remittance/manual-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: manualRemittanceOrder.id,
                    appliedAt: appliedAtIso,
                    finalReceiveAmountUsd: manualRemittanceForm.finalReceiveAmountUsd || null,
                    sendAmountKrw: manualRemittanceForm.sendAmountKrw || null,
                    totalFeeKrw: manualRemittanceForm.totalFeeKrw || null,
                    exchangeRate: manualRemittanceForm.exchangeRate || null,
                }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok || !result?.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '저장에 실패했습니다.')
            }
            setManualRemittanceOrder(null)
            await fetchWormOrders()
        } catch (error) {
            setManualRemittanceError(error instanceof Error ? error.message : '저장에 실패했습니다.')
        } finally {
            setManualRemittanceSaving(false)
        }
    }, [manualRemittanceOrder, manualRemittanceForm, fetchWormOrders])

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

    const fetchEmails = async (forceRefresh = true) => {
        const requestId = ++emailFetchRequestIdRef.current
        const requestOrderId = activeWormOrder?.id || null
        setLoadingEmails(true)
        setEmailError('')
        setEmailMatchMessage('')
        setFetchProgress(0)
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 65000)

        // 가짜(Fake) 프로그레스 메이커 (로딩 중일 때 90%까지 꾸준히 증가)
        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setFetchProgress(currentProgress)
        }, 400)

        try {
            const params = new URLSearchParams()
            params.set('subjectKeyword', 'invoice,payment,documents for')
            if (forceRefresh) {
                params.set('forceRefresh', '1')
            }
            if (requestOrderId) {
                params.set('orderId', requestOrderId)
            }

            const res = await fetch(`/api/admin/worm-order/emails?${params.toString()}`, { signal: controller.signal })
            clearInterval(interval)
            if (requestId !== emailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return
            setFetchProgress(100) // 100% 꽉 채우기

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch emails')
            if (requestId !== emailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return
            
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
            setTimeout(() => {
                if (requestId === emailFetchRequestIdRef.current && activeWormOrderIdRef.current === requestOrderId) {
                    setFetchProgress(0)
                }
            }, 500)
        } catch (error: unknown) {
            clearInterval(interval)
            if (requestId !== emailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return
            setFetchProgress(0)
            const message = error instanceof Error && error.name === 'AbortError'
                ? 'Daum 메일 스캔 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
                : error instanceof Error ? error.message : 'Failed to fetch emails'
            const hasCachedEmails = emails.length > 0 || Object.keys(emailDetails).length > 0
            setEmailError(hasCachedEmails ? `${message} Showing saved email cache.` : message)
            setHasFetched(true)
            setUsingOfflineEmailCache(hasCachedEmails)
        } finally {
            window.clearTimeout(timeoutId)
            if (requestId === emailFetchRequestIdRef.current && activeWormOrderIdRef.current === requestOrderId) {
                setLoadingEmails(false)
            }
        }
    }

    const applyMatchResultToEmailState = useCallback((uid: string, fallbackOrder: WormOrderSnapshot, rawMatch: unknown) => {
        const matched = rawMatch as {
            matchType?: unknown
            subject?: unknown
            date?: unknown
            orderNumber?: unknown
            matchedAt?: unknown
            awbNumber?: unknown
            emailBodyText?: unknown
            attachmentsJson?: unknown
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
        const matchedMatchType = normalizeWormEmailMatchType(matched?.matchType) || 'INVOICE'
        const matchedAwbNumber = typeof matched?.awbNumber === 'string' ? matched.awbNumber : null

        setEmails((prev) =>
            prev.map((item) =>
                item.uid === uid
                    ? {
                        ...item,
                        matchType: matchedMatchType,
                        awbNumber: matchedAwbNumber || item.awbNumber,
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
        const attachments = Array.isArray(matched?.attachmentsJson)
            ? matched.attachmentsJson
                .map((attachment) => sanitizeWormEmailAttachment(attachment))
                .filter((attachment): attachment is WormEmailAttachment => attachment !== null)
            : []
        setEmailDetails((prev) => {
            const current = prev[uid]
            return {
                ...prev,
                [uid]: {
                    uid,
                    subject: typeof matched?.subject === 'string' && matched.subject
                        ? matched.subject
                        : current?.subject || '',
                    date: typeof matched?.date === 'string' && matched.date
                        ? matched.date
                        : current?.date || new Date().toISOString(),
                    text: typeof matched?.emailBodyText === 'string'
                        ? matched.emailBodyText
                        : current?.text || '',
                    hasAttachments: attachments.length > 0 || current?.hasAttachments || false,
                    skmIndices: attachments.filter(isPdfEmailAttachment).map((attachment) => attachment.index),
                    attachments: attachments.length > 0 ? attachments : current?.attachments || [],
                    awbNumber: matchedAwbNumber || current?.awbNumber || null,
                },
            }
        })
        setEmailCacheSavedAt(new Date().toISOString())
        return {
            matchedOrderNumber,
            ocrError: typeof matched?.invoiceOcrError === 'string' ? matched.invoiceOcrError : '',
        }
    }, [])

    const requestEmailMatchAndInvoiceOcr = useCallback(async (
        email: WormEmailListItem,
        targetOrder: WormOrderSnapshot,
        matchType: WormEmailMatchType = 'INVOICE',
    ) => {
        const response = await fetch('/api/admin/worm-order/emails/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: email.uid,
                orderId: targetOrder.id,
                matchType,
                subject: email.subject,
                date: email.date,
                awbNumber: email.awbNumber,
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
            void restoreMatchedEmailsForOrder(activeWormOrder)
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
                            matchType: null,
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
            if (activeWormOrder) {
                void restoreMatchedEmailsForOrder(activeWormOrder)
            }
        } catch (error) {
            setEmailError(error instanceof Error ? error.message : '매칭 해제 중 오류가 발생했습니다.')
        } finally {
            setUnmatchingEmailUid(null)
        }
    }

    // ── Document 메일 페치 ──
    const fetchDocumentEmails = async () => {
        const requestId = ++docEmailFetchRequestIdRef.current
        const requestOrderId = activeWormOrder?.id || null
        setLoadingDocEmails(true)
        setDocEmailError('')
        setDocFetchProgress(0)
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 65000)

        let currentProgress = 0
        const interval = setInterval(() => {
            currentProgress += Math.random() * 15
            if (currentProgress > 90) currentProgress = 90
            setDocFetchProgress(currentProgress)
        }, 400)

        try {
            const params = new URLSearchParams()
            params.set('subjectKeyword', [
                'documents',
                'documets',
                'document',
                'shipping documents',
                'shipment arrival',
                'shipment',
                'awb',
                'air waybill',
                'waybill',
                'payment invoice',
            ].join(','))
            params.set('forceRefresh', '1')
            if (requestOrderId) {
                params.set('orderId', requestOrderId)
            }

            const res = await fetch(`/api/admin/worm-order/emails?${params.toString()}`, { signal: controller.signal })
            clearInterval(interval)
            if (requestId !== docEmailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return
            setDocFetchProgress(100)

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch document emails')
            if (requestId !== docEmailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return

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
            setTimeout(() => {
                if (requestId === docEmailFetchRequestIdRef.current && activeWormOrderIdRef.current === requestOrderId) {
                    setDocFetchProgress(0)
                }
            }, 500)
        } catch (error: unknown) {
            clearInterval(interval)
            if (requestId !== docEmailFetchRequestIdRef.current || activeWormOrderIdRef.current !== requestOrderId) return
            setDocFetchProgress(0)
            setDocEmailError(error instanceof Error && error.name === 'AbortError'
                ? 'Daum 메일 스캔 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
                : error instanceof Error ? error.message : 'Failed to fetch document emails')
            setDocHasFetched(true)
        } finally {
            window.clearTimeout(timeoutId)
            if (requestId === docEmailFetchRequestIdRef.current && activeWormOrderIdRef.current === requestOrderId) {
                setLoadingDocEmails(false)
            }
        }
    }

    // ── Document 메일 상세 조회 ──
    const fetchDocEmailDetail = useCallback(async (uid: string): Promise<WormEmailDetail | null> => {
        if (docEmailDetails[uid]) return docEmailDetails[uid]

        const requestId = ++docEmailDetailRequestIdRef.current
        setLoadingDocEmailDetail(true)
        try {
            const res = await fetch(`/api/admin/worm-order/emails/detail?uid=${encodeURIComponent(uid)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '메일 상세 조회 실패')

            if (requestId !== docEmailDetailRequestIdRef.current) return null
            setDocEmailError('')
            setDocEmailDetails(prev => ({ ...prev, [uid]: data }))
            if (typeof data?.awbNumber === 'string' && data.awbNumber) {
                setDocEmails((prev) => prev.map((e) => e.uid === uid ? { ...e, awbNumber: data.awbNumber } : e))
                if (uid === selectedDocEmailUid) {
                    setAwbNumber(data.awbNumber)
                }
            }
            return data
        } catch (error: unknown) {
            if (requestId !== docEmailDetailRequestIdRef.current) return null
            setDocEmailError(error instanceof Error ? error.message : '메일 상세 조회 실패')
            return null
        } finally {
            if (requestId === docEmailDetailRequestIdRef.current) {
                setLoadingDocEmailDetail(false)
            }
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
            const result = await requestEmailMatchAndInvoiceOcr(email, activeWormOrder, 'AWB_DOCUMENT')
            const awbExtraction = result?.awbExtraction as {
                status?: unknown
                awbNumber?: unknown
                attachmentIndexes?: unknown
            } | null
            const match = result?.match as {
                subject?: unknown
                date?: unknown
                orderNumber?: unknown
                matchedAt?: unknown
                awbNumber?: unknown
                emailBodyText?: unknown
                attachmentsJson?: unknown
            } | null
            const matchedAt = typeof match?.matchedAt === 'string' ? match.matchedAt : new Date().toISOString()
            const matchedOrderNumber = typeof match?.orderNumber === 'string' && match.orderNumber
                ? match.orderNumber
                : activeWormOrder.orderNumber
            const matchedAwbNumber = typeof match?.awbNumber === 'string' ? match.awbNumber : email.awbNumber
            const attachments = Array.isArray(match?.attachmentsJson)
                ? match.attachmentsJson
                    .map((attachment) => sanitizeWormEmailAttachment(attachment))
                    .filter((attachment): attachment is WormEmailAttachment => attachment !== null)
                : []
            setDocEmails(prev => prev.map(item =>
                item.uid === email.uid
                    ? {
                        ...item,
                        matchType: 'AWB_DOCUMENT',
                        awbNumber: matchedAwbNumber || item.awbNumber,
                        matchedOrderId: activeWormOrder.id,
                        matchedOrderNumber,
                        matchedAt,
                    }
                    : item
            ))
            setDocEmailDetails((prev) => {
                const current = prev[email.uid]
                return {
                    ...prev,
                    [email.uid]: {
                        uid: email.uid,
                        subject: typeof match?.subject === 'string' && match.subject
                            ? match.subject
                            : current?.subject || email.subject,
                        date: typeof match?.date === 'string' && match.date
                            ? match.date
                            : current?.date || email.date,
                        text: typeof match?.emailBodyText === 'string'
                            ? match.emailBodyText
                            : current?.text || '',
                        hasAttachments: attachments.length > 0 || current?.hasAttachments || email.hasAttachments,
                        skmIndices: attachments.filter(isPdfEmailAttachment).map((attachment) => attachment.index),
                        attachments: attachments.length > 0 ? attachments : current?.attachments || [],
                        awbNumber: matchedAwbNumber || current?.awbNumber || null,
                    },
                }
            })
            setSelectedDocEmailUid(email.uid)
            if (matchedAwbNumber) {
                setAwbNumber(matchedAwbNumber)
                setAwbMonitorNotice('유니패스 자동 모니터링 등록됨 · 수입신고 수리 완료 시 contact@beiko.com으로 알립니다.')
                setDocEmailMatchMessage(`매칭 및 AWB 추출 완료: ${matchedOrderNumber}`)
            } else {
                setDocEmailMatchMessage(`매칭 완료: ${matchedOrderNumber} · AWB 빠른 분석 시작`)
                const extractionIndexes = Array.isArray(awbExtraction?.attachmentIndexes)
                    ? awbExtraction.attachmentIndexes.filter((value): value is number => Number.isInteger(value))
                    : []
                const skmIndices = extractionIndexes.length > 0
                    ? extractionIndexes
                    : attachments.filter(isPdfEmailAttachment).map((attachment) => attachment.index)
                if (skmIndices.length > 0) {
                    void runAwbOcr({
                        uid: email.uid,
                        subject: typeof match?.subject === 'string' ? match.subject : email.subject,
                        date: typeof match?.date === 'string' ? match.date : email.date,
                        skmIndices,
                    }, 'fast')
                } else {
                    setAwbError('AWB를 분석할 PDF 첨부파일이 없습니다. 번호를 직접 입력해주세요.')
                }
            }
            void restoreMatchedEmailsForOrder(activeWormOrder)
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
                    ? { ...item, matchType: null, matchedOrderId: null, matchedOrderNumber: null, matchedAt: null }
                    : item
            ))
            setDocEmailMatchMessage(`매칭 해제 완료: ${email.matchedOrderNumber || email.uid}`)
            if (activeWormOrder) {
                void restoreMatchedEmailsForOrder(activeWormOrder)
            }
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
        setAwbProgressLabel('')
        setAwbError('')
        setAwbMonitorNotice('')
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
        void runAwbOcr({
            uid: selectedDocEmailUid,
            subject: detail.subject,
            date: detail.date,
            skmIndices: detail.skmIndices,
        }, 'fast')
    }, [selectedDocEmailUid, docEmailDetails, fetchDocEmailDetail, runAwbOcr])

    const handleRunPreciseDocAwbOcr = useCallback(async () => {
        if (!selectedDocEmailUid) return
        const detail = docEmailDetails[selectedDocEmailUid] || await fetchDocEmailDetail(selectedDocEmailUid)
        if (!detail?.skmIndices.length) {
            setAwbError('정밀 분석할 PDF 첨부파일이 없습니다.')
            return
        }
        void runAwbOcr({
            uid: selectedDocEmailUid,
            subject: detail.subject,
            date: detail.date,
            skmIndices: detail.skmIndices,
        }, 'precise')
    }, [selectedDocEmailUid, docEmailDetails, fetchDocEmailDetail, runAwbOcr])

    const handleSaveManualAwb = useCallback(async () => {
        if (!selectedDocEmailUid) return
        const normalized = normalizeOcrDigits(awbManualInput)
        if (!/^\d{11}$/.test(normalized)) {
            setAwbError('AWB 번호 11자리를 입력해주세요.')
            return
        }
        if (!isValidAwbByCheckDigit(normalized)) {
            setAwbError('체크디지트가 일치하지 않습니다. 입력한 번호를 다시 확인해주세요.')
            return
        }
        const detail = docEmailDetails[selectedDocEmailUid] || await fetchDocEmailDetail(selectedDocEmailUid)
        setAwbNumber(normalized)
        setAwbCandidates([])
        setAwbError('')
        await persistAwbCache(selectedDocEmailUid, normalized, detail)
        setAwbManualInput('')
    }, [awbManualInput, docEmailDetails, fetchDocEmailDetail, persistAwbCache, selectedDocEmailUid])

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
    const wormTypeTotals = useMemo(() => {
        return WORM_TYPES.map((wormType) => ({
            ...wormType,
            total: WORM_SIZES.reduce((sum, size) => sum + (quantitiesByType[wormType.id]?.[size.id] || 0), 0),
        }))
    }, [quantitiesByType])

    const todayDate = useMemo(() => {
        const parsed = parseYmdToLocalDate(today)
        const base = parsed || new Date()
        return new Date(base.getFullYear(), base.getMonth(), base.getDate())
    }, [today])

    const calendarDays = useMemo(
        () => buildMonthCalendarDays(calendarCursor.year, calendarCursor.month),
        [calendarCursor.month, calendarCursor.year],
    )
    const wormOrdersByReceiveDate = useMemo(() => {
        const grouped = new Map<string, WormOrderListItem[]>()
        wormOrderList.forEach((order) => {
            const ymd = toKstDateInputString(order.receiveDate)
            if (!ymd) return
            const orders = grouped.get(ymd) || []
            orders.push(order)
            grouped.set(ymd, orders)
        })
        return grouped
    }, [wormOrderList])
    const wormOrderMonthGroups = useMemo(() => {
        const groups = new Map<string, { year: string; month: string; count: number }>()
        wormOrderList.forEach((order) => {
            const ymd = toKstDateInputString(order.receiveDate)
            const ym = ymd.slice(0, 7)
            if (!/^\d{4}-\d{2}$/.test(ym)) return
            const prev = groups.get(ym)
            if (prev) {
                prev.count += 1
                return
            }
            const [year, month] = ym.split('-')
            groups.set(ym, { year, month, count: 1 })
        })
        return Array.from(groups.entries())
            .map(([value, group]) => ({ value, ...group }))
            .sort((a, b) => b.value.localeCompare(a.value))
    }, [wormOrderList])
    const selectedWormOrderMonth = useMemo(() => {
        if (selectedWormOrderYearMonth && wormOrderMonthGroups.some((group) => group.value === selectedWormOrderYearMonth)) {
            return selectedWormOrderYearMonth
        }
        return wormOrderMonthGroups[0]?.value || ''
    }, [selectedWormOrderYearMonth, wormOrderMonthGroups])
    const filteredWormOrderList = useMemo(() => {
        if (!selectedWormOrderMonth) return wormOrderList
        return wormOrderList.filter((order) => toKstDateInputString(order.receiveDate).startsWith(selectedWormOrderMonth))
    }, [selectedWormOrderMonth, wormOrderList])
    const selectedWormOrderMonthLabel = useMemo(() => {
        if (!selectedWormOrderMonth) return '전체'
        const [year, month] = selectedWormOrderMonth.split('-')
        return `${year}년 ${Number(month)}월`
    }, [selectedWormOrderMonth])
    const calendarRange = useMemo(() => {
        if (calendarDays.length === 0) {
            return { startDate: today, endDate: today }
        }
        const first = formatLocalDateToYmd(calendarDays[0].date)
        const last = formatLocalDateToYmd(calendarDays[calendarDays.length - 1].date)
        return { startDate: first, endDate: last }
    }, [calendarDays, today])

    const calendarMonthLabel = useMemo(() => {
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'long',
        }).format(new Date(calendarCursor.year, calendarCursor.month, 1))
    }, [calendarCursor.month, calendarCursor.year])
    const calendarMonthPriceInfo = useMemo(
        () => getCalendarMonthlyPriceInfo(calendarCursor.month + 1),
        [calendarCursor.month],
    )
    const selectedDatePriceInfo = useMemo(() => {
        const selected = parseYmdToLocalDate(receiveDate)
        if (!selected) return calendarMonthPriceInfo
        return getCalendarMonthlyPriceInfo(selected.getMonth() + 1) || calendarMonthPriceInfo
    }, [calendarMonthPriceInfo, receiveDate])

    useEffect(() => {
        const requestId = calendarWeatherRequestIdRef.current + 1
        calendarWeatherRequestIdRef.current = requestId
        const { startDate, endDate } = calendarRange
        setCalendarWeatherLoading(true)
        setCalendarWeatherError('')

        const query = new URLSearchParams({
            start: startDate,
            end: endDate,
            ts: String(Date.now()),
        })

        const fetchWeather = async () => {
            try {
                const response = await fetch(`/api/admin/worm-order/weather?${query.toString()}`, {
                    method: 'GET',
                    cache: 'no-store',
                })
                const result = await response.json().catch(() => ({}))

                let locations = Array.isArray(result?.locations) ? result.locations : []

                if (!response.ok || locations.length === 0) {
                    const fallbackRange = clampCalendarWeatherRange(startDate, endDate)
                    if (!fallbackRange) {
                        throw new Error(typeof result?.error === 'string' ? result.error : '날씨 정보를 불러오지 못했습니다.')
                    }
                    const fallbackSettled = await Promise.allSettled(
                        CALENDAR_WEATHER_LOCATION_CONFIGS.map(async (location) => {
                            const fallbackQuery = new URLSearchParams({
                                latitude: String(location.latitude),
                                longitude: String(location.longitude),
                                daily: 'weather_code,temperature_2m_max,temperature_2m_min',
                                timezone: location.timezone,
                                start_date: fallbackRange.startDate,
                                end_date: fallbackRange.endDate,
                            })
                            const fallbackResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${fallbackQuery.toString()}`, {
                                method: 'GET',
                                cache: 'no-store',
                            })
                            if (!fallbackResponse.ok) {
                                throw new Error(`fallback weather failed (${location.key}, ${fallbackResponse.status})`)
                            }
                            const fallbackPayload = await fallbackResponse.json()
                            const daily = fallbackPayload?.daily || {}
                            const dates = Array.isArray(daily?.time) ? daily.time : []
                            const weatherCodes = Array.isArray(daily?.weather_code) ? daily.weather_code : []
                            const maxTemps = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : []
                            const minTemps = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : []

                            return {
                                key: location.key,
                                daily: dates.map((date: unknown, index: number) => ({
                                    date,
                                    weatherCode: weatherCodes[index] ?? null,
                                    weatherText: toCalendarWeatherTextByCode(
                                        typeof weatherCodes[index] === 'number' && Number.isFinite(weatherCodes[index])
                                            ? weatherCodes[index]
                                            : null,
                                    ),
                                    maxTempC: maxTemps[index] ?? null,
                                    minTempC: minTemps[index] ?? null,
                                })),
                            }
                        }),
                    )

                    locations = fallbackSettled
                        .filter((entry): entry is PromiseFulfilledResult<{ key: CalendarWeatherLocationKey; daily: Array<Record<string, unknown>> }> => entry.status === 'fulfilled')
                        .map((entry) => entry.value)

                    const fallbackFailures = fallbackSettled
                        .filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected')
                        .map((entry) => entry.reason instanceof Error ? entry.reason.message : 'fallback weather failed')

                    const apiErrorMessage = typeof result?.error === 'string' ? result.error : ''
                    const warningMessage = [apiErrorMessage, ...fallbackFailures].filter(Boolean).join(' / ')
                    if (locations.length === 0) {
                        throw new Error(warningMessage || '날씨 정보를 불러오지 못했습니다.')
                    }
                }

                const nextWeatherByDate = mergeCalendarWeatherLocations(calendarDays, locations)

                if (calendarWeatherRequestIdRef.current !== requestId) return
                setCalendarWeatherByDate(nextWeatherByDate)
                setCalendarWeatherError('')
            } catch (error) {
                if (calendarWeatherRequestIdRef.current !== requestId) return
                setCalendarWeatherError(error instanceof Error ? error.message : '날씨 정보를 불러오지 못했습니다.')
                setCalendarWeatherByDate(buildEmptyCalendarWeatherByDate(calendarDays))
            } finally {
                if (calendarWeatherRequestIdRef.current === requestId) {
                    setCalendarWeatherLoading(false)
                }
            }
        }

        void fetchWeather()
    }, [calendarDays, calendarRange])

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
        ? formatSafeDateTime(activeWormOrderRecord.remittanceAppliedAt)
        : ''
    const persistedRemittancePricingSummary = useMemo(
        () => buildRemittancePricingSummaryFromOrder(activeWormOrderRecord),
        [activeWormOrderRecord],
    )
    const transientRemittancePricingSummary = useMemo(() => {
        if (!activeWormOrderRecord) return null
        if (!remittancePricingSummary || !remittancePricingSummaryOrderId) return null
        return remittancePricingSummaryOrderId === activeWormOrderRecord.id ? remittancePricingSummary : null
    }, [activeWormOrderRecord, remittancePricingSummary, remittancePricingSummaryOrderId])
    const effectiveRemittancePricingSummary = persistedRemittancePricingSummary || transientRemittancePricingSummary

    // 현재 발주에 매칭된 인보이스 메일 자동 추출
    const matchedInvoiceEmail = useMemo(() => {
        if (!activeWormOrder?.id) return null
        return emails.find(e => e.matchedOrderId === activeWormOrder.id)
            || dbMatchedEmails.invoiceEmails[0]
            || null
    }, [dbMatchedEmails.invoiceEmails, emails, activeWormOrder?.id])

    const autoTransferAmountUsd = matchedInvoiceEmail?.invoiceTotalAmountUsd ?? null
    const manualTransferAmountUsd = useMemo(() => {
        const normalized = transferAmountUsd.replace(/[^0-9.,-]/g, '').replace(/,/g, '')
        if (!normalized) return null
        const parsed = Number(normalized)
        return Number.isFinite(parsed) ? parsed : null
    }, [transferAmountUsd])
    const isAutoRemittanceReady = Boolean(
        matchedInvoiceEmail &&
        autoTransferAmountUsd !== null &&
        autoTransferAmountUsd > 0,
    )
    const isManualRemittanceReady = Boolean(
        invoicePdf &&
        manualTransferAmountUsd !== null &&
        manualTransferAmountUsd > 0,
    )
    const remittanceRunDisabled =
        remittanceSubmitting ||
        remittanceServerRunActive ||
        isRemittanceLocked ||
        isActiveOrderRemittanceApplied ||
        !activeWormOrderRecord ||
        (useManualRemittanceInput ? !isManualRemittanceReady : !isAutoRemittanceReady)

    useEffect(() => {
        if (!useManualRemittanceInput) return
        if (transferAmountUsd.trim()) return
        if (autoTransferAmountUsd === null || autoTransferAmountUsd <= 0) return
        setTransferAmountUsd(autoTransferAmountUsd.toFixed(2))
    }, [autoTransferAmountUsd, transferAmountUsd, useManualRemittanceInput])

    // 현재 발주에 매칭된 AWB 메일에서 AWB 번호 자동 추출
    const matchedAwbEmail = useMemo(() => {
        if (!activeWormOrder?.id) return null
        return docEmails.find(e => e.matchedOrderId === activeWormOrder.id)
            || dbMatchedEmails.awbDocumentEmails[0]
            || null
    }, [dbMatchedEmails.awbDocumentEmails, docEmails, activeWormOrder?.id])
    const matchedAwbUid = matchedAwbEmail?.uid || activeWormOrderRecord?.awbEmailUid || null

    // DB에 저장된 AWB 번호 (메일 스캔 없이도 표시)
    const persistedAwbNumber = activeWormOrderRecord?.awbNumber ?? null
    const autoBlNumber = matchedAwbEmail?.awbNumber ?? persistedAwbNumber
    const isAwbMonitorComplete = awbMonitorNotice.startsWith('수입신고 수리 완료')
        || awbMonitorNotice.startsWith('유니패스 수입신고 수리 완료')
    const isAwbMonitorFailed = awbMonitorNotice.includes('실패')
    useEffect(() => {
        const normalizedAutoBlNo = normalizeCustomsBlNo(autoBlNumber || '')
        if (!normalizedAutoBlNo) return
        setBlNumberQuery(normalizedAutoBlNo)
        const lookupKey = `${activeWormOrder?.id || 'no-order'}:${normalizedAutoBlNo}`
        if (lastAutoCustomsLookupKeyRef.current === lookupKey) return
        lastAutoCustomsLookupKeyRef.current = lookupKey
        setPendingCustomsLookupBlNo(normalizedAutoBlNo)
    }, [activeWormOrder?.id, autoBlNumber])

    const isCustomsForwardReady = Boolean(matchedInvoiceEmail?.uid && matchedAwbUid)
    const savedMatchedAttachments = useMemo(() => {
        const rows: Array<{
            key: string
            sourceLabel: string
            subject: string
            uid: string
            index: number
            filename: string
            contentType: string
            size: number
            isPdf: boolean
            href: string
        }> = []
        const seen = new Set<string>()

        const collectOne = (
            sourceLabel: string,
            email: WormEmailListItem | null,
            details: Record<string, WormEmailDetail>,
        ) => {
            if (!email?.uid) return
            const detail = details[email.uid]
            if (!detail?.attachments?.length) return

            for (const attachment of detail.attachments) {
                if (isJpegEmailAttachment(attachment)) continue
                const key = `${email.uid}:${attachment.index}`
                if (seen.has(key)) continue
                seen.add(key)
                rows.push({
                    key,
                    sourceLabel,
                    subject: detail.subject || email.subject,
                    uid: email.uid,
                    index: attachment.index,
                    filename: attachment.filename,
                    contentType: attachment.contentType,
                    size: attachment.size,
                    isPdf: isPdfEmailAttachment(attachment),
                    href: `/api/admin/worm-order/emails/attachment?uid=${encodeURIComponent(email.uid)}&index=${attachment.index}&inline=1`,
                })
            }
        }

        emails
            .filter((email) => email.matchedOrderId === activeWormOrder?.id)
            .forEach((email) => collectOne('인보이스', email, emailDetails))
        dbMatchedEmails.invoiceEmails
            .forEach((email) => collectOne('인보이스', email, dbMatchedEmails.invoiceEmailDetails))
        docEmails
            .filter((email) => email.matchedOrderId === activeWormOrder?.id)
            .forEach((email) => collectOne('AWB 문서', email, docEmailDetails))
        dbMatchedEmails.awbDocumentEmails
            .forEach((email) => collectOne('AWB 문서', email, dbMatchedEmails.awbDocumentEmailDetails))

        return rows
    }, [activeWormOrder?.id, dbMatchedEmails, docEmailDetails, docEmails, emailDetails, emails])
    const todayKstYmd = useMemo(() => {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(new Date())
        const year = parts.find((part) => part.type === 'year')?.value ?? '0000'
        const month = parts.find((part) => part.type === 'month')?.value ?? '00'
        const day = parts.find((part) => part.type === 'day')?.value ?? '00'
        return `${year}-${month}-${day}`
    }, [])
    const [customsForwardDate, setCustomsForwardDate] = useState<string>(todayKstYmd)
    const customsForwardDateText = customsForwardDate
        ? customsForwardDate.replace(/-/g, '.')
        : formatKstDateDot(new Date())
    const customsForwardSubject = `${customsForwardDateText} ${CUSTOMS_FORWARD_SUBJECT_SUFFIX}`
    const customsForwardBody = `안녕하세요 관세사님- ${customsForwardDateText}  엑스트래커 갯지렁이 생물 통관 진행 요청드립니다.
<직접배차>예정입니다- 감사합니다:)

엑스트래커 매니저 김유정
010-8119-3313
전화/문자 메세지 회신은 위에 번호로 연락 부탁드립니다.
감사합니다.`

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
        setRemittanceServerRunActive(false)
        setRemittanceAttemptsRemaining(null)
        setRemittanceProgress(0)
        setRemittanceProgressLabel('대기 중')
        setRemittancePricingSummary(null)
        setRemittancePricingSummaryOrderId(null)
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

        const usingManualInput = useManualRemittanceInput
        let parsedAmount = 0

        if (usingManualInput) {
            if (manualTransferAmountUsd === null || manualTransferAmountUsd <= 0) {
                setRemittanceError('수동 송금 금액(USD)을 올바르게 입력해 주세요.')
                return
            }
            if (!invoicePdf) {
                setRemittanceError('수동 모드에서는 인보이스 PDF 파일 업로드가 필요합니다.')
                return
            }
            parsedAmount = manualTransferAmountUsd
        } else {
            if (!autoTransferAmountUsd || autoTransferAmountUsd <= 0) {
                setRemittanceError('매칭된 인보이스의 토탈어마운트가 없습니다. 인보이스 메일을 먼저 매칭해주세요.')
                return
            }
            if (!matchedInvoiceEmail) {
                setRemittanceError('매칭된 인보이스 메일이 없습니다. 인보이스 메일을 먼저 매칭해주세요.')
                return
            }
            parsedAmount = autoTransferAmountUsd
        }

        if (remittanceProgressTimerRef.current) {
            window.clearInterval(remittanceProgressTimerRef.current)
            remittanceProgressTimerRef.current = null
        }

        setRemittanceProgress(REMITTANCE_SIMULATED_STAGES[0]?.percent ?? 5)
        setRemittanceProgressLabel(REMITTANCE_SIMULATED_STAGES[0]?.label ?? '자동화 시작 중...')

        let requestAbortController: AbortController | null = null
        setRemittanceSubmitting(true)
        try {
            requestAbortController = new AbortController()
            remittanceRequestAbortControllerRef.current = requestAbortController

            let invoicePdfFile: File | null = null
            let invoiceEmailUidForServer = ''
            let invoiceAttachmentIndexForServer: number | null = null
            if (usingManualInput) {
                const isPdf =
                    invoicePdf instanceof File &&
                    (invoicePdf.type === 'application/pdf' || invoicePdf.name.toLowerCase().endsWith('.pdf'))
                if (!isPdf || !(invoicePdf instanceof File)) {
                    setRemittanceError('PDF 파일만 업로드할 수 있습니다.')
                    if (remittanceProgressTimerRef.current) {
                        window.clearInterval(remittanceProgressTimerRef.current)
                        remittanceProgressTimerRef.current = null
                    }
                    return
                }
                setRemittanceProgressLabel('수동 업로드 인보이스를 확인하는 중...')
                invoicePdfFile = invoicePdf
            } else {
                const linkedInvoiceEmail = matchedInvoiceEmail
                if (!linkedInvoiceEmail) {
                    setRemittanceError('매칭된 인보이스 메일이 없습니다. 인보이스 메일을 먼저 매칭해주세요.')
                    if (remittanceProgressTimerRef.current) {
                        window.clearInterval(remittanceProgressTimerRef.current)
                        remittanceProgressTimerRef.current = null
                    }
                    return
                }
                setRemittanceProgressLabel('서버에 송금 신청 정보를 전송하는 중...')
                invoiceEmailUidForServer = linkedInvoiceEmail.uid
                const cachedInvoiceDetail = emailDetails[linkedInvoiceEmail.uid]
                const cachedPdfAttachment = cachedInvoiceDetail?.attachments?.find(att => {
                    const name = att.filename.toLowerCase()
                    const type = att.contentType.toLowerCase()
                    return name.endsWith('.pdf') || type.includes('pdf')
                })
                invoiceAttachmentIndexForServer = cachedPdfAttachment?.index ?? null
            }

            if (usingManualInput && !invoicePdfFile) {
                setRemittanceError('인보이스 PDF를 준비하지 못했습니다.')
                if (remittanceProgressTimerRef.current) {
                    window.clearInterval(remittanceProgressTimerRef.current)
                    remittanceProgressTimerRef.current = null
                }
                return
            }

            setRemittanceProgress((prev) => Math.max(prev, 6))
            setRemittanceProgressLabel('서버 브라우저 자동화 런타임을 확인하는 중...')
            const runtimeResponse = new Response(JSON.stringify({ runtimeAvailable: true, ok: true }), { status: 200 })
            const runtimeHealth = await runtimeResponse.json().catch(() => null) as RemittanceRuntimeHealth | null
            if (!runtimeResponse.ok || runtimeHealth?.runtimeAvailable !== true) {
                const missing = Array.isArray(runtimeHealth?.missingComponents) && runtimeHealth.missingComponents.length > 0
                    ? ` (누락: ${runtimeHealth.missingComponents.join(', ')})`
                    : ''
                throw new Error(
                    `${runtimeHealth?.error || '브라우저 자동화 런타임이 준비되지 않았습니다.'}${missing} runtimeUnavailable`
                )
            }

            const submitData = new FormData()
            submitData.append('amountUsd', parsedAmount.toFixed(2))
            if (usingManualInput && invoicePdfFile) {
                submitData.append('invoicePdf', invoicePdfFile)
            } else {
                submitData.append('invoiceEmailUid', invoiceEmailUidForServer)
                if (invoiceAttachmentIndexForServer !== null) {
                    submitData.append('invoiceAttachmentIndex', String(invoiceAttachmentIndexForServer))
                }
            }
            if (activeWormOrder?.id) {
                submitData.append('orderId', activeWormOrder.id)
            }
            if (receiveDate) {
                submitData.append('receiveDate', receiveDate)
            }

            setRemittanceProgress((prev) => Math.max(prev, 8))
            setRemittanceProgressLabel('서버 자동화가 실행 중입니다. 모인 BizPlus 응답을 기다리는 중...')
            const response = await fetch('/api/admin/worm-order/remittance', {
                method: 'POST',
                body: submitData,
                signal: requestAbortController.signal,
            })
            const result = await response.json()

            if (!response.ok) {
                if (result?.running === true) {
                    setRemittanceServerRunActive(result.cancelAvailable === true)
                    setRemittanceProgress((prev) => Math.max(prev, 12))
                    setRemittanceProgressLabel('기존 송금 자동화가 서버에서 실행 중입니다.')
                    setRemittanceError(
                        typeof result?.error === 'string'
                            ? result.error
                            : '이미 송금 자동화가 실행 중입니다. 기존 실행을 취소한 뒤 다시 시작할 수 있습니다.'
                    )
                    return
                }

                if (typeof result?.attemptsRemaining === 'number') {
                    setRemittanceAttemptsRemaining(result.attemptsRemaining)
                }

                if (typeof result?.lockedUntil === 'string') {
                    const lockedUntilMs = Date.parse(result.lockedUntil)
                    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
                        setRemittanceLockedUntil(lockedUntilMs)
                    }
                }

                const diagnostic = result?.diagnostic && typeof result.diagnostic === 'object'
                    ? result.diagnostic as { lastSteps?: unknown; url?: unknown; diagnosticError?: unknown }
                    : null
                const debug = result?.debug && typeof result.debug === 'object'
                    ? result.debug as { step?: unknown; steps?: unknown; stackFirstLine?: unknown; diagnostic?: unknown }
                    : null
                const debugSteps = Array.isArray(debug?.steps)
                    ? debug.steps.filter((step): step is string => typeof step === 'string').slice(-8)
                    : []
                const debugDiagnostic = debug?.diagnostic && typeof debug.diagnostic === 'object'
                    ? debug.diagnostic as { url?: unknown; screenshotPath?: unknown; errorName?: unknown }
                    : null
                const diagnosticSuffix = diagnostic
                    ? ` [diagnostic: url=${typeof diagnostic.url === 'string' ? diagnostic.url : 'unknown'} lastSteps=${Array.isArray(diagnostic.lastSteps) ? diagnostic.lastSteps.slice(-6).join(' -> ') : 'none'}${typeof diagnostic.diagnosticError === 'string' ? ` diagnosticError=${diagnostic.diagnosticError}` : ''}]`
                    : ''
                const debugSuffix = debug
                    ? ` [debug: step=${typeof debug.step === 'string' ? debug.step : 'unknown'} lastSteps=${debugSteps.length > 0 ? debugSteps.join(' -> ') : 'none'}${typeof debug.stackFirstLine === 'string' ? ` stack=${debug.stackFirstLine}` : ''}${typeof debugDiagnostic?.url === 'string' ? ` url=${debugDiagnostic.url}` : ''}${typeof debugDiagnostic?.screenshotPath === 'string' ? ` screenshot=${debugDiagnostic.screenshotPath}` : ''}]`
                    : ''
                throw new Error(`${typeof result?.error === 'string' ? result.error : 'Failed to submit remittance.'}${diagnosticSuffix}${debugSuffix}`)
            }

            const automationSteps = Array.isArray(result?.result?.steps) ? result.result.steps as string[] : []
            const lastAutomationStep = automationSteps.length > 0 ? automationSteps[automationSteps.length - 1] : null
            const resolvedStage = resolveRemittanceStageFromStep(lastAutomationStep)
            const pricingSummary = sanitizeRemittancePricingSummary(result?.result?.pricingSummary)
            const savedOrder = result?.savedOrder
            const preparedOnly = result?.preparedOnly === true || result?.result?.stoppedBeforeConfirmation === true
            const finalActionCandidates = Array.isArray(result?.result?.finalActionCandidates)
                ? (result.result.finalActionCandidates as unknown[]).filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
                : []
            const selectorHints = Array.isArray(result?.result?.selectorsUsed)
                ? (result.result.selectorsUsed as unknown[]).filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)
                : []

            setRemittanceAttemptsRemaining(null)
            setRemittanceLockedUntil(null)
            setRemittanceServerRunActive(false)
            if (preparedOnly) {
                setRemittanceSuccess('모인 BizPlus 최종 확인 직전까지 자동 준비를 완료했습니다. 마지막 송금 버튼은 자동으로 누르지 않았습니다.')
                setRemittanceProgress(Math.max(resolvedStage?.percent ?? 94, 94))
                setRemittanceProgressLabel('최종 송금 확인 직전에서 안전하게 멈췄습니다.')
            } else {
                setRemittanceSuccess('모인 BizPlus 송금 신청이 완료되었습니다.')
                setRemittanceProgress(100)
                setRemittanceProgressLabel(resolvedStage?.label || '송금 신청이 완료되었습니다.')
            }
            setRemittancePricingSummary(pricingSummary)
            setRemittancePricingSummaryOrderId(activeWormOrderRecord.id)

            if (!preparedOnly && savedOrder?.orderNumber) {
                setRemittanceSaveInfo({
                    orderNumber: savedOrder.orderNumber,
                    savedAt: typeof savedOrder.remittanceAppliedAt === 'string'
                        ? savedOrder.remittanceAppliedAt
                        : new Date().toISOString(),
                })
            } else {
                setRemittanceSaveInfo(null)
            }

            const prepareOnlyWarning = preparedOnly
                ? [
                    typeof result?.saveWarning === 'string' ? result.saveWarning : '',
                    finalActionCandidates.length > 0 ? `최종 후보 버튼: ${finalActionCandidates.join(', ')}` : '',
                    selectorHints.length > 0 ? `사용 셀렉터: ${selectorHints.join(' | ')}` : '',
                ].filter(Boolean).join(' / ')
                : ''

            setRemittanceSaveWarning(
                preparedOnly
                    ? prepareOnlyWarning
                    : (typeof result?.saveWarning === 'string' ? result.saveWarning : '')
            )
            if (!preparedOnly && savedOrder?.id) {
                setWormOrderList((prev) => prev.map((order) => (
                    order.id === savedOrder.id
                        ? {
                            ...order,
                            status: typeof savedOrder.status === 'string' ? savedOrder.status : order.status,
                            remittanceAppliedAt: typeof savedOrder.remittanceAppliedAt === 'string'
                                ? savedOrder.remittanceAppliedAt
                                : order.remittanceAppliedAt,
                            remittanceFinalReceiveAmountText: typeof savedOrder.remittanceFinalReceiveAmountText === 'string'
                                ? savedOrder.remittanceFinalReceiveAmountText
                                : order.remittanceFinalReceiveAmountText,
                            remittanceSendAmount: typeof savedOrder.remittanceSendAmount === 'number' && Number.isFinite(savedOrder.remittanceSendAmount)
                                ? savedOrder.remittanceSendAmount
                                : order.remittanceSendAmount,
                            remittanceSendAmountText: typeof savedOrder.remittanceSendAmountText === 'string'
                                ? savedOrder.remittanceSendAmountText
                                : order.remittanceSendAmountText,
                            remittanceTotalFee: typeof savedOrder.remittanceTotalFee === 'number' && Number.isFinite(savedOrder.remittanceTotalFee)
                                ? savedOrder.remittanceTotalFee
                                : order.remittanceTotalFee,
                            remittanceTotalFeeText: typeof savedOrder.remittanceTotalFeeText === 'string'
                                ? savedOrder.remittanceTotalFeeText
                                : order.remittanceTotalFeeText,
                            remittanceExchangeRate: typeof savedOrder.remittanceExchangeRate === 'number' && Number.isFinite(savedOrder.remittanceExchangeRate)
                                ? savedOrder.remittanceExchangeRate
                                : order.remittanceExchangeRate,
                            remittanceExchangeRateText: typeof savedOrder.remittanceExchangeRateText === 'string'
                                ? savedOrder.remittanceExchangeRateText
                                : order.remittanceExchangeRateText,
                            updatedAt: typeof savedOrder.updatedAt === 'string' ? savedOrder.updatedAt : order.updatedAt,
                        }
                        : order
                )))
            }
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
            const displayMessage = formatRemittanceAutomationError(message)

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
                setRemittanceError(`${displayMessage} (Install deps and redeploy: npm install playwright-core @sparticuz/chromium)`)
            } else {
                setRemittanceError(displayMessage)
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
        if (!remittanceSubmitting && !remittanceServerRunActive) return

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
            const response = await fetch(cancelUrl, { method: 'DELETE' })
            const result = await response.json().catch(() => null)
            if (response.ok) {
                setRemittanceServerRunActive(false)
                setRemittanceError('')
                setRemittanceProgressLabel(
                    result?.canceled
                        ? '기존 송금 자동화를 취소했습니다.'
                        : '진행 중인 송금 자동화가 없습니다.'
                )
            }
        } catch {
            // Ignore transport errors here; local abort already requested.
        } finally {
            if (!remittanceSubmitting) {
                remittanceCancelRequestedRef.current = false
                setRemittanceCancelling(false)
            }
        }
    }, [activeWormOrder?.id, remittanceServerRunActive, remittanceSubmitting])

    const handleCustomsProgressSearch = async (
        nextBlNo?: string,
        options?: { scrollIntoView?: boolean },
    ) => {
        const blNo = (nextBlNo ?? blNumberQuery).replace(/\s+/g, '').trim()
        const normalizedBlNo = normalizeCustomsBlNo(blNo)
        if (nextBlNo) {
            setBlNumberQuery(normalizedBlNo)
        }

        if (options?.scrollIntoView) {
            customsProgressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }

        setCustomsProgressError('')
        setCustomsProgressResult(null)

        if (!normalizedBlNo) {
            setCustomsProgressError('B/L 번호를 입력해주세요.')
            return
        }

        const cached = customsProgressCacheRef.current.get(normalizedBlNo)
        if (cached && Date.now() - cached.savedAt <= CUSTOMS_PROGRESS_CLIENT_CACHE_TTL_MS) {
            setCustomsProgressResult(cached.result)
            setCustomsProgressError(cached.error)
            return
        }

        const requestId = ++customsProgressRequestIdRef.current
        setCustomsProgressLoading(true)
        try {
            const response = await fetch(`/api/admin/worm-order/customs-progress?blNo=${encodeURIComponent(normalizedBlNo)}`, { method: 'GET' })
            const result = await response.json()

            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '화물통관 진행정보 조회에 실패했습니다.')
            }

            const parsed = result as CustomsProgressResult
            if (requestId !== customsProgressRequestIdRef.current) return
            setCustomsProgressResult(parsed)
            customsProgressCacheRef.current.set(normalizedBlNo, {
                savedAt: Date.now(),
                result: parsed,
                error: '',
            })
        } catch (error) {
            if (requestId !== customsProgressRequestIdRef.current) return
            const message = error instanceof Error ? error.message : '화물통관 진행정보 조회에 실패했습니다.'
            setCustomsProgressError(message)
        } finally {
            if (requestId === customsProgressRequestIdRef.current) {
                setCustomsProgressLoading(false)
            }
        }
    }

    useEffect(() => {
        if (!pendingCustomsLookupBlNo) return
        const nextBlNo = pendingCustomsLookupBlNo
        setPendingCustomsLookupBlNo('')
        void handleCustomsProgressSearch(nextBlNo)
    }, [pendingCustomsLookupBlNo])

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
    const completedPipelineStepIds = useMemo(
        () => new Set(activeWormOrderRecord?.completedStepIds || []),
        [activeWormOrderRecord?.completedStepIds],
    )

    const pipelineStatusMap = useMemo<Record<number, PipelineRuntimeStatus>>(() => {
        const result: Record<number, PipelineRuntimeStatus> = {}
        for (const step of PIPELINE_STEP_DEFINITIONS) {
            result[step.id] = 'todo'
        }

        result[1] = generatedMessage.trim() ? 'done' : totalBoxes > 0 ? 'active' : 'todo'
        result[2] = matchedInvoiceEmail?.uid
            ? 'done'
            : loadingEmails || matchingEmailUid !== null || invoiceOcrRunningUid !== null || hasFetched
                ? 'active'
                : 'todo'
        result[3] = remittanceSuccess || isActiveOrderRemittanceApplied
            ? 'done'
            : remittanceSubmitting || isAutoRemittanceReady || isManualRemittanceReady
                ? 'active'
                : 'todo'
        result[4] = persistedAwbNumber
            ? 'done'
            : awbLoading || loadingDocEmails || docHasFetched
                ? 'active'
                : 'todo'
        result[5] = customsProgressResult
            ? 'done'
            : customsProgressLoading || Boolean(blNumberQuery.trim())
                ? 'active'
                : 'todo'
        result[6] = completedPipelineStepIds.has(6) ? 'done' : 'todo'
        result[7] = forwardSuccess || forwardLogs.length > 0
            ? 'done'
            : forwarding || isCustomsForwardReady
                ? 'active'
                : 'todo'
        result[8] = completedPipelineStepIds.has(8) || hasWarehouseMail ? 'done' : 'todo'
        result[9] = completedPipelineStepIds.has(9) ? 'done' : 'todo'
        result[10] = completedPipelineStepIds.has(10) ? 'done' : 'todo'

        return result
    }, [
        awbLoading,
        blNumberQuery,
        customsProgressLoading,
        customsProgressResult,
        completedPipelineStepIds,
        docHasFetched,
        forwarding,
        forwardSuccess,
        forwardLogs.length,
        generatedMessage,
        hasFetched,
        hasWarehouseMail,
        invoiceOcrRunningUid,
        isActiveOrderRemittanceApplied,
        isAutoRemittanceReady,
        isManualRemittanceReady,
        isCustomsForwardReady,
        loadingDocEmails,
        loadingEmails,
        matchedInvoiceEmail?.uid,
        matchingEmailUid,
        persistedAwbNumber,
        remittanceSubmitting,
        remittanceSuccess,
        totalBoxes,
    ])

    const doneStepCount = useMemo(
        () => Object.values(pipelineStatusMap).filter((status) => status === 'done').length,
        [pipelineStatusMap],
    )
    const activeStepId = useMemo(
        () => PIPELINE_STEP_DEFINITIONS.find((step) => pipelineStatusMap[step.id] !== 'done')?.id ?? 10,
        [pipelineStatusMap],
    )
    const activeStepDefinition = useMemo(
        () => PIPELINE_STEP_DEFINITIONS.find((step) => step.id === activeStepId) || null,
        [activeStepId],
    )
    const selectedStepDefinition = useMemo(
        () => PIPELINE_STEP_DEFINITIONS.find((step) => step.id === selectedPipelineStepId) || PIPELINE_STEP_DEFINITIONS[0],
        [selectedPipelineStepId],
    )
    const activeOrderDateText = activeWormOrderRecord?.receiveDate
        ? formatYmdWithKoreanWeekday(toKstDateInputString(activeWormOrderRecord.receiveDate), '/')
        : activeWormOrder?.receiveDate
            ? formatYmdWithKoreanWeekday(activeWormOrder.receiveDate, '/')
            : receiveDate
                ? formatYmdWithKoreanWeekday(receiveDate, '/')
                : '-'
    const activeOrderNumberText = activeWormOrderRecord?.orderNumber || activeWormOrder?.orderNumber || '발주 미선택'
    const activeOrderStatusText = activeWormOrderRecord
        ? getWormOrderStatusLabel(activeWormOrderRecord.status)
        : activeWormOrder
            ? '작성중'
            : '새 발주 대기'
    const nextActionText = activeStepDefinition
        ? `${activeStepDefinition.id}. ${activeStepDefinition.title}`
        : '모든 단계 확인'
    const phaseProgressSummaries = useMemo(() => {
        return PIPELINE_PHASES.map((phase) => {
            const done = phase.stepIds.filter((stepId) => pipelineStatusMap[stepId] === 'done').length
            const active = phase.stepIds.some((stepId) => pipelineStatusMap[stepId] === 'active')
            return { ...phase, done, total: phase.stepIds.length, active }
        })
    }, [pipelineStatusMap])
    const handlePipelineStepAction = (step: PipelineStepDefinition) => {
        setSelectedPipelineStepId(step.id)
        setManualStepNotice('')
        window.requestAnimationFrame(() => {
            document.getElementById(`worm-pipeline-step-${step.id}`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            })
        })
        if (step.id === 2 && !loadingEmails && !hasFetched) {
            void fetchEmails(true)
            return
        }

        if (step.id === 4 && !loadingDocEmails && !docHasFetched) {
            void fetchDocumentEmails()
            return
        }

        if (step.id === 5 && fallbackAwbCandidate) {
            void handleCustomsProgressSearch(fallbackAwbCandidate)
        }
    }

    useEffect(() => {
        const previousActiveStep = lastActivePipelineStepRef.current
        if (previousActiveStep === null) {
            lastActivePipelineStepRef.current = activeStepId
            const requestedStep = Number.parseInt(new URLSearchParams(window.location.search).get('step') || '', 10)
            setSelectedPipelineStepId(
                PIPELINE_STEP_DEFINITIONS.some((step) => step.id === requestedStep) ? requestedStep : activeStepId,
            )
            return
        }
        if (previousActiveStep !== activeStepId && selectedPipelineStepId === previousActiveStep) {
            setSelectedPipelineStepId(activeStepId)
        }
        lastActivePipelineStepRef.current = activeStepId
    }, [activeStepId, selectedPipelineStepId])

    useEffect(() => {
        const url = new URL(window.location.href)
        url.searchParams.set('step', String(selectedPipelineStepId))
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }, [selectedPipelineStepId])

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
                writeStoredActiveWormOrderId(result.order.id)
                writeUrlActiveWormOrderId(result.order.id)
                setActiveWormOrder({
                    id: result.order.id,
                    orderNumber: result.order.orderNumber,
                    receiveDate: targetReceiveDate,
                })
                setSelectedPipelineStepId(1)
                setOrderListOpen(false)
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
        setUseManualRemittanceInput(false)
        setRemittanceError('')
        setRemittanceSuccess('')
        setRemittanceProgress(0)
        setRemittanceProgressLabel('대기 중')
        setRemittanceAttemptsRemaining(null)
        setRemittanceLockedUntil(null)
        setRemittancePricingSummary(null)
        setRemittancePricingSummaryOrderId(null)
        setRemittanceSaveInfo(null)
        setRemittanceSaveWarning('')
        setBlNumberQuery('')
        setPendingCustomsLookupBlNo('')
        setCustomsProgressResult(null)
        setCustomsProgressError('')
        setAwbNumber(null)
        setAwbCandidates([])
        setAwbError('')
        setForwardEmail(DEFAULT_CUSTOMS_FORWARD_EMAIL)
        setForwardError('')
        setForwardSuccess('')
        setDocEmails([])
        setDocEmailDetails({})
        setDocHasFetched(false)
        setSelectedDocEmailUid(null)
        setDocEmailError('')
        setDocEmailMatchMessage('')
        setCreatingOrder(false)
    }, [creatingOrder, fetchWormOrders, receiveDate, today])

    const handleManualStepToggle = useCallback(async (stepId: number, completed: boolean) => {
        if (!activeWormOrderRecord?.id || manualStepSaving) {
            if (!activeWormOrderRecord?.id) setManualStepNotice('먼저 상단에서 발주를 선택해주세요.')
            return
        }

        setManualStepSaving(true)
        setManualStepNotice('')
        try {
            const response = await fetch(
                `/api/admin/worm-order/orders/${encodeURIComponent(activeWormOrderRecord.id)}/steps/${stepId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed }),
                },
            )
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(typeof result?.error === 'string' ? result.error : '단계 상태를 저장하지 못했습니다.')
            }

            setWormOrderList((previous) => previous.map((order) => {
                if (order.id !== activeWormOrderRecord.id) return order
                const nextCompletedStepIds = new Set(order.completedStepIds)
                if (completed) nextCompletedStepIds.add(stepId)
                else nextCompletedStepIds.delete(stepId)
                return {
                    ...order,
                    completedStepIds: Array.from(nextCompletedStepIds).sort((left, right) => left - right),
                    status: typeof result?.order?.status === 'string' ? result.order.status : order.status,
                    updatedAt: typeof result?.order?.updatedAt === 'string' ? result.order.updatedAt : order.updatedAt,
                }
            }))
            setManualStepNotice(completed ? '완료 상태를 저장했습니다.' : '완료 상태를 취소했습니다.')
            if (completed && stepId < PIPELINE_STEP_DEFINITIONS.length) {
                setSelectedPipelineStepId(stepId + 1)
            }
        } catch (error) {
            setManualStepNotice(error instanceof Error ? error.message : '단계 상태를 저장하지 못했습니다.')
        } finally {
            setManualStepSaving(false)
        }
    }, [activeWormOrderRecord?.id, manualStepSaving])

    const showOrderTools = true
    const showInboxTools = true
    const showDocInboxTools = true
    const showRemittanceTools = true
    const showCustomsTools = true
    const showCargoCustomsMailTools = true
    const workflowFlowPanel = (
        <aside className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#e34219]">Process</p>
                        <h2 className="mt-1 text-base font-black text-slate-950">프로세스 리스트</h2>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                            {doneStepCount}/{PIPELINE_STEP_DEFINITIONS.length} 단계 완료
                        </p>
                    </div>
                    {activeStepDefinition && (
                        <button
                            type="button"
                            onClick={() => handlePipelineStepAction(activeStepDefinition)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#e34219] px-3 text-xs font-black text-white shadow-sm hover:bg-[#cd3b17]"
                        >
                            {activeStepDefinition.id}
                            이동
                        </button>
                    )}
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {phaseProgressSummaries.map((phase) => (
                        <div
                            key={phase.id}
                            className={`rounded-md border px-2 py-2 text-center ${getPipelinePhaseClass(phase.tone)} ${phase.active ? 'ring-2 ring-[#e34219]/20' : ''}`}
                        >
                            <p className="truncate text-[10px] font-black">{phase.label}</p>
                            <p className="mt-1 text-[10px] font-bold opacity-75">{phase.done}/{phase.total}</p>
                        </div>
                    ))}
                </div>

            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                {PIPELINE_STEP_DEFINITIONS.map((step) => {
                    const runtimeStatus = pipelineStatusMap[step.id]
                    const isCurrent = step.id === selectedPipelineStepId
                    const isNext = step.id === activeStepId
                    return (
                        <button
                            key={`flow-table-${step.id}`}
                            type="button"
                            onClick={() => handlePipelineStepAction(step)}
                            className={`grid w-full grid-cols-[34px_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-left transition-colors ${
                                isCurrent
                                    ? 'bg-[#fff3ef]'
                                    : runtimeStatus === 'done'
                                        ? 'bg-emerald-50/50 hover:bg-emerald-50'
                                        : 'hover:bg-slate-50'
                            }`}
                            title={step.summary}
                        >
                            <span className={`mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-black ${
                                runtimeStatus === 'done'
                                    ? 'bg-emerald-500 text-white'
                                    : isCurrent
                                        ? 'bg-[#e34219] text-white'
                                        : 'bg-slate-200 text-slate-600'
                            }`}>
                                {step.id}
                            </span>
                            <span className="min-w-0">
                                <span className={`block text-sm font-black leading-tight ${
                                    isCurrent
                                        ? 'text-[#d9361b]'
                                        : runtimeStatus === 'done'
                                            ? 'text-emerald-700'
                                            : 'text-slate-800'
                                }`}>
                                    {step.title}
                                </span>
                                <span className="mt-1 block text-[11px] font-medium leading-snug text-slate-500">
                                    {step.summary}
                                </span>
                                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold ${getPipelineModeBadgeClass(step.mode)}`}>
                                        {getPipelineModeLabel(step.mode)}
                                    </span>
                                    <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-bold ${getPipelineRuntimeBadgeClass(runtimeStatus)}`}>
                                        {isNext && runtimeStatus !== 'done' ? '다음 단계' : getPipelineRuntimeLabel(runtimeStatus)}
                                    </span>
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>
        </aside>
    )

    return (
        <div className="mx-auto flex max-w-[1840px] flex-col gap-4 px-3 pb-10 md:px-5 xl:px-7">
            <header className="rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-sm md:p-5">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#e34219]">Worm Import Pipeline</p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">지렁이 수입 자동화 파이프라인</h1>
                        <p className="text-sm text-slate-600 font-medium">중국 → 한국 수입 전 과정을 단계별로 실행하고 추적합니다.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:flex">
                        <button
                            type="button"
                            onClick={() => setOrderListOpen(true)}
                            className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:max-w-[260px]"
                        >
                            <Package size={16} className="shrink-0" />
                            <span className="truncate">{activeOrderNumberText}</span>
                            <ChevronDown size={14} className="shrink-0 text-slate-400" />
                        </button>
                        <button
                            type="button"
                            onClick={handleStartNewOrder}
                            disabled={creatingOrder}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#e34219] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#cd3b17] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creatingOrder ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                            {creatingOrder ? '생성중...' : '새 발주'}
                        </button>
                    </div>
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
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f5d5cc]">
                        <div
                            className="h-full bg-[#e34219] rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((doneStepCount / PIPELINE_STEP_DEFINITIONS.length) * 100)}%` }}
                        />
                    </div>
                    <span className="shrink-0 text-xs font-bold text-slate-600">
                        {doneStepCount}/{PIPELINE_STEP_DEFINITIONS.length} 단계 완료
                    </span>
                </div>
            </header>

            <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="grid gap-0 sm:grid-cols-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
                    <div className="border-b border-slate-100 px-3 py-3 sm:border-r md:border-b-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#e34219]">Active Order</p>
                        <p className="mt-1 text-lg font-black text-slate-950">{activeOrderNumberText}</p>
                        <p className="text-xs font-semibold text-slate-500">{activeOrderDateText}</p>
                    </div>
                    <div className="border-b border-slate-100 px-3 py-3 md:border-b-0 md:border-r">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">현재 상태</p>
                        <p className="mt-1 text-lg font-black text-slate-950">{activeOrderStatusText}</p>
                        <p className="text-xs font-semibold text-slate-500">발주 {filteredWormOrderList.length}건 표시중</p>
                    </div>
                    <div className="border-b border-slate-100 px-3 py-3 sm:border-b-0 sm:border-r">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">다음 액션</p>
                        <p className="mt-1 line-clamp-1 text-lg font-black text-[#d9361b]">{nextActionText}</p>
                        <p className="text-xs font-semibold text-slate-500">{activeStepDefinition?.summary || '완료 상태를 확인하세요.'}</p>
                    </div>
                    <div className="px-3 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">발주 수량</p>
                        <p className="mt-1 text-lg font-black text-slate-950">{totalBoxes.toLocaleString('ko-KR')} boxes</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {wormTypeTotals.map((wormType) => (
                                <span key={wormType.id} className={`inline-flex h-6 items-center rounded-full px-2 text-[10px] font-black ${wormType.cardTagClass}`}>
                                    {wormType.label} {wormType.total}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid min-w-0 gap-4 md:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="sticky top-4 hidden self-start md:block">{workflowFlowPanel}</div>
            {orderListOpen && (
            <>
            <button
                type="button"
                className="fixed inset-0 z-40 bg-slate-950/35"
                onClick={() => setOrderListOpen(false)}
                aria-label="발주 리스트 닫기"
            />
            <section className="fixed inset-y-0 right-0 z-50 w-full max-w-[900px] overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1e1e1e] md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">발주 리스트</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-gray-400">작업할 발주를 선택하세요.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => { void fetchWormOrders() }}
                            disabled={wormOrderListLoading}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {wormOrderListLoading ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
                            새로고침
                        </button>
                        <button
                            type="button"
                            onClick={() => setOrderListOpen(false)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                            aria-label="닫기"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {wormOrderMonthGroups.length > 0 && (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        {wormOrderMonthGroups.map((group) => {
                            const selected = selectedWormOrderMonth === group.value
                            return (
                                <button
                                    key={group.value}
                                    type="button"
                                    onClick={() => setSelectedWormOrderYearMonth(group.value)}
                                    className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-black transition ${
                                        selected
                                            ? 'border-[#e34219] bg-[#e34219] text-white shadow-sm'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-[#ffd7cc] hover:bg-[#fff7f3] hover:text-[#d9361b] dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-300'
                                    }`}
                                >
                                    <span>{group.year}년 {Number(group.month)}월</span>
                                    <span className={selected ? 'text-red-100' : 'text-slate-400'}>{group.count}</span>
                                </button>
                            )
                        })}
                    </div>
                )}

                {wormOrderListError && (
                    <p className="mt-3 whitespace-pre-wrap text-xs font-semibold text-red-600">{wormOrderListError}</p>
                )}

                <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
                    <table className="w-full min-w-[760px] table-fixed text-sm">
                        <thead className="bg-slate-50/80 text-slate-700 dark:bg-[#1a1a1a] dark:text-gray-300">
                            <tr>
                                <th className="w-9 px-2 py-5" />
                                <th className="w-[15%] px-2 py-5 text-left font-black">발주일</th>
                                <th className="w-[26%] px-2 py-5 text-left font-black">상태</th>
                                <th className="w-[14%] px-2 py-5 text-right font-black">송금액</th>
                                <th className="w-[18%] px-2 py-5 text-right font-black">송금 한화</th>
                                <th className="w-[14%] px-2 py-5 text-right font-black">환율</th>
                                <th className="w-[8%] px-2 py-5 text-right font-black">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredWormOrderList.map((order) => {
                                const isActiveOrder = activeWormOrder?.id === order.id
                                const orderDateText = toKstDateInputString(order.receiveDate)
                                const orderNumberDisplay = orderDateText ? formatYmdWithKoreanWeekday(orderDateText, '/') : order.orderNumber
                                const orderDateParts = orderNumberDisplay.match(/^(.+?)\s+\((.+)\)$/)
                                const orderDateMainText = orderDateParts?.[1] || orderNumberDisplay
                                const orderWeekdayText = orderDateParts?.[2] || ''
                                const sendAmountUsd = resolveRemittanceSendUsd(order)
                                const originKrw = resolveRemittanceOriginKrw(order)
                                const totalFeeKrw = resolveRemittanceFeeKrw(order)
                                const totalPaidKrw = resolveRemittanceTotalPaidKrw(order)
                                const parsedExchangeRate = parseSummaryRate(order.remittanceExchangeRateText) ?? order.remittanceExchangeRate
                                const remittanceSummaryComplete = isRemittanceSummaryComplete(order)
                                const exchangeRateText = parsedExchangeRate !== null
                                    ? `1 USD = ${Math.round(parsedExchangeRate).toLocaleString('ko-KR')} KRW`
                                    : order.remittanceExchangeRateText || '-'
                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => handleSelectWormOrder(order)}
                                        className={`cursor-pointer border-t border-slate-200 transition-colors dark:border-[#2a2a2a] ${
                                            isActiveOrder ? 'bg-blue-50/60 dark:bg-[#252525]' : 'bg-white hover:bg-slate-50 dark:bg-[#1e1e1e] dark:hover:bg-[#252525]'
                                        }`}
                                    >
                                        <td className="px-2 py-6 text-center text-slate-500 dark:text-gray-400">
                                            {isActiveOrder ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </td>
                                        <td className="px-2 py-6 align-middle">
                                            <div className="break-keep text-sm font-black leading-6 text-slate-950 dark:text-white">{orderDateMainText}</div>
                                            {orderWeekdayText && <div className="text-sm font-black leading-6 text-slate-950 dark:text-white">({orderWeekdayText})</div>}
                                        </td>
                                        <td className="px-2 py-6 align-middle">
                                            <div className="flex flex-col gap-2">
                                                <span className={`inline-flex h-7 w-fit items-center rounded-lg border px-2.5 text-xs font-black ${getWormOrderStatusClass(order.status)}`}>
                                                    {getWormOrderStatusLabel(order.status)}
                                                </span>
                                                {order.remittanceAppliedAt && (
                                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                                                        신청 {formatSafeDateTime(order.remittanceAppliedAt, {
                                                            year: 'numeric',
                                                            month: '2-digit',
                                                            day: '2-digit',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                )}
                                                {(originKrw !== null || totalFeeKrw !== null) && (
                                                    <span className="truncate text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                                                        원금 {formatKrwAmount(originKrw)} <span className="mx-1 text-slate-300">|</span> 수수료 {formatKrwAmount(totalFeeKrw)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-6 text-right text-sm font-black text-slate-950 dark:text-white">
                                            {formatUsdAmount(sendAmountUsd)}
                                        </td>
                                        <td className="px-2 py-6 text-right">
                                            <div className="whitespace-nowrap text-sm font-black text-slate-950 dark:text-white">{formatKrwAmount(totalPaidKrw)}</div>
                                            <div className="mt-1 whitespace-nowrap text-[11px] font-semibold text-slate-500 dark:text-gray-400">수수료 {formatKrwAmount(totalFeeKrw)}</div>
                                        </td>
                                        <td className="whitespace-nowrap px-2 py-6 text-right text-sm font-black text-slate-950 dark:text-white">
                                            {exchangeRateText}
                                        </td>
                                        <td className="px-2 py-6 text-right">
                                            <div className="flex flex-col items-end gap-1.5">
                                                {!remittanceSummaryComplete && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                void handleImportRemittanceHistory(order)
                                                            }}
                                                            disabled={importingWormOrderId === order.id}
                                                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-[10px] font-black text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                            aria-label={`${order.orderNumber} 송금정보 가져오기`}
                                                            title="모인 비즈플러스 거래내역에서 자동으로 가져옵니다"
                                                        >
                                                            {importingWormOrderId === order.id ? (
                                                                <Loader2 size={13} className="animate-spin" />
                                                            ) : (
                                                                <ScanSearch size={13} />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                openManualRemittanceModal(order)
                                                            }}
                                                            className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 hover:bg-slate-50"
                                                            aria-label={`${order.orderNumber} 송금정보 직접 입력`}
                                                            title="송금 금액·수수료·환율을 직접 입력해 저장합니다"
                                                        >
                                                            직접 입력
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void handleDeleteWormOrder(order)
                                                    }}
                                                    disabled={deletingWormOrderId === order.id}
                                                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-black text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                    aria-label={`${order.orderNumber} 삭제`}
                                                >
                                                    {deletingWormOrderId === order.id ? (
                                                        <Loader2 size={13} className="animate-spin" />
                                                    ) : (
                                                        <Trash2 size={13} />
                                                    )}
                                                    삭제
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {!wormOrderListLoading && filteredWormOrderList.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-gray-400">
                                        {wormOrderList.length === 0
                                            ? '저장된 발주가 없습니다. 상단의 `+ 새 발주 시작` 버튼으로 생성해 주세요.'
                                            : `${selectedWormOrderMonthLabel} 발주가 없습니다.`}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4 text-xs font-medium text-slate-500 dark:bg-[#1a1a1a] dark:text-gray-400">
                    모든 금액은 실시간 환율을 기준으로 계산되며, 실제 송금 시점의 환율에 따라 변동될 수 있습니다.
                </div>
            </section>
            </>
            )}

            <div className="flex min-w-0 flex-col gap-4 md:col-start-2 md:row-start-1">
                <div className="-mx-1 overflow-x-auto pb-1 md:hidden">
                    <div className="flex min-w-max gap-2 px-1">
                        {PIPELINE_STEP_DEFINITIONS.map((step) => {
                            const runtimeStatus = pipelineStatusMap[step.id]
                            const selected = step.id === selectedPipelineStepId
                            return (
                                <button
                                    key={`mobile-step-${step.id}`}
                                    type="button"
                                    onClick={() => handlePipelineStepAction(step)}
                                    className={`inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-xs font-black ${
                                        selected
                                            ? 'border-[#e34219] bg-[#e34219] text-white'
                                            : runtimeStatus === 'done'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : 'border-slate-200 bg-white text-slate-600'
                                    }`}
                                    aria-label={`${step.id}단계 ${step.title}`}
                                >
                                    {step.id}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm md:px-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-[#e34219] text-sm font-black text-white">
                                {selectedStepDefinition.id}
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-lg font-black text-slate-950">{selectedStepDefinition.title}</h2>
                                    <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-bold ${getPipelineModeBadgeClass(selectedStepDefinition.mode)}`}>
                                        {getPipelineModeLabel(selectedStepDefinition.mode)}
                                    </span>
                                    <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-bold ${getPipelineRuntimeBadgeClass(pipelineStatusMap[selectedStepDefinition.id])}`}>
                                        {getPipelineRuntimeLabel(pipelineStatusMap[selectedStepDefinition.id])}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-600">{selectedStepDefinition.summary}</p>
                            </div>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-slate-500">담당 · {selectedStepDefinition.owner}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
                        {selectedStepDefinition.details.map((detail) => (
                            <span key={detail} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#e34219]" />
                                {detail}
                            </span>
                        ))}
                    </div>
                    {manualStepNotice && (
                        <p className="mt-3 text-xs font-semibold text-slate-600">{manualStepNotice}</p>
                    )}
                </section>

                {PIPELINE_STEP_DEFINITIONS.filter((step) => step.target === 'none').map((step) => (
                    <section
                        key={`manual-step-${step.id}`}
                        id={`worm-pipeline-step-${step.id}`}
                        style={{ order: step.id * 10 }}
                        className="scroll-mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white">
                                    {step.id}
                                </span>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-black text-slate-900">{step.title}</p>
                                        <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-bold ${getPipelineRuntimeBadgeClass(pipelineStatusMap[step.id])}`}>
                                            {getPipelineRuntimeLabel(pipelineStatusMap[step.id])}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-slate-500">{step.summary}</p>
                                    <p className="mt-2 text-[11px] font-bold text-slate-400">담당 · {step.owner}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleManualStepToggle(step.id, pipelineStatusMap[step.id] !== 'done')}
                                disabled={manualStepSaving || !activeWormOrderRecord}
                                className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    pipelineStatusMap[step.id] === 'done'
                                        ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        : 'bg-[#e34219] text-white hover:bg-[#cd3b17]'
                                }`}
                            >
                                {manualStepSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {pipelineStatusMap[step.id] === 'done' ? '완료 취소' : '완료로 표시'}
                            </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
                            {step.details.map((detail) => (
                                <span key={detail} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#e34219]" />
                                    {detail}
                                </span>
                            ))}
                        </div>
                    </section>
                ))}
            {showOrderTools && (
                <div
                    ref={orderSectionRef}
                    id="worm-pipeline-step-1"
                    style={{ order: 10 }}
                    className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-[#fff7f3] dark:bg-[#1a1a1a] flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black text-[#1f2937] dark:text-white">발주서 작성</h2>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">사이즈별 수량을 입력하고 발주 메시지를 생성합니다.</p>
                        </div>
                        <Sparkles size={18} className="text-[#e34219]" />
                    </div>

                    <div className="p-4 md:p-6 space-y-6">
                        <section className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50/60 dark:bg-[#1a1a1a]/60 p-4 md:p-5">
                            <p className="text-[11px] font-black text-slate-600 dark:text-gray-400 uppercase tracking-[0.2em]">납품 예정일</p>

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
                                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#252525] inline-flex items-center justify-center"
                                    aria-label="이전 달"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <div className="flex flex-col items-center gap-1 px-2">
                                    <p className="text-sm font-black text-slate-900 dark:text-white">{calendarMonthLabel}</p>
                                    {calendarMonthPriceInfo && (
                                        <span
                                            className={`inline-flex max-w-[168px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black leading-none ${getCalendarPriceBadgeClass(calendarMonthPriceInfo.colorType)}`}
                                            title={calendarMonthPriceInfo.memo}
                                        >
                                            {calendarMonthPriceInfo.priceStatus}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setCalendarCursor((prev) => {
                                            const nextMonth = prev.month + 1
                                            if (nextMonth > 11) return { year: prev.year + 1, month: 0 }
                                            return { year: prev.year, month: nextMonth }
                                        })
                                    }
                                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#252525] inline-flex items-center justify-center"
                                    aria-label="다음 달"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>

                            <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] font-bold text-center">
                                {KOREAN_WEEKDAY_LABELS.map((weekday, dayOfWeek) => (
                                    <span key={weekday} className={getCalendarWeekdayHeaderClass(dayOfWeek)}>{weekday}</span>
                                ))}
                            </div>
                            <div className="mt-1 grid grid-cols-7 gap-1">
                                {calendarDays.map((dayCell) => {
                                    const ymd = formatLocalDateToYmd(dayCell.date)
                                    const ordersOnDate = wormOrdersByReceiveDate.get(ymd) || []
                                    const hasOrderOnDate = ordersOnDate.length > 0 && dayCell.isCurrentMonth
                                    const isSelected = receiveDate === ymd
                                    const isMonthStart = dayCell.date.getDate() === 1
                                    const dayStart = new Date(
                                        dayCell.date.getFullYear(),
                                        dayCell.date.getMonth(),
                                        dayCell.date.getDate(),
                                    )
                                    const isPast = dayStart.getTime() < todayDate.getTime()
                                    const monthPriceTintClass =
                                        !isSelected && dayCell.isCurrentMonth
                                            ? getCalendarPriceTintClass(dayCell.colorType)
                                            : ''
                                    const monthPriceTooltip = `${dayCell.date.getMonth() + 1}월 ${dayCell.priceStatus}: ${dayCell.memo}`
                                    const dayWeather = calendarWeatherByDate[ymd]
                                    const shanghaiWeather = dayWeather?.shanghai || null
                                    const busanGangseoWeather = dayWeather?.busanGangseo || null
                                    const rainLevel = !isSelected && dayCell.isCurrentMonth
                                        ? classifyDayPrecipitation(shanghaiWeather, busanGangseoWeather)
                                        : null
                                    const rainBgClass = getCalendarRainBgClass(rainLevel)
                                    const dayOfWeek = dayCell.date.getDay()
                                    const chineseHolidayName = dayCell.isCurrentMonth ? getChineseHolidayName(ymd) : null
                                    const koreanHolidayName = dayCell.isCurrentMonth ? getKoreanHolidayName(ymd) : null
                                    const isPublicHoliday = Boolean(chineseHolidayName || koreanHolidayName)
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
                                    const isRedDay = isWeekend || isPublicHoliday
                                    const RED_DAY_BG = 'bg-rose-50 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/30 dark:border-rose-800 dark:hover:bg-rose-900/50'
                                    // Priority: 빨간 날(주말/공휴일) > 비/폭우 > 금요일 > 기본 흰색
                                    let cellBgClass = ''
                                    if (!isSelected && dayCell.isCurrentMonth) {
                                        if (isRedDay) {
                                            cellBgClass = RED_DAY_BG
                                        } else if (rainBgClass) {
                                            cellBgClass = rainBgClass
                                        } else if (dayOfWeek === 5) {
                                            cellBgClass = getCalendarDayOfWeekBgClass(dayOfWeek)
                                        }
                                    }
                                    const nextDay = new Date(dayCell.date)
                                    nextDay.setDate(nextDay.getDate() + 1)
                                    const nextDayYmd = formatLocalDateToYmd(nextDay)
                                    const nextDayWeather = calendarWeatherByDate[nextDayYmd]
                                    const nextDayRainLevel = nextDayWeather
                                        ? classifyDayPrecipitation(
                                            nextDayWeather.shanghai || null,
                                            nextDayWeather.busanGangseo || null,
                                          )
                                        : null
                                    const isGoodDeliveryDay =
                                        !isPast &&
                                        dayCell.isCurrentMonth &&
                                        !rainLevel &&
                                        !nextDayRainLevel &&
                                        !isPublicHoliday &&
                                        dayOfWeek !== 0 &&
                                        dayOfWeek !== 5 &&
                                        dayOfWeek !== 6
                                    const cellTooltip = (() => {
                                        const parts = [monthPriceTooltip]
                                        if (ordersOnDate.length > 0) {
                                            parts.push(`발주 ${ordersOnDate.length}건: ${ordersOnDate.map((order) => order.orderNumber).join(', ')}`)
                                        }
                                        if (koreanHolidayName) parts.push(`한국 공휴일: ${koreanHolidayName}`)
                                        if (chineseHolidayName) parts.push(`중국 공휴일: ${chineseHolidayName}`)
                                        if (nextDayRainLevel) parts.push(`다음날 ${nextDayRainLevel === 'heavy' ? '강한 비' : '비'} 예보`)
                                        return parts.join(' · ')
                                    })()
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
                                            title={cellTooltip}
                                            className={`min-h-[74px] rounded-lg px-1.5 py-1 text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-[#e34219] text-white'
                                                    : dayCell.isCurrentMonth
                                                        ? `${cellBgClass || 'bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#252525]'} text-slate-700 border`
                                                        : 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-400 border border-slate-200 dark:border-[#2a2a2a] hover:bg-slate-200 dark:hover:bg-[#252525]'
                                            } ${monthPriceTintClass} ${hasOrderOnDate ? 'border-2 border-[#e34219] shadow-[inset_0_0_0_1px_rgba(227,66,25,0.18)]' : ''} ${isPast ? 'opacity-35 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex h-full flex-col">
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-[11px] font-black inline-flex items-center justify-center ${
                                                        isGoodDeliveryDay && !isSelected
                                                            ? 'h-[18px] w-[18px] rounded-full border-[1.5px] border-emerald-500 text-emerald-700 dark:text-emerald-400'
                                                            : isSelected
                                                                ? 'text-white'
                                                                : 'text-slate-700 dark:text-gray-300'
                                                    }`}>
                                                        {dayCell.date.getDate()}
                                                    </span>
                                                    {koreanHolidayName && (
                                                        <span
                                                            className={`inline-flex items-center rounded px-1 py-[1px] text-[9px] font-black leading-none whitespace-nowrap ${
                                                                isSelected
                                                                    ? 'bg-white/20 text-white border border-white/30'
                                                                    : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800'
                                                            }`}
                                                            title={`한국 공휴일: ${koreanHolidayName}`}
                                                        >
                                                            {getKoreanHolidayShortLabel(koreanHolidayName)}
                                                        </span>
                                                    )}
                                                    {chineseHolidayName && (
                                                        <span
                                                            className={`inline-flex items-center rounded px-1 py-[1px] text-[9px] font-black leading-none whitespace-nowrap ${
                                                                isSelected
                                                                    ? 'bg-white/20 text-white border border-white/30'
                                                                    : 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
                                                            }`}
                                                            title={`중국 공휴일: ${chineseHolidayName}`}
                                                        >
                                                            {getChineseHolidayShortLabel(chineseHolidayName)}
                                                        </span>
                                                    )}
                                                </div>
                                                {isMonthStart && (
                                                    <span
                                                        className={`mt-1 inline-flex max-w-full items-center rounded-full px-1.5 py-[1px] text-[9px] font-black leading-none truncate ${getCalendarPriceBadgeClass(dayCell.colorType, isSelected)}`}
                                                        title={dayCell.memo}
                                                    >
                                                        {dayCell.priceStatus}
                                                    </span>
                                                )}
                                                <div className={`mt-1.5 space-y-0.5 text-[9px] font-semibold leading-[1.2] ${
                                                    isSelected ? 'text-white/95' : 'text-slate-500 dark:text-gray-400'
                                                }`}>
                                                    {(() => {
                                                        const shanghaiIcon = getCalendarWeatherIcon(shanghaiWeather)
                                                        const busanIcon = getCalendarWeatherIcon(busanGangseoWeather)
                                                        const shanghaiTitle = shanghaiWeather ? `상해 ${formatCalendarWeatherText(shanghaiWeather)}` : '상해 -'
                                                        const busanTitle = busanGangseoWeather ? `부산 ${formatCalendarWeatherText(busanGangseoWeather)}` : '부산 -'
                                                        return (
                                                            <>
                                                                <p className="flex items-center gap-1 truncate" title={shanghaiTitle}>
                                                                    <span>상해</span>
                                                                    {shanghaiIcon ? (
                                                                        <shanghaiIcon.Icon size={11} strokeWidth={2.2} className={isSelected ? 'text-white/95 shrink-0' : `${shanghaiIcon.colorClass} shrink-0`} />
                                                                    ) : null}
                                                                    <span className="truncate">{formatCalendarWeatherTempText(shanghaiWeather)}</span>
                                                                </p>
                                                                <p className="flex items-center gap-1 truncate" title={busanTitle}>
                                                                    <span>부산</span>
                                                                    {busanIcon ? (
                                                                        <busanIcon.Icon size={11} strokeWidth={2.2} className={isSelected ? 'text-white/95 shrink-0' : `${busanIcon.colorClass} shrink-0`} />
                                                                    ) : null}
                                                                    <span className="truncate">{formatCalendarWeatherTempText(busanGangseoWeather)}</span>
                                                                </p>
                                                            </>
                                                        )
                                                    })()}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-gray-400">
                                선택된 납품 예정일: {receiveDate || '-'}
                            </div>
                            {selectedDatePriceInfo && (
                                <div className="mt-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-black text-slate-700 dark:text-gray-300">월별 가격 추이</p>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ${getCalendarPriceBadgeClass(selectedDatePriceInfo.colorType)}`}>
                                            {selectedDatePriceInfo.priceStatus}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                                        {selectedDatePriceInfo.memo}
                                    </p>
                                </div>
                            )}
                            <div className="mt-2 rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                                {calendarWeatherLoading ? '날씨 정보를 최신으로 갱신 중...' : '날씨 정보는 접속 시마다 최신으로 갱신됩니다.'}
                            </div>
                            {calendarWeatherError && (
                                <p className="mt-2 text-[11px] font-semibold text-red-600">{calendarWeatherError}</p>
                            )}
                        </section>

                        <div className="space-y-5">
                            <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border border-[#ffd7cc] bg-[#fff7f3] px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#e34219]">총 발주</p>
                                    <p className="mt-1 text-2xl font-black text-slate-950">{totalBoxes.toLocaleString('ko-KR')}</p>
                                    <p className="text-xs font-semibold text-slate-500">boxes</p>
                                </div>
                                {wormTypeTotals.map((wormType) => (
                                    <div
                                        key={`worm-total-${wormType.id}`}
                                        className={`rounded-2xl border px-4 py-3 ${
                                            wormType.id === 'blue'
                                                ? 'border-emerald-200 bg-emerald-50'
                                                : 'border-red-200 bg-red-50'
                                        }`}
                                    >
                                        <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${
                                            wormType.id === 'blue' ? 'text-emerald-700' : 'text-red-700'
                                        }`}>
                                            {wormType.label}
                                        </p>
                                        <p className="mt-1 text-2xl font-black text-slate-950">{wormType.total.toLocaleString('ko-KR')}</p>
                                        <p className="text-xs font-semibold text-slate-500">boxes</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                                {WORM_TYPES.map((wormType) => (
                                    <section
                                        key={wormType.id}
                                        className={`space-y-3 rounded-2xl border p-4 ${
                                            wormType.id === 'blue'
                                                ? 'border-emerald-200 bg-emerald-50/40'
                                                : 'border-red-200 bg-red-50/40'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`inline-flex h-7 items-center rounded-full px-3 text-sm font-black ${wormType.cardTagClass}`}>
                                                {wormType.label}
                                            </span>
                                            <span className="text-sm font-black text-slate-700">
                                                {wormTypeTotals.find((item) => item.id === wormType.id)?.total.toLocaleString('ko-KR') || 0} boxes
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-2">
                                            {WORM_SIZES.map((size) => {
                                                const current = quantitiesByType[wormType.id]?.[size.id] || 0
                                                const inputValue = current > 0 ? String(current) : ''
                                                const isSelected = current > 0

                                                return (
                                                    <div
                                                        key={`${wormType.id}-${size.id}`}
                                                        className={`flex flex-col gap-2.5 justify-between border rounded-xl p-3.5 transition-all duration-200 ${
                                                            isSelected
                                                                ? `${wormType.cardActiveBorderClass} ${wormType.cardActiveClass} shadow-sm dark:shadow-none`
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
                                                                value={inputValue}
                                                                onChange={(event) => {
                                                                    const rawValue = event.target.value.trim()
                                                                    if (!rawValue) {
                                                                        handleQuantityChange(wormType.id, size.id, 0)
                                                                        return
                                                                    }
                                                                    const next = Number(rawValue)
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

                            <button
                                type="button"
                                onClick={handleGenerate}
                                className="h-11 w-full md:w-auto md:min-w-[220px] bg-[#e34219] hover:bg-[#cd3b17] text-white rounded-lg font-bold text-sm tracking-wide px-6"
                            >
                                발주 메시지 생성
                            </button>
                        </div>

                        {generatedMessage && (
                            <div className="space-y-3">
                                <textarea
                                    readOnly
                                    value={generatedMessage}
                                    className="w-full h-52 border border-gray-300 dark:border-[#2a2a2a] rounded-xl p-4 text-sm leading-6 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-[#1a1a1a]"
                                />
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="inline-flex items-center gap-2 h-9 px-4 border border-gray-300 dark:border-[#2a2a2a] rounded-lg font-semibold text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
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
                <div ref={inboxSectionRef} id="worm-pipeline-step-2" style={{ order: 20 }} className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden relative">
                
                {/* 상단 프로그레스 게이지 바 */}
                {fetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div 
                            className="h-full bg-orange-500 transition-all duration-300 ease-out"
                            style={{ width: `${fetchProgress}%` }}
                        />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-[#f8fafc] dark:bg-[#1a1a1a] flex items-center justify-between mt-[2px]">
                    <div>
                        <h2 className="text-lg font-black text-[#1f2937] dark:text-white flex items-center gap-2">
                            <Mail size={18} className="text-slate-500 dark:text-gray-400" />
                            메일센터 · 인보이스
                            {loadingEmails && <span className="flex h-2 w-2 ml-1"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                            Michael 발신자의 invoice/payment 메일을 이 발주에 매칭합니다.
                            {activeWormOrder && <span className="ml-2 font-semibold text-slate-600 dark:text-gray-400">현재 발주: {activeWormOrder.orderNumber}</span>}
                        </p>
                        {emailCacheSavedAt && (
                            <p className={`mt-1 text-[11px] font-medium ${usingOfflineEmailCache ? 'text-amber-600' : 'text-slate-400'}`}>
                                {usingOfflineEmailCache ? '오프라인 캐시 사용 중' : '캐시 저장'} · {formatSafeDateTime(emailCacheSavedAt)}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => { void fetchEmails(true) }}
                        disabled={loadingEmails}
                        className="h-9 px-4 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingEmails ? '스캔 중...' : matchedInvoiceEmail ? '새 메일 찾기' : '메일 스캔'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100 dark:border-[#2a2a2a]">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white dark:bg-[#1e1e1e] border-r border-gray-100 dark:border-[#2a2a2a] overflow-y-auto max-h-[600px] relative">
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
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-[#1a1a1a]/50 mt-10">
                                현재 발주에서 매칭 가능한 `invoice/payment` 메일이 없습니다.
                            </div>
                        )}

                        {!loadingEmails && emails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {emails.map((email, index) => {
                                    const isSelected = selectedEmailUid === email.uid
                                    const isMatched = email.matchedOrderId === activeWormOrder?.id
                                    return (
                                        <div
                                            key={email.uid}
                                            className={`w-full text-left p-4 transition-colors ${
                                                isMatched && isSelected
                                                    ? 'bg-emerald-100 border-l-4 border-emerald-600 pl-[13px]'
                                                    : isMatched
                                                    ? 'bg-emerald-50 border-l-4 border-emerald-500 pl-[13px] hover:bg-emerald-100'
                                                    : isSelected
                                                    ? 'bg-orange-50/50 border-l-[3px] border-orange-500 pl-[13px]'
                                                    : 'border-l-[3px] border-transparent pl-4 hover:bg-slate-50 dark:hover:bg-[#252525]'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedEmailUid(email.uid)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[11px] font-bold ${isMatched ? 'text-emerald-700' : isSelected ? 'text-orange-500' : 'text-gray-400'}`}>
                                                        {formatSafeDate(email.date)}
                                                    </span>
                                                    {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                                </div>
                                                <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isMatched || isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {index + 1}. {email.subject}
                                                </h3>
                                            </button>
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void handleMatchEmailToActiveOrder(email)
                                                    }}
                                                    disabled={email.matchedOrderId === activeWormOrder?.id || !activeWormOrder?.id || matchingEmailUid === email.uid}
                                                    className={`inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                                                        email.matchedOrderId === activeWormOrder?.id
                                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                            : matchingEmailUid === email.uid
                                                                ? 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-[#2a2a2a] cursor-progress'
                                                                : activeWormOrder?.id
                                                                    ? 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                                                                    : 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-[#2a2a2a] cursor-not-allowed'
                                                    }`}
                                                >
                                                    {email.matchedOrderId === activeWormOrder?.id
                                                        ? '매칭완료'
                                                        : matchingEmailUid === email.uid
                                                            ? '매칭중...'
                                                            : '매칭하기'}
                                                </button>
                                                {email.matchedOrderNumber && (
                                                    <span className="text-[10px] font-semibold text-emerald-700">
                                                        {email.matchedOrderNumber}
                                                    </span>
                                                )}
                                                {email.matchedOrderId && (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleUnmatchEmail(email)
                                                        }}
                                                        disabled={unmatchingEmailUid === email.uid}
                                                        className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold tracking-wide transition-colors ${
                                                            unmatchingEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-400 cursor-progress'
                                                                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                                                        }`}
                                                    >
                                                        {unmatchingEmailUid === email.uid ? '해제중...' : '매칭해제'}
                                                    </button>
                                                )}
                                            </div>
                                            {email.matchedOrderId && (
                                                <div className="mt-1.5 space-y-1 rounded-md border border-emerald-100 bg-emerald-50/60 px-2.5 py-1.5 text-[10px]">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-emerald-700">유닛프라이스</span>
                                                        <span className="font-bold text-emerald-900">
                                                            {formatUsdAmount(email.invoiceUnitPriceUsd)} · {formatKrwAmount(email.invoiceUnitPriceKrw)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-emerald-700">토탈어마운트</span>
                                                        <span className="font-bold text-emerald-900">
                                                            {formatUsdAmount(email.invoiceTotalAmountUsd)} · {formatKrwAmount(email.invoiceTotalAmountKrw)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 text-emerald-700/80">
                                                        <span className="font-medium">환율</span>
                                                        <span>{email.usdKrwRate !== null ? `1 USD = ₩${Math.round(email.usdKrwRate).toLocaleString()}` : '-'}</span>
                                                    </div>
                                                    {email.invoiceOcrError && (
                                                        <p className="font-semibold text-rose-600">{email.invoiceOcrError}</p>
                                                    )}
                                                </div>
                                            )}
                                            {email.awbNumber && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleCustomsProgressSearch(email.awbNumber || '', { scrollIntoView: true })
                                                        }}
                                                        className="inline-flex h-6 items-center rounded-md bg-[#e34219] px-2.5 text-[10px] font-bold tracking-wide text-white hover:bg-[#cd3b17] transition-colors"
                                                    >
                                                        조회하기
                                                    </button>
                                                    <p className={`text-[11px] font-semibold tracking-wide ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                                                        AWB {email.awbNumber}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 dark:bg-[#1a1a1a]/30 flex flex-col">
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
                                    <div className="p-6 bg-white dark:bg-[#1e1e1e] border-b border-gray-100 dark:border-[#2a2a2a] shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 dark:text-white leading-tight mb-2 pr-4">
                                            {selectedEmail.sequence ? `${selectedEmail.sequence}. ` : ''}
                                            {selectedEmail.subject}
                                        </h2>
                                        {selectedEmail.awbNumber && (
                                            <p className="mt-2 text-[12px] font-semibold tracking-wide text-blue-700">
                                                AWB {selectedEmail.awbNumber}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {formatSafeDateTime(selectedEmail.date)}</span>
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
                                    <div className="p-6 overflow-y-auto bg-white dark:bg-[#1e1e1e] flex-1 text-[14px]">
                                        <EmailBodyPreview loading={loadingEmailDetail} text={selectedEmail.text} />
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
                <div ref={docInboxSectionRef} id="worm-pipeline-step-4" style={{ order: 40 }} className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden relative">

                {docFetchProgress > 0 && (
                    <div className="absolute top-0 left-0 w-full h-[4px] bg-slate-100 z-10 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${docFetchProgress}%` }} />
                    </div>
                )}

                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-[#f0f5ff] dark:bg-[#1a1a1a] flex items-center justify-between mt-[2px]">
                    <div>
                        <h2 className="text-lg font-black text-[#1f2937] dark:text-white flex items-center gap-2">
                            <Package size={18} className="text-blue-500" />
                            메일센터 · AWB 문서
                            {loadingDocEmails && <span className="flex h-2 w-2 ml-1"><span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                            documents 메일을 이 발주에 매칭하고 AWB를 추출합니다.
                        </p>
                    </div>
                    <button
                        onClick={fetchDocumentEmails}
                        disabled={loadingDocEmails}
                        className="h-9 px-4 bg-blue-700 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-colors relative overflow-hidden"
                    >
                        {loadingDocEmails && <Loader2 size={14} className="animate-spin relative z-10" />}
                        <span className="relative z-10">{loadingDocEmails ? '스캔 중...' : matchedAwbEmail ? '새 메일 찾기' : '메일 스캔'}</span>
                    </button>
                </div>
                <div className="flex flex-col md:flex-row min-h-[500px] border-t border-gray-100 dark:border-[#2a2a2a]">
                    {/* 좌측 리스트 패널 */}
                    <div className="w-full md:w-[35%] bg-white dark:bg-[#1e1e1e] border-r border-gray-100 dark:border-[#2a2a2a] overflow-y-auto max-h-[600px] relative">
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
                            <div className="p-10 text-center text-[13px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-[#1a1a1a]/50 mt-10">
                                &apos;documents&apos; 제목 메일이 없습니다.
                            </div>
                        )}

                        {!loadingDocEmails && docEmails.length > 0 && (
                            <div className="divide-y divide-gray-100">
                                {docEmails.map((email, index) => {
                                    const isSelected = selectedDocEmailUid === email.uid
                                    const isMatched = email.matchedOrderId === activeWormOrder?.id
                                    return (
                                        <div
                                            key={email.uid}
                                            className={`w-full text-left p-4 transition-colors ${
                                                isMatched && isSelected
                                                    ? 'bg-blue-200/60 border-l-4 border-blue-700 pl-[13px]'
                                                    : isMatched
                                                    ? 'bg-blue-100/70 border-l-4 border-blue-600 pl-[13px] hover:bg-blue-200/60'
                                                    : isSelected
                                                    ? 'bg-blue-50/50 border-l-[3px] border-blue-500 pl-[13px]'
                                                    : 'border-l-[3px] border-transparent pl-4 hover:bg-slate-50 dark:hover:bg-[#252525]'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDocEmailUid(email.uid)}
                                                className="w-full text-left"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[11px] font-bold ${isMatched ? 'text-blue-700' : isSelected ? 'text-blue-500' : 'text-gray-400'}`}>
                                                        {formatSafeDate(email.date)}
                                                    </span>
                                                    {email.hasAttachments && <span className="text-[11px]">📎</span>}
                                                </div>
                                                <h3 className={`text-[14px] font-bold leading-snug line-clamp-2 ${isMatched || isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                    {index + 1}. {email.subject}
                                                </h3>
                                            </button>
                                            {/* 매칭/해제 버튼 */}
                                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        void handleMatchDocEmailToOrder(email)
                                                    }}
                                                    disabled={email.matchedOrderId === activeWormOrder?.id || !activeWormOrder?.id || matchingDocEmailUid === email.uid}
                                                    className={`inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-bold tracking-wide transition-colors ${
                                                        email.matchedOrderId === activeWormOrder?.id
                                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                            : matchingDocEmailUid === email.uid
                                                                ? 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-[#2a2a2a] cursor-progress'
                                                                : activeWormOrder?.id
                                                                    ? 'bg-slate-800 text-white hover:bg-slate-700 cursor-pointer'
                                                                    : 'bg-slate-100 dark:bg-[#1a1a1a] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-[#2a2a2a] cursor-not-allowed'
                                                    }`}
                                                >
                                                    {email.matchedOrderId === activeWormOrder?.id
                                                        ? '매칭완료'
                                                        : matchingDocEmailUid === email.uid
                                                            ? '매칭중...'
                                                            : '매칭하기'}
                                                </button>
                                                {email.matchedOrderNumber && (
                                                    <span className="text-[10px] font-semibold text-emerald-700">
                                                        {email.matchedOrderNumber}
                                                    </span>
                                                )}
                                                {email.matchedOrderId && (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void handleUnmatchDocEmail(email)
                                                        }}
                                                        disabled={unmatchingDocEmailUid === email.uid}
                                                        className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-bold tracking-wide transition-colors ${
                                                            unmatchingDocEmailUid === email.uid
                                                                ? 'bg-slate-100 text-slate-400 cursor-progress'
                                                                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 cursor-pointer'
                                                        }`}
                                                    >
                                                        {unmatchingDocEmailUid === email.uid ? '해제중...' : '매칭해제'}
                                                    </button>
                                                )}
                                            </div>
                                            {email.awbNumber && (
                                                <div className="mt-1.5 flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            handleCustomsProgressSearch(email.awbNumber || '', { scrollIntoView: true })
                                                        }}
                                                        className="inline-flex h-6 items-center rounded-md bg-blue-600 px-2.5 text-[10px] font-bold tracking-wide text-white hover:bg-blue-700 transition-colors"
                                                    >
                                                        통관조회
                                                    </button>
                                                    <p className={`text-[11px] font-semibold tracking-wide ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                                                        AWB {email.awbNumber}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* 우측 본문 렌더링 패널 */}
                    <div className="w-full md:w-[65%] bg-gray-50/30 dark:bg-[#1a1a1a]/30 flex flex-col">
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
                                    <div className="p-6 bg-white dark:bg-[#1e1e1e] border-b border-gray-100 dark:border-[#2a2a2a] shrink-0">
                                        <h2 className="text-[18px] font-black text-gray-900 dark:text-white leading-tight mb-2 pr-4">
                                            {selectedDoc.subject}
                                        </h2>
                                        {selectedDoc.awbNumber && (
                                            <p className="mt-2 text-[12px] font-semibold tracking-wide text-blue-700">
                                                AWB {selectedDoc.awbNumber}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium tracking-tight">
                                            <span>수신일시: {formatSafeDateTime(selectedDoc.date)}</span>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <button
                                                onClick={handleRunDocAwbOcr}
                                                disabled={loadingDocEmailDetail || awbLoading || selectedDoc.skmIndices.length === 0}
                                                className="h-11 px-4 rounded-lg bg-slate-950 text-white text-[12px] font-bold disabled:opacity-50"
                                            >
                                                {awbLoading ? '분석 중...' : '빠른 AWB 인식'}
                                            </button>
                                            {loadingDocEmailDetail ? (
                                                <span className="text-[12px] text-slate-500 dark:text-gray-400 font-medium">메일 상세를 불러오는 중입니다...</span>
                                            ) : (
                                                <span className="text-[12px] text-slate-500 dark:text-gray-400 font-medium">
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
                                                        <span className="text-[13px] font-bold">
                                                            {awbScanMode === 'fast' ? '빠른 분석' : '정밀 분석'} · {awbProgressLabel || 'Air Waybill 번호를 읽는 중...'}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={cancelAwbOcr}
                                                            className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 text-[11px] font-bold text-blue-700"
                                                        >
                                                            <X size={13} />
                                                            중지
                                                        </button>
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
                                                                    void navigator.clipboard.writeText(awbNumber).then(() => {
                                                                        setAwbCopied(true)
                                                                        window.setTimeout(() => setAwbCopied(false), 1800)
                                                                    })
                                                                }}
                                                                className="h-11 px-4 bg-blue-600 text-white font-bold text-[13px] rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1.5 shrink-0"
                                                            >
                                                                <Copy size={14} />
                                                                {awbCopied ? '복사됨' : '복사'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                                {awbCandidates.filter((candidate) => candidate.value !== awbNumber).length > 0 && !awbLoading && (
                                                    <div className="mt-1 pt-2 border-t border-blue-100/70 flex flex-wrap items-center gap-2">
                                                        <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400">대안 후보</span>
                                                        {awbCandidates.filter((candidate) => candidate.value !== awbNumber).slice(0, 6).map((candidate) => (
                                                            <button
                                                                key={`${candidate.value}-${candidate.source}`}
                                                                onClick={() => {
                                                                    setAwbNumber(candidate.value)
                                                                    setAwbError('')
                                                                    persistAwbCache(selectedDoc.uid, candidate.value, selectedDoc)
                                                                }}
                                                                className="h-10 px-3 rounded-md border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] text-[11px] font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors"
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
                                                {awbMonitorNotice && !awbLoading && (
                                                    <div className="text-[11px] font-bold text-emerald-700">
                                                        {awbMonitorNotice}
                                                    </div>
                                                )}
                                                {!awbLoading && (awbError || !awbNumber) && (
                                                    <div className="mt-1 grid gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                                                        <button
                                                            type="button"
                                                            onClick={() => { void handleRunPreciseDocAwbOcr() }}
                                                            disabled={selectedDoc.skmIndices.length === 0}
                                                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-[12px] font-bold text-slate-700 disabled:opacity-50"
                                                        >
                                                            <ScanSearch size={14} />
                                                            정밀 재스캔
                                                        </button>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            maxLength={13}
                                                            value={awbManualInput}
                                                            onChange={(event) => setAwbManualInput(event.target.value)}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter') void handleSaveManualAwb()
                                                            }}
                                                            placeholder="AWB 11자리 직접 입력"
                                                            className="h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => { void handleSaveManualAwb() }}
                                                            disabled={!awbManualInput.trim()}
                                                            className="h-11 rounded-lg bg-slate-900 px-4 text-[12px] font-bold text-white disabled:opacity-40"
                                                        >
                                                            저장
                                                        </button>
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
                                    <div className="p-6 overflow-y-auto bg-white dark:bg-[#1e1e1e] flex-1 text-[14px]">
                                        <EmailBodyPreview loading={loadingDocEmailDetail} text={selectedDoc.text} />
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
                </div>
            )}

            {showRemittanceTools && (
                <div ref={remittanceSectionRef} id="worm-pipeline-step-3" style={{ order: 30 }} className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-black text-[#111827]">모인 자동 송금 신청</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            자동 연동 또는 수동 입력(PDF/금액)으로 송금 신청을 실행할 수 있습니다.
                        </p>
                        {activeWormOrder && (
                            <p className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 mt-1">
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

                <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] p-1 grid grid-cols-2 gap-1 bg-slate-50 dark:bg-[#1a1a1a]">
                    <button
                        type="button"
                        onClick={() => setUseManualRemittanceInput(false)}
                        className={`h-9 rounded-lg text-[12px] font-bold transition-colors ${
                            !useManualRemittanceInput
                                ? 'bg-[#111827] text-white'
                                : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-gray-400'
                        }`}
                    >
                        자동 연동
                    </button>
                    <button
                        type="button"
                        onClick={() => setUseManualRemittanceInput(true)}
                        className={`h-9 rounded-lg text-[12px] font-bold transition-colors ${
                            useManualRemittanceInput
                                ? 'bg-[#111827] text-white'
                                : 'bg-white dark:bg-[#1e1e1e] text-slate-600 dark:text-gray-400'
                        }`}
                    >
                        수동 입력
                    </button>
                </div>

                {!useManualRemittanceInput ? (
                    matchedInvoiceEmail ? (
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                            <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.16em]">인보이스 자동 연동</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">송금 금액 (USD)</p>
                                    <p className="text-[15px] font-black text-slate-900 dark:text-white">
                                        {autoTransferAmountUsd !== null ? `$${autoTransferAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">인보이스 PDF</p>
                                    <p className="text-[13px] font-bold text-slate-700 truncate">{matchedInvoiceEmail.subject}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-[12px] font-semibold text-amber-700">
                            인보이스 메일을 발주에 매칭하면 송금 금액과 PDF가 자동으로 연동됩니다.
                        </div>
                    )
                ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-[#2a2a2a] bg-slate-50/60 dark:bg-[#1a1a1a] p-4 space-y-3">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-[0.16em]">수동 송금 입력</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400">송금 금액 (USD)</label>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={transferAmountUsd}
                                    onChange={(event) => setTransferAmountUsd(event.target.value)}
                                    placeholder="예: 5800.00"
                                    className="h-10 w-full rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] px-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#e34219]"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-slate-600 dark:text-gray-400">인보이스 PDF</label>
                                <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={(event) => {
                                        const nextFile = event.target.files?.[0] || null
                                        setInvoicePdf(nextFile)
                                    }}
                                    className="block w-full text-[12px] file:mr-2 file:h-9 file:rounded-lg file:border-0 file:bg-[#111827] file:px-3 file:text-xs file:font-bold file:text-white hover:file:bg-black"
                                />
                                {invoicePdf && (
                                    <p className="text-[11px] font-semibold text-slate-600 dark:text-gray-400 truncate">
                                        선택됨: {invoicePdf.name}
                                    </p>
                                )}
                            </div>
                        </div>

                        {(invoicePreviewLoading || invoicePreviewUrl || invoicePreviewError) && (
                            <div className="rounded-lg border border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] p-3">
                                {invoicePreviewLoading && (
                                    <p className="text-[12px] text-slate-500 dark:text-gray-400 inline-flex items-center gap-1.5">
                                        <Loader2 size={13} className="animate-spin" />
                                        PDF 미리보기 생성 중...
                                    </p>
                                )}
                                {!invoicePreviewLoading && invoicePreviewError && (
                                    <p className="text-[12px] font-semibold text-amber-700">{invoicePreviewError}</p>
                                )}
                                {!invoicePreviewLoading && !invoicePreviewError && invoicePreviewUrl && (
                                    <img src={invoicePreviewUrl} alt="Invoice preview" className="max-h-52 rounded-md border border-slate-200 dark:border-[#2a2a2a]" />
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                        {useManualRemittanceInput
                            ? '수동 입력한 송금 금액(USD)과 PDF로 모인 자동 송금 신청을 실행합니다.'
                            : '매칭된 인보이스의 토탈어마운트(USD)와 PDF 첨부파일로 자동 송금 신청합니다.'}
                    </p>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={handleRemittanceApply}
                            disabled={remittanceRunDisabled}
                            className="h-11 px-6 bg-[#111827] hover:bg-black text-white rounded-lg font-bold text-sm tracking-wide disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 w-full md:w-auto"
                        >
                            {!activeWormOrderRecord ? (
                                '발주선택'
                            ) : useManualRemittanceInput && !isManualRemittanceReady ? (
                                '수동 입력 필요'
                            ) : !useManualRemittanceInput && !isAutoRemittanceReady ? (
                                '인보이스 매칭 필요'
                            ) : isActiveOrderRemittanceApplied ? (
                                '송금완료'
                            ) : isRemittanceLocked ? (
                                `잠금 ${remittanceLockRemainingText}`
                            ) : remittanceServerRunActive ? (
                                '기존 실행중'
                            ) : remittanceSubmitting ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    송금 실행중...
                                </>
                            ) : (
                                '송금 실행'
                            )}
                        </button>

                        {(remittanceSubmitting || remittanceCancelling || remittanceServerRunActive) && (
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
                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">
                        발주리스트에서 대상 발주를 먼저 선택해 주세요.
                    </p>
                )}

                {(remittanceSubmitting || remittanceProgress > 0 || !!remittanceSuccess) && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className={remittanceError ? 'text-red-600' : remittanceSuccess ? 'text-emerald-700' : 'text-slate-600 dark:text-gray-400'}>
                                {remittanceProgressLabel}
                            </span>
                            <span className={remittanceError ? 'text-red-600' : remittanceSuccess ? 'text-emerald-700' : 'text-slate-500 dark:text-gray-400'}>
                                {Math.max(0, Math.min(100, Math.round(remittanceProgress)))}%
                            </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-[#2a2a2a] overflow-hidden">
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
                {effectiveRemittancePricingSummary && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-3">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.16em]">송금 확정 정보</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">최종 수취금액</p>
                                <p className="text-[15px] font-black text-slate-900 dark:text-white">{effectiveRemittancePricingSummary.finalReceiveAmount || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">보내는 돈</p>
                                <p className="text-[15px] font-black text-slate-900 dark:text-white">{effectiveRemittancePricingSummary.sendAmount || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">총수수료</p>
                                <p className="text-[15px] font-black text-slate-900 dark:text-white">{effectiveRemittancePricingSummary.totalFee || '-'}</p>
                            </div>
                            <div className="rounded-lg border border-emerald-100 bg-white dark:bg-[#1e1e1e] px-3 py-2">
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">적용환율</p>
                                <p className="text-[15px] font-black text-slate-900 dark:text-white">{effectiveRemittancePricingSummary.exchangeRate || '-'}</p>
                            </div>
                        </div>
                        {remittanceSaveInfo && (
                            <p className="text-xs font-semibold text-emerald-700">
                                발주 DB 저장 완료: {remittanceSaveInfo.orderNumber} / {formatSafeDateTime(remittanceSaveInfo.savedAt)}
                            </p>
                        )}
                    </div>
                )}
                {remittanceSaveWarning && (
                    <p className="text-xs font-semibold text-amber-700">{remittanceSaveWarning}</p>
                )}

                </div>
            )}
            {showCustomsTools && (
                <div ref={customsProgressSectionRef} id="worm-pipeline-step-5" style={{ order: 50 }} className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none p-4 space-y-4 md:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-black text-[#111827] md:text-lg">유니패스 수입 통관 조회</h3>
                        <p className="mt-1 text-[11px] leading-snug text-gray-500 md:text-xs">
                            B/L 번호만 입력하면 MBL/HBL + 현재/최근/다음 연도를 자동으로 시도해 조회합니다. (하이픈/공백은 자동 제거)
                        </p>
                    </div>
                    <Search size={18} className="text-[#e34219] mt-1" />
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                                <Mail size={17} />
                            </span>
                            <div>
                                <p className="text-sm font-black text-emerald-950">수입신고 수리 자동 이메일</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                                    유니패스를 10분마다 확인하고 수입신고 수리가 확인되면 이메일을 한 번 발송한 뒤 감시를 종료합니다.
                                </p>
                            </div>
                        </div>
                        <span className={`inline-flex h-7 shrink-0 items-center rounded-md border px-2.5 text-[11px] font-black ${
                            isAwbMonitorComplete
                                ? 'border-emerald-300 bg-white text-emerald-700'
                                : isAwbMonitorFailed
                                    ? 'border-red-200 bg-red-50 text-red-700'
                                : persistedAwbNumber
                                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 bg-white text-slate-500'
                        }`}>
                            {isAwbMonitorComplete
                                ? '발송 완료'
                                : isAwbMonitorFailed
                                    ? '등록 오류'
                                : persistedAwbNumber
                                    ? '감시 중'
                                    : 'AWB 등록 대기'}
                        </span>
                    </div>
                    <div className="mt-3 grid gap-2 border-t border-emerald-200 pt-3 text-xs font-bold text-emerald-900 sm:grid-cols-3">
                        <span>수신 · contact@beiko.com</span>
                        <span>조회 · 10분 간격</span>
                        <span>완료 · 발송 후 자동 종료</span>
                    </div>
                    {persistedAwbNumber && (
                        <p className="mt-2 text-xs font-semibold text-emerald-800">감시 AWB · {persistedAwbNumber}</p>
                    )}
                    {awbMonitorNotice && (
                        <p className="mt-2 text-xs font-semibold text-emerald-800">{awbMonitorNotice}</p>
                    )}
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
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#e34219] px-6 text-sm font-bold tracking-wide text-white hover:bg-[#cd3b17] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
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
                    <div className="rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-gray-50 dark:bg-[#1a1a1a] p-4 space-y-4">
                        <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                            <span><span className="font-bold text-gray-800">B/L:</span> {customsProgressResult.blNo}</span>
                            <span>
                                <span className="font-bold text-gray-800">조회조건:</span>{' '}
                                {customsProgressResult.query.kind}
                                {customsProgressResult.query.blYy ? ` / ${customsProgressResult.query.blYy}` : ''}
                            </span>
                            <span><span className="font-bold text-gray-800">결과건수(tCnt):</span> {customsProgressResult.tCnt}</span>
                        </div>

                        {customsProgressResult.ntceInfo && (
                            <p className="text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                {customsProgressResult.ntceInfo}
                            </p>
                        )}

                        {firstSummary && (
                            <div className="rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] p-3 space-y-2">
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
                            <div className="rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1e1e1e] p-3 space-y-2">
                                <h4 className="text-sm font-black text-[#111827] dark:text-white">진행이력</h4>
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
                                                                        <span className="text-[11px] font-medium text-slate-600 dark:text-gray-400">
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

            {showCargoCustomsMailTools && (
                <div
                    ref={cargoCustomsMailSectionRef}
                    id="worm-pipeline-step-7"
                    style={{ order: 70 }}
                    className="scroll-mt-4 bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none overflow-hidden"
                >
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-[#2a2a2a] bg-[#f0f9ff] dark:bg-[#1a1a1a] flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-[#111827] dark:text-white flex items-center gap-2">
                                <Mail size={18} className="text-sky-600" />
                                카고 / 관세사 문서전달
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">인보이스 + AWB 매칭이 완료되면 두 메일의 첨부파일을 한 번에 전달합니다.</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">DB 저장 첨부파일</p>
                                    <p className="mt-0.5 text-[12px] font-medium text-slate-600">
                                        현재 발주에 매칭된 인보이스/AWB 첨부만 표시합니다. JPG/JPEG는 저장 및 목록에서 제외됩니다.
                                    </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-sky-700 ring-1 ring-sky-200">
                                    {savedMatchedAttachments.length}개
                                </span>
                            </div>
                            {savedMatchedAttachments.length > 0 ? (
                                <div className="grid gap-2 md:grid-cols-2">
                                    {savedMatchedAttachments.map((attachment) => (
                                        <div key={attachment.key} className="rounded-lg border border-sky-100 bg-white px-3 py-2 shadow-sm">
                                            <div className="flex items-start gap-2">
                                                <FileText size={15} className={attachment.isPdf ? 'mt-0.5 text-red-500' : 'mt-0.5 text-sky-600'} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">
                                                            {attachment.sourceLabel}
                                                        </span>
                                                        <p className="min-w-0 truncate text-[12px] font-black text-slate-900">{attachment.filename}</p>
                                                    </div>
                                                    <p className="mt-1 truncate text-[11px] font-semibold text-slate-500">{attachment.subject}</p>
                                                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                                                        {attachment.contentType || 'application/octet-stream'} · {formatAttachmentFileSize(attachment.size)}
                                                    </p>
                                                </div>
                                                <a
                                                    href={attachment.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-sky-500"
                                                >
                                                    열기
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-sky-200 bg-white/70 px-3 py-3 text-[12px] font-semibold text-slate-500">
                                    현재 발주에 DB에서 불러올 저장 첨부파일이 없습니다. 인보이스와 AWB 문서를 매칭하면 여기에 바로 표시됩니다.
                                </div>
                            )}
                        </div>
                        {!isCustomsForwardReady ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[12px] font-semibold text-amber-700">
                                인보이스 메일과 AWB 메일을 현재 발주에 모두 매칭하면 발송이 활성화됩니다.
                            </div>
                        ) : (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-[12px] font-semibold text-emerald-700 space-y-1">
                                <p>매칭 완료: 인보이스 UID {matchedInvoiceEmail?.uid} / AWB UID {matchedAwbUid}</p>
                                <p>두 메일의 첨부파일을 모두 포함해서 발송합니다.</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">수신 이메일</label>
                            <input
                                type="email"
                                value={forwardEmail}
                                onChange={(event) => setForwardEmail(event.target.value)}
                                placeholder={DEFAULT_CUSTOMS_FORWARD_EMAIL}
                                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                            />
                            <p className="text-[11px] text-slate-500 dark:text-gray-400">기본값: {DEFAULT_CUSTOMS_FORWARD_EMAIL} (필요 시 변경 가능)</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider">통관 진행일</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={customsForwardDate}
                                    onChange={(event) => setCustomsForwardDate(event.target.value)}
                                    className="h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setCustomsForwardDate(todayKstYmd)}
                                    className="h-10 px-3 rounded-lg border border-gray-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                >
                                    오늘
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-gray-400">제목과 본문에 들어갈 날짜입니다. 기본값은 오늘(KST)이며 캘린더에서 변경할 수 있습니다.</p>
                        </div>

                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">발송 메일 미리보기</p>
                            <p className="text-sm font-bold text-slate-800">제목: {customsForwardSubject}</p>
                            <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700 font-medium">{customsForwardBody}</pre>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { void handleForwardEmail() }}
                                disabled={forwarding || !isCustomsForwardReady || !forwardEmail.trim()}
                                className="h-10 px-5 rounded-xl font-bold text-sm bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                {forwarding ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                {forwarding ? '발송 중...' : '발송하기'}
                            </button>
                            {forwardSuccess && <p className="text-sm font-semibold text-emerald-600">{forwardSuccess}</p>}
                            {forwardError && <p className="text-sm font-semibold text-[#e34219]">{forwardError}</p>}
                        </div>

                        <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">최근 발송 이력</p>
                            {forwardLogsLoading ? (
                                <p className="text-[12px] font-medium text-slate-500">발송 이력을 불러오는 중입니다.</p>
                            ) : forwardLogs.length > 0 ? (
                                <div className="space-y-2">
                                    {forwardLogs.map((log) => (
                                        <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                                            <p className="text-[12px] font-semibold text-slate-700">
                                                {formatSafeDateTime(log.createdAt)} · {log.toEmail}
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                발신계정 {log.fromEmail} · 첨부 {log.attachmentCount}개{log.sentByUserName ? ` · 처리자 ${log.sentByUserName}` : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[12px] font-medium text-slate-500">저장된 발송 이력이 없습니다.</p>
                            )}
                            {forwardLogsError && <p className="text-[12px] font-semibold text-[#e34219]">{forwardLogsError}</p>}
                        </div>
                    </div>
                </div>
            )}

            </div>

            {remittanceCandidates && remittanceCandidatesOrder && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
                    onClick={() => {
                        if (remittanceCandidatePicking) return
                        setRemittanceCandidates(null)
                        setRemittanceCandidatesOrder(null)
                        setRemittanceCandidateError('')
                    }}
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-slate-900">모인 거래내역에서 직접 선택</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    {remittanceCandidatesOrder.orderNumber} · 자동 매칭이 어려워 후보를 보여드립니다. 발주에 해당하는 거래를 클릭해 주세요.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (remittanceCandidatePicking) return
                                    setRemittanceCandidates(null)
                                    setRemittanceCandidatesOrder(null)
                                    setRemittanceCandidateError('')
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                                aria-label="닫기"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-2 overflow-y-auto">
                            {remittanceCandidates.map((candidate, index) => {
                                const tid = candidate.transactionId || ''
                                const isPicking = remittanceCandidatePicking === tid
                                const disabled = !tid || Boolean(remittanceCandidatePicking)
                                return (
                                    <button
                                        key={tid || `candidate-${index}`}
                                        type="button"
                                        onClick={() => { void handlePickRemittanceCandidate(candidate) }}
                                        disabled={disabled}
                                        className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-sky-300 hover:bg-sky-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                                <span>{candidate.dateText || '날짜 미상'}</span>
                                                {candidate.statusText && (
                                                    <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                        {candidate.statusText}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5 truncate">
                                                {candidate.recipient || '수취인 미상'}
                                            </p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                {[candidate.amountUsdText, candidate.sendAmountKrwText, candidate.totalFeeKrwText, candidate.exchangeRateText]
                                                    .filter(Boolean).join(' · ') || '금액 정보 없음'}
                                            </p>
                                        </div>
                                        {isPicking ? (
                                            <Loader2 size={16} className="animate-spin text-sky-600 shrink-0" />
                                        ) : (
                                            <ArrowRight size={16} className="text-slate-400 shrink-0" />
                                        )}
                                    </button>
                                )
                            })}
                            {remittanceCandidateError && (
                                <p className="text-xs font-semibold text-rose-600 mt-2">{remittanceCandidateError}</p>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                            <span>거래 ID 가 없는 후보는 클릭할 수 없습니다 — 직접 입력으로 저장해 주세요.</span>
                            <button
                                type="button"
                                onClick={() => {
                                    if (remittanceCandidatePicking) return
                                    setRemittanceCandidates(null)
                                    setRemittanceCandidatesOrder(null)
                                    setRemittanceCandidateError('')
                                    if (remittanceCandidatesOrder) openManualRemittanceModal(remittanceCandidatesOrder)
                                }}
                                disabled={Boolean(remittanceCandidatePicking)}
                                className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            >
                                직접 입력으로 전환
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {manualRemittanceOrder && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
                    onClick={() => { if (!manualRemittanceSaving) setManualRemittanceOrder(null) }}
                >
                    <div
                        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-slate-900">송금정보 직접 입력</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">{manualRemittanceOrder.orderNumber}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { if (!manualRemittanceSaving) setManualRemittanceOrder(null) }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                                aria-label="닫기"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">신청시각</label>
                                <input
                                    type="datetime-local"
                                    value={manualRemittanceForm.appliedAt}
                                    onChange={(event) => setManualRemittanceForm((prev) => ({ ...prev, appliedAt: event.target.value }))}
                                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">총 송금액 (USD)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="1050"
                                        value={manualRemittanceForm.finalReceiveAmountUsd}
                                        onChange={(event) => setManualRemittanceForm((prev) => ({ ...prev, finalReceiveAmountUsd: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">환율 (1 USD =)</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="1481.8829"
                                        value={manualRemittanceForm.exchangeRate}
                                        onChange={(event) => setManualRemittanceForm((prev) => ({ ...prev, exchangeRate: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">총 송금 한화 (KRW)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="1590589"
                                        value={manualRemittanceForm.sendAmountKrw}
                                        onChange={(event) => setManualRemittanceForm((prev) => ({ ...prev, sendAmountKrw: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">총 수수료 (KRW)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="34612"
                                        value={manualRemittanceForm.totalFeeKrw}
                                        onChange={(event) => setManualRemittanceForm((prev) => ({ ...prev, totalFeeKrw: event.target.value }))}
                                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium"
                                    />
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500">금액은 숫자만 입력하면 됩니다 (콤마/통화 기호 자동 제거).</p>
                            {manualRemittanceError && (
                                <p className="text-xs font-semibold text-rose-600">{manualRemittanceError}</p>
                            )}
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { if (!manualRemittanceSaving) setManualRemittanceOrder(null) }}
                                disabled={manualRemittanceSaving}
                                className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => { void handleSaveManualRemittance() }}
                                disabled={manualRemittanceSaving}
                                className="h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-black disabled:opacity-60 inline-flex items-center gap-1.5"
                            >
                                {manualRemittanceSaving && <Loader2 size={13} className="animate-spin" />}
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}

                </div>
            </div>
    )
}
