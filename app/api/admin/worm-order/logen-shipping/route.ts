import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LogenAutomationCanceledError, LogenAutomationError, submitLogenShipping } from '@/lib/logenShipping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

type LogenRunningJob = {
    startedAt: number
    abortController: AbortController
}

const globalLogenGuard = globalThis as typeof globalThis & {
    logenShippingInFlight?: boolean
    logenShippingRunningJob?: LogenRunningJob | null
}

export async function DELETE() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const runningJob = globalLogenGuard.logenShippingRunningJob
    if (!runningJob) {
        return NextResponse.json({
            ok: true,
            canceled: false,
            message: '현재 진행 중인 로젠 운송장 발행이 없습니다.',
        })
    }

    runningJob.abortController.abort()
    return NextResponse.json({
        ok: true,
        canceled: true,
        message: '로젠 운송장 발행 취소 요청을 접수했습니다.',
    })
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()

        const { recipientPhone, recipientName, recipientAddress, recipientDetailAddress } = body as {
            recipientPhone?: string
            recipientName?: string
            recipientAddress?: string
            recipientDetailAddress?: string
        }

        if (!recipientPhone || !recipientName || !recipientAddress) {
            return NextResponse.json(
                { error: '수하인 전화번호, 이름, 주소는 필수 입력 항목입니다.' },
                { status: 400 }
            )
        }

        const loginId = (process.env.LOGEN_LOGIN_ID || '54751300').trim()
        const loginPassword = process.env.LOGEN_LOGIN_PASSWORD || 'dprtmxmfozj1!'
        const senderPhone = '010-8119-3313'
        const senderName = '엑스트래커'

        if (globalLogenGuard.logenShippingInFlight) {
            return NextResponse.json(
                { error: '이미 로젠 운송장 발행이 진행 중입니다. 잠시 후 다시 시도해 주세요.' },
                { status: 409 }
            )
        }

        const abortController = new AbortController()
        const runningJob: LogenRunningJob = {
            startedAt: Date.now(),
            abortController,
        }

        globalLogenGuard.logenShippingInFlight = true
        globalLogenGuard.logenShippingRunningJob = runningJob

        const steps: string[] = []

        try {
            const result = await submitLogenShipping({
                loginId,
                loginPassword,
                recipientPhone: recipientPhone.trim(),
                recipientName: recipientName.trim(),
                recipientAddress: recipientAddress.trim(),
                recipientDetailAddress: (recipientDetailAddress || '').trim(),
                senderPhone,
                senderName,
                headless: process.env.LOGEN_HEADLESS !== 'false',
                signal: abortController.signal,
                onStep: (step) => {
                    steps.push(step)
                    console.log(`[LogenShipping API] Step: ${step}`)
                },
            })

            return NextResponse.json({
                ok: true,
                message: '로젠 운송장 발행이 완료되었습니다.',
                trackingNumber: result.trackingNumber,
                steps,
            })
        } catch (error) {
            if (error instanceof LogenAutomationCanceledError) {
                return NextResponse.json(
                    {
                        error: '로젠 운송장 발행이 사용자 요청으로 취소되었습니다.',
                        canceled: true,
                        steps,
                    },
                    { status: 409 }
                )
            }

            if (error instanceof LogenAutomationError) {
                return NextResponse.json(
                    {
                        error: `${error.step}: ${error.message}`,
                        steps,
                    },
                    { status: 502 }
                )
            }

            console.error('Failed to submit Logen shipping:', error)
            const detail = error instanceof Error ? error.message : 'Unknown error'
            return NextResponse.json(
                {
                    error: `로젠 운송장 자동화 실패: ${detail}`,
                    steps,
                },
                { status: 500 }
            )
        } finally {
            globalLogenGuard.logenShippingInFlight = false
            globalLogenGuard.logenShippingRunningJob = null
        }
    } catch (error) {
        console.error('Failed to process Logen shipping request:', error)
        const detail = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { error: `요청 처리 실패: ${detail}` },
            { status: 500 }
        )
    }
}
