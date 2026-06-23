import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { buildMobileMessageThreads, filterMobileMessageThreads } from "@/lib/mobileMessageThreads"
import MobileMessagesChatClient, { type MobileMessagesChatThread } from "./MobileMessagesChatClient"

export const dynamic = 'force-dynamic'

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0] || ''
    return value || ''
}

function toClientThread(thread: ReturnType<typeof buildMobileMessageThreads>[number]): MobileMessagesChatThread {
    return {
        ...thread,
        lastMessageAt: thread.lastMessageAt.toISOString(),
        messages: thread.messages.map((message) => ({
            ...message,
            at: message.at.toISOString(),
        })),
    }
}

export default async function MobileMessagesPage({ searchParams }: PageProps) {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
        redirect('/login')
    }

    const params = (await searchParams) || {}
    const query = firstParam(params.q).trim()
    const [inboundMessages, outgoingMessages, totalInboundCount, totalOutgoingCount] = await Promise.all([
        prisma.mobileMessage.findMany({
            orderBy: { receivedAt: 'desc' },
            take: 1000,
            select: {
                id: true,
                messageType: true,
                sender: true,
                senderName: true,
                body: true,
                receivedAt: true,
                sourceDevice: true,
                user: {
                    select: {
                        name: true,
                        username: true,
                    },
                },
            },
        }),
        prisma.mobileOutgoingMessage.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
            select: {
                id: true,
                toName: true,
                toNumber: true,
                body: true,
                status: true,
                createdAt: true,
                sentAt: true,
                failedAt: true,
                lastError: true,
            },
        }),
        prisma.mobileMessage.count(),
        prisma.mobileOutgoingMessage.count(),
    ])

    const allThreads = buildMobileMessageThreads({
        inboundMessages: inboundMessages.map((message) => ({
            id: message.id,
            sender: message.sender,
            senderName: message.senderName,
            body: message.body,
            messageType: message.messageType,
            receivedAt: message.receivedAt,
            sourceDevice: message.sourceDevice,
            userName: message.user.name || message.user.username,
        })),
        outgoingMessages,
    })
    const threads = filterMobileMessageThreads(allThreads, query).map(toClientThread)

    return (
        <MobileMessagesChatClient
            initialQuery={query}
            threads={threads}
            totalInboundCount={totalInboundCount}
            totalOutgoingCount={totalOutgoingCount}
        />
    )
}
