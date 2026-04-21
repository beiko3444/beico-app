import { NextResponse } from "next/server"
import { getStockList } from "@/lib/fassto"

export async function GET() {
    try {
        const result = await getStockList()
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
