function compactText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function formatMoney(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${Math.round(number).toLocaleString('ko-KR')}원` : '-'
}

function stringifyData(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]),
  )
}

function createPayload({ title, body, url, data }) {
  return {
    title,
    body: compactText(body),
    url,
    data: stringifyData({
      ...data,
      url,
    }),
  }
}

export function buildNewOrderPushPayload({ orderNumber, customerName, total, itemsCount }) {
  return createPayload({
    title: '신규 주문 접수',
    body: `${customerName || '고객'} · ${orderNumber || '-'} · ${formatMoney(total)} · ${itemsCount || 0}개 상품`,
    url: '/admin/orders',
    data: {
      type: 'new_order',
      orderNumber,
      total,
      itemsCount,
    },
  })
}

export function buildMobileMessagePushPayload({ count, sender, body }) {
  const messageCount = Math.max(1, Number(count) || 1)
  return createPayload({
    title: `새 문자 ${messageCount}건`,
    body: `${sender || '알 수 없음'} · ${body || ''}`,
    url: '/admin/mobile-messages',
    data: {
      type: 'mobile_message',
      count: messageCount,
      sender,
    },
  })
}

function depositStatusLabel(status) {
  if (status === 'AUTO_CONFIRMED') return '자동 입금확인'
  if (status === 'AMBIGUOUS') return '후보 여러 건'
  if (status === 'UNMATCHED') return '매칭 없음'
  if (status === 'DUPLICATE_OR_ALREADY_CONFIRMED') return '이미 처리됨'
  return status || '확인 필요'
}

function depositTitle(status) {
  return status === 'AUTO_CONFIRMED' ? '입금 자동확인 완료' : '입금문자 확인 필요'
}

export function buildDepositMatchPushPayload({ matchStatus, amount, depositorName }) {
  return createPayload({
    title: depositTitle(matchStatus),
    body: `${depositorName || '입금자 미확인'} · ${formatMoney(amount)} · ${depositStatusLabel(matchStatus)}`,
    url: '/admin/orders',
    data: {
      type: 'deposit_sms',
      matchStatus,
      amount,
      depositorName,
    },
  })
}
