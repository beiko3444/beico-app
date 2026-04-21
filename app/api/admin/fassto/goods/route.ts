import { NextResponse } from "next/server"
import { getGoodsList, createGoods, updateGoods, getGoodsElements } from "@/lib/fassto"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const mode = searchParams.get('mode')

        if (mode === 'elements') {
            const result = await getGoodsElements()
            return NextResponse.json(result)
        }

        const result = await getGoodsList()
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const result = await createGoods(Array.isArray(body) ? body : [body])
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json()
        const result = await updateGoods(Array.isArray(body) ? body : [body])
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
