import assert from 'node:assert/strict'
import test from 'node:test'

const threads = await import('../lib/mobileMessageThreads.ts')

test('groups inbound and outbound messages into one conversation by phone number', () => {
  const result = threads.buildMobileMessageThreads({
    inboundMessages: [
      {
        id: 'in-1',
        sender: '010-6665-6245',
        senderName: '김희경씨',
        body: '네 나중에 해볼게요',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-23T00:12:00+09:00'),
        sourceDevice: 'device-a',
        userName: 'BEIKO',
      },
    ],
    outgoingMessages: [
      {
        id: 'out-1',
        toName: '김희경씨',
        toNumber: '01066656245',
        body: '확인했습니다',
        status: 'SENT',
        createdAt: new Date('2026-06-23T00:15:00+09:00'),
        sentAt: new Date('2026-06-23T00:15:30+09:00'),
        failedAt: null,
        lastError: null,
      },
    ],
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].contactName, '김희경씨')
  assert.equal(result[0].phoneNumber, '01066656245')
  assert.equal(result[0].messages.length, 2)
  assert.deepEqual(result[0].messages.map((message) => message.direction), ['INBOUND', 'OUTBOUND'])
  assert.equal(result[0].lastMessagePreview, '확인했습니다')
})

test('sorts conversations by newest activity first', () => {
  const result = threads.buildMobileMessageThreads({
    inboundMessages: [
      {
        id: 'older',
        sender: '01011112222',
        senderName: null,
        body: '먼저 온 문자',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-22T10:00:00+09:00'),
        sourceDevice: null,
        userName: 'BEIKO',
      },
      {
        id: 'newer',
        sender: '01033334444',
        senderName: '새 연락처',
        body: '최근 문자',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-23T10:00:00+09:00'),
        sourceDevice: null,
        userName: 'BEIKO',
      },
    ],
    outgoingMessages: [],
  })

  assert.equal(result[0].phoneNumber, '01033334444')
  assert.equal(result[1].phoneNumber, '01011112222')
})

test('filters conversations while keeping all messages in the matched thread', () => {
  const allThreads = threads.buildMobileMessageThreads({
    inboundMessages: [
      {
        id: 'in-1',
        sender: '01011112222',
        senderName: '설치기사',
        body: '목요일에 설치 가능합니다',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-22T10:00:00+09:00'),
        sourceDevice: null,
        userName: 'BEIKO',
      },
      {
        id: 'in-2',
        sender: '01011112222',
        senderName: '설치기사',
        body: '감사합니다',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-22T10:10:00+09:00'),
        sourceDevice: null,
        userName: 'BEIKO',
      },
      {
        id: 'in-3',
        sender: '01033334444',
        senderName: '다른 연락처',
        body: '별도 문의',
        messageType: 'SMS',
        receivedAt: new Date('2026-06-22T11:00:00+09:00'),
        sourceDevice: null,
        userName: 'BEIKO',
      },
    ],
    outgoingMessages: [],
  })

  const result = threads.filterMobileMessageThreads(allThreads, '목요일')

  assert.equal(result.length, 1)
  assert.equal(result[0].contactName, '설치기사')
  assert.equal(result[0].messages.length, 2)
})
