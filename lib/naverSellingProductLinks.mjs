const NAVER_SELLING_GROUPS = [
  {
    patterns: [['퀵베이트v3'], ['quickbaitv3']],
    url: 'https://smartstore.naver.com/xtr/products/13736901243',
  },
  {
    patterns: [['키비쯔', '갈치웜'], ['kibitsu', '갈치웜']],
    url: 'https://smartstore.naver.com/xtr/products/12410708825',
  },
  {
    patterns: [['토부에기', '시리즈2']],
    url: 'https://smartstore.naver.com/xtr/products/12355299485',
  },
  {
    patterns: [['토부에기', '시리즈1']],
    url: 'https://smartstore.naver.com/xtr/products/10436112807',
  },
  {
    patterns: [['드리프트', '탑워터'], ['플로퍼', '프롭베이트']],
    url: 'https://smartstore.naver.com/xtr/products/8543559255',
  },
  {
    patterns: [['머드벅', '크로피쉬']],
    url: 'https://smartstore.naver.com/xtr/products/8542165743',
  },
  {
    patterns: [['바텀베이트', '바닥웜']],
    url: 'https://smartstore.naver.com/xtr/products/8001407181',
  },
  {
    patterns: [['라이카프로970'], ['낚시플라이어', '지깅플라이어']],
    url: 'https://smartstore.naver.com/xtr/products/7991540138',
  },
  {
    patterns: [['스위밍', '저크베이트']],
    url: 'https://smartstore.naver.com/xtr/products/7584469159',
  },
  {
    patterns: [['케이무라', '캐스팅에기']],
    url: 'https://smartstore.naver.com/xtr/products/6736450926',
  },
  {
    patterns: [['리얼세그먼트', '스윔', '빅베이트']],
    url: 'https://smartstore.naver.com/xtr/products/6307816369',
  },
]

function normalizeProductText(value) {
  return String(value || '')
    .toLocaleLowerCase('ko-KR')
    .replace(/beiko|xtracker|엑스트래커|상품\s*그룹|정품/g, '')
    .replace(/[^0-9a-z가-힣]+/g, '')
}

export function getNaverSellingProductUrl(groupName, productNames = []) {
  const searchText = normalizeProductText([groupName, ...productNames].filter(Boolean).join(' '))
  if (!searchText) return null

  for (const entry of NAVER_SELLING_GROUPS) {
    const matched = entry.patterns.some((pattern) => (
      pattern.every((term) => searchText.includes(normalizeProductText(term)))
    ))
    if (matched) return entry.url
  }

  return null
}

export const NAVER_SELLING_PRODUCT_LINKS = NAVER_SELLING_GROUPS.map(({ url }) => url)
