/**
 * 카드사용내역 자동 카테고리 분류 모듈
 * 프론트엔드 + 백엔드 공통으로 사용
 */

export type CategoryCode =
  | 'CAFE'
  | 'FOOD'
  | 'BAKERY'
  | 'TRANSPORT'
  | 'SHOPPING'
  | 'CONVENIENCE'
  | 'FUEL'
  | 'FINANCE'
  | 'TELECOM'
  | 'OFFICE'
  | 'MEDICAL'
  | 'EDUCATION'
  | 'ENTERTAINMENT'
  | 'OTHER'

export type CategoryMeta = {
  code: CategoryCode
  label: string
  emoji: string
  bgColor: string
}

export const CATEGORIES: CategoryMeta[] = [
  { code: 'CAFE',          label: '카페',     emoji: '☕',  bgColor: '#FFF3E0' },
  { code: 'FOOD',          label: '음식',     emoji: '🍽️', bgColor: '#FFF8E1' },
  { code: 'BAKERY',        label: '베이커리', emoji: '🥖',  bgColor: '#FFF8E1' },
  { code: 'TRANSPORT',     label: '교통',     emoji: '🚆',  bgColor: '#E3F2FD' },
  { code: 'SHOPPING',      label: '쇼핑',     emoji: '🛒',  bgColor: '#E8F5E9' },
  { code: 'CONVENIENCE',   label: '편의점',   emoji: '🛍️', bgColor: '#E8F5E9' },
  { code: 'FUEL',          label: '주유',     emoji: '⛽',  bgColor: '#FFF3E0' },
  { code: 'FINANCE',       label: '금융',     emoji: '💳',  bgColor: '#F3E5F5' },
  { code: 'TELECOM',       label: '통신',     emoji: '📱',  bgColor: '#E8EAF6' },
  { code: 'OFFICE',        label: '사무',     emoji: '🖨️', bgColor: '#ECEFF1' },
  { code: 'MEDICAL',       label: '의료',     emoji: '🏥',  bgColor: '#E8F5E9' },
  { code: 'EDUCATION',     label: '교육',     emoji: '📚',  bgColor: '#E3F2FD' },
  { code: 'ENTERTAINMENT', label: '문화',     emoji: '🎬',  bgColor: '#FCE4EC' },
  { code: 'OTHER',         label: '기타',     emoji: '📦',  bgColor: '#F5F5F5' },
]

export const CATEGORY_MAP: Record<string, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map(c => [c.code, c])
)

/* ─── 분류 규칙 (순서 중요: 먼저 매칭된 것 우선) ─── */
const RULES: Array<{ code: CategoryCode; pattern: RegExp }> = [
  // 카페
  { code: 'CAFE', pattern: /카페|커피|cafe|coffee|미루|스타벅스|이디야|투썸|빽다방|메가|컴포즈|할리스|엔제리너스|폴바셋|텐퍼센트|공차|파스쿠찌|드롭탑|빈스빈스|매머드|더벤티|바나프레소|로스터리/ },

  // 베이커리 (음식보다 먼저)
  { code: 'BAKERY', pattern: /베이커리|빵|파리바게뜨|뚜레쥬르|성심당|크로와상|도넛|던킨|크리스피|베이글|제과/ },

  // 음식
  { code: 'FOOD', pattern: /요리사|식당|레스토랑|밥|치킨|피자|버거|맥도날드|롯데리아|bbq|bhc|교촌|한솥|김밥|떡볶이|분식|맘스|배달|요기요|배민|쿠팡이츠|써브웨이|subway|오스루|음식|반찬|도시락|초밥|스시|라멘|우동|냉면|국수|불고기|삼겹|쭈꾸미|족발|보쌈|순대|곱창|감자탕|찌개|탕|중국집|짜장|짬뽕|볶음|한식|일식|양식|중식/ },

  // 교통
  { code: 'TRANSPORT', pattern: /코레일|ktx|srt|기차|철도|택시|카카오T|카카오택시|타다|고속|시외|버스|항공|대한항공|아시아나|제주항공|티웨이|진에어|에어부산|에어서울|이스타|주차|파킹|톨게이트|하이패스/ },

  // 편의점 (쇼핑보다 먼저)
  { code: 'CONVENIENCE', pattern: /편의점|cu\b|gs25|세븐일레븐|이마트24|미니스톱|씨유|지에스/ },

  // 쇼핑/온라인
  { code: 'SHOPPING', pattern: /네이버|쿠팡|gmarket|옥션|11번가|위메프|tmon|아마존|amazon|쇼핑|마트|이마트|홈플러스|코스트코|롯데마트|다이소|올리브영|무신사|ssg|인터파크/ },

  // 주유/충전
  { code: 'FUEL', pattern: /주유|gs칼텍스|sk에너지|s-oil|현대오일|충전|오일뱅크/ },

  // 금융
  { code: 'FINANCE', pattern: /헥토|바로빌|은행|보험|카드|금융|증권|투자|자산|펀드|대출|신용|국민|우리|하나|신한|농협|기업은행|수협|산업|수출입|새마을|우체국|카카오뱅크|토스/ },

  // 통신
  { code: 'TELECOM', pattern: /skt|sk텔레|케이티|kt\b|lg유플|알뜰|통신|인터넷|와이파이/ },

  // 사무
  { code: 'OFFICE', pattern: /사무|문구|오피스|프린트|복사|인쇄|잉크|토너|알파문구|모닝글로리/ },

  // 의료
  { code: 'MEDICAL', pattern: /병원|의원|약국|클리닉|치과|안과|피부과|내과|외과|정형|한의|한방|건강검진|약사|메디|팜/ },

  // 교육
  { code: 'EDUCATION', pattern: /학원|교육|학교|대학|강의|인강|클래스|아카데미|수강|입시/ },

  // 문화/오락
  { code: 'ENTERTAINMENT', pattern: /영화|CGV|메가박스|롯데시네마|극장|공연|콘서트|노래방|PC방|게임|볼링|당구|헬스|피트니스|짐|gym|스크린골프|골프|스파|사우나|찜질방|마사지/ },
]

/* ─── 업종(bizType) 기반 분류 ─── */
const BIZ_TYPE_RULES: Array<{ code: CategoryCode; pattern: RegExp }> = [
  { code: 'FOOD',          pattern: /음식|식당|한식|일식|양식|중식|분식|급식|외식|식품접객/ },
  { code: 'CAFE',          pattern: /카페|커피|다방|음료/ },
  { code: 'BAKERY',        pattern: /제과|제빵|베이커리/ },
  { code: 'TRANSPORT',     pattern: /운수|운송|택시|여객|항공|철도|물류|주차/ },
  { code: 'SHOPPING',      pattern: /소매|판매|도매|유통|백화점|마트|쇼핑|전자상거래/ },
  { code: 'CONVENIENCE',   pattern: /편의점/ },
  { code: 'FUEL',          pattern: /주유|석유|가스|에너지/ },
  { code: 'FINANCE',       pattern: /금융|보험|은행|증권|투자|신용|대출|캐피탈/ },
  { code: 'TELECOM',       pattern: /통신|이동전화|방송|인터넷/ },
  { code: 'OFFICE',        pattern: /사무|문구|인쇄|복사/ },
  { code: 'MEDICAL',       pattern: /의료|약국|의원|병원|의약|건강|치과|한의/ },
  { code: 'EDUCATION',     pattern: /교육|학원|학교|학습|강의/ },
  { code: 'ENTERTAINMENT', pattern: /오락|유흥|놀이|체육|스포츠|영화|공연|숙박|호텔|레저/ },
]

/**
 * 가맹점명과 업종 정보를 기반으로 카테고리 코드를 반환합니다.
 */
export function classifyCategory(
  storeName: string | null | undefined,
  bizType?: string | null | undefined,
): CategoryCode {
  const name = (storeName || '').toLowerCase()
  const biz = (bizType || '').toLowerCase()

  // 1순위: 업종(bizType) 기반
  if (biz) {
    for (const rule of BIZ_TYPE_RULES) {
      if (rule.pattern.test(biz)) return rule.code
    }
  }

  // 2순위: 가맹점명 기반
  if (name) {
    for (const rule of RULES) {
      if (rule.pattern.test(name)) return rule.code
    }
  }

  return 'OTHER'
}

/**
 * 카테고리 코드로부터 표시 정보(이모지, 배경색 등)를 가져옵니다.
 */
export function getCategoryMeta(code: string | null | undefined): CategoryMeta {
  return CATEGORY_MAP[code || ''] || CATEGORY_MAP['OTHER']
}
