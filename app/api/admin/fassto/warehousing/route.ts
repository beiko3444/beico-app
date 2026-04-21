import { NextResponse } from "next/server"
import { createWarehousing, getWarehousingList } from "@/lib/fassto"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const start = searchParams.get('start') || ''
        const end = searchParams.get('end') || ''

        if (!start || !end) {
            return NextResponse.json({ error: '시작일과 종료일을 입력해주세요.' }, { status: 400 })
        }

        const result = await getWarehousingList(start, end)
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const result = await createWarehousing(Array.isArray(body) ? body : [body])
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
