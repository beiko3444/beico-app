export type InboundMobileMessageInput = {
  id: string
  sender: string | null
  senderName: string | null
  body: string
  messageType: string
  receivedAt: Date
  sourceDevice: string | null
  userName: string | null
}

export type OutgoingMobileMessageInput = {
  id: string
  toName: string | null
  toNumber: string
  body: string
  status: string
  createdAt: Date
  sentAt: Date | null
  failedAt: Date | null
  lastError: string | null
}

export type MobileConversationMessage = {
  id: string
  direction: 'INBOUND' | 'OUTBOUND'
  body: string
  at: Date
  status: string
  label: string
  sourceDevice: string | null
  error: string | null
}

export type MobileMessageThread = {
  id: string
  contactName: string
  phoneNumber: string
  lastMessagePreview: string
  lastMessageAt: Date
  inboundCount: number
  outboundCount: number
  messages: MobileConversationMessage[]
}

type BuildMobileMessageThreadsParams = {
  inboundMessages: InboundMobileMessageInput[]
  outgoingMessages: OutgoingMobileMessageInput[]
}

export function normalizeMobilePhoneNumber(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

function getMessageTime(message: OutgoingMobileMessageInput) {
  return message.sentAt || message.failedAt || message.createdAt
}

function getThreadName(currentName: string | null | undefined, nextName: string | null | undefined, phoneNumber: string) {
  const next = (nextName || '').trim()
  if (next) return next
  const current = (currentName || '').trim()
  return current || phoneNumber || '알 수 없음'
}

function createThread(phoneNumber: string, contactName: string): MobileMessageThread {
  return {
    id: phoneNumber || contactName,
    contactName: contactName || phoneNumber || '알 수 없음',
    phoneNumber,
    lastMessagePreview: '',
    lastMessageAt: new Date(0),
    inboundCount: 0,
    outboundCount: 0,
    messages: [],
  }
}

export function buildMobileMessageThreads({
  inboundMessages,
  outgoingMessages,
}: BuildMobileMessageThreadsParams) {
  const threads = new Map<string, MobileMessageThread>()

  for (const message of inboundMessages) {
    const phoneNumber = normalizeMobilePhoneNumber(message.sender)
    const key = phoneNumber || `inbound:${message.id}`
    const thread = threads.get(key) || createThread(phoneNumber, getThreadName(null, message.senderName, phoneNumber))
    thread.contactName = getThreadName(thread.contactName, message.senderName, phoneNumber)
    thread.inboundCount += 1
    thread.messages.push({
      id: message.id,
      direction: 'INBOUND',
      body: message.body,
      at: message.receivedAt,
      status: message.messageType || 'SMS',
      label: message.userName || '수신',
      sourceDevice: message.sourceDevice,
      error: null,
    })
    threads.set(key, thread)
  }

  for (const message of outgoingMessages) {
    const phoneNumber = normalizeMobilePhoneNumber(message.toNumber)
    const key = phoneNumber || `outgoing:${message.id}`
    const thread = threads.get(key) || createThread(phoneNumber, getThreadName(null, message.toName, phoneNumber))
    thread.contactName = getThreadName(thread.contactName, message.toName, phoneNumber)
    thread.outboundCount += 1
    thread.messages.push({
      id: message.id,
      direction: 'OUTBOUND',
      body: message.body,
      at: getMessageTime(message),
      status: message.status || 'PENDING',
      label: message.status || 'PENDING',
      sourceDevice: null,
      error: message.lastError,
    })
    threads.set(key, thread)
  }

  const result = Array.from(threads.values())
  for (const thread of result) {
    thread.messages.sort((a, b) => a.at.getTime() - b.at.getTime())
    const lastMessage = thread.messages[thread.messages.length - 1]
    if (lastMessage) {
      thread.lastMessagePreview = lastMessage.body
      thread.lastMessageAt = lastMessage.at
    }
  }

  return result.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
}

export function filterMobileMessageThreads(threads: MobileMessageThread[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  const phoneQuery = normalizeMobilePhoneNumber(query)
  if (!normalizedQuery && !phoneQuery) return threads

  return threads.filter((thread) => {
    const threadText = [
      thread.contactName,
      thread.phoneNumber,
      ...thread.messages.flatMap((message) => [
        message.body,
        message.status,
        message.label,
        message.sourceDevice || '',
      ]),
    ].join('\n').toLowerCase()

    return threadText.includes(normalizedQuery) || Boolean(phoneQuery && thread.phoneNumber.includes(phoneQuery))
  })
}
