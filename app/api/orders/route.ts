import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendOrderNotification } from "@/lib/notification"
import { getProductImageUrl } from "@/lib/product-image-url"

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { items, total } = body // items: { productId, quantity }[]

        if (!items || items.length === 0) {
            return NextResponse.json({ error: "No items" }, { status: 400 })
        }

        // Transaction to create order and update stock
        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Verify stock for all items first
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } })
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`)
                }
                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}`)
                }
            }

            // 2. Deduct stock
            for (const item of items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } }
                })
            }

            // 3. Generate Order Number (YYYYMMDD + 3-digit sequence)
            const now = new Date()
            const yyyy = now.getFullYear()
            const mm = String(now.getMonth() + 1).padStart(2, '0')
            const dd = String(now.getDate()).padStart(2, '0')
            const datePrefix = `${yyyy}${mm}${dd}`

            const lastOrder = await tx.order.findFirst({
                where: {
                    orderNumber: {
                        startsWith: datePrefix
                    }
                },
                orderBy: {
                    orderNumber: 'desc'
                }
            })

            let sequenceNum = 1
            if (lastOrder && lastOrder.orderNumber) {
                const lastSeq = parseInt(lastOrder.orderNumber.slice(-3))
                if (!isNaN(lastSeq)) {
                    sequenceNum = lastSeq + 1
                }
            }
            const sequence = String(sequenceNum).padStart(3, '0')
            const orderNumber = `${datePrefix}${sequence}`

            // 4. Create Order
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId: session.user.id,
                    total,
                    items: {
                        create: items.map((item: any) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: { items: true }
            })

            // 5. Trigger Notification (Async, don't block response)
            sendOrderNotification({
                orderNumber: order.orderNumber,
                total: order.total,
                itemsCount: order.items.length,
                customerName: session.user.name || session.user.email || '고객'
            }).catch(err => console.error("Notification trigger error:", err));

            return order
        })

        return NextResponse.json(result)

    } catch (error: any) {
        console.error("Order Creation Error:", error)
        return NextResponse.json({ error: error.message || "Failed to create order" }, { status: 400 }) // Return 400 to show message to client
    }
}

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const whereClause = session.user.role === 'ADMIN' ? {} : { userId: session.user.id }

        const orders = await prisma.order.findMany({
            where: whereClause,
            select: {
                id: true,
                orderNumber: true,
                userId: true,
                total: true,
                createdAt: true,
                status: true,
                trackingNumber: true,
                courier: true,
                taxInvoiceIssued: true,
                depositConfirmedAt: true,
                adminDepositConfirmedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                        country: true,
                        partnerProfile: {
                            select: {
                                businessName: true,
                                representativeName: true,
                                grade: true,
                                businessRegNumber: true,
                                email: true,
                                contact: true,
                                address: true,
                            },
                        },
                    },
                },
                items: {
                    select: {
                        id: true,
                        productId: true,
                        quantity: true,
                        price: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                nameJP: true,
                                nameEN: true,
                                imageUrl: true,
                                productCode: true,
                                barcode: true,
                                updatedAt: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc'
            }
        })
        const ordersWithImageUrls = orders.map(order => ({
            ...order,
            items: order.items.map(item => {
                const { imageUrl, updatedAt, ...product } = item.product
                return {
                    ...item,
                    product: {
                        ...product,
                        imageUrl: imageUrl ? getProductImageUrl(product.id, updatedAt) : null,
                    },
                }
            }),
        }))

        return NextResponse.json(ordersWithImageUrls)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 })
    }
}
