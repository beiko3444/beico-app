# 카드사용내역(Card Usage) 기능 이관 가이드

베이코앱(beico-app)에 구현된 **카드사용내역 관리 기능**을 다른 Next.js 프로젝트로 옮기기 위한 종합 문서입니다.
파일 경로 / 환경변수 / 의존성 / 데이터 흐름을 정리했으니 이 문서만 보고도 옮긴 후 동작시킬 수 있도록 작성했습니다.

---

## 1. 기능 요약

- **바로빌(Barobill) SOAP API**로 법인카드 승인 내역을 수집해 PostgreSQL에 저장
- **쿠팡(Coupang) 개인 구매 내역**을 Playwright 스크래핑으로 수집
- 카드 사용 내역 ↔ 쿠팡 주문을 **금액 + 날짜(±2일) + "쿠팡" 키워드** 기준으로 자동 매칭
- 가맹점명/업종 기반 **카테고리 자동 분류**(카페, 음식, 교통, 쇼핑 등 14종)
- 관리자 UI에서 메모/카테고리/검토 상태/수동 매칭 편집
- 표(Table) / 리스트(List) / 캘린더(Calendar) 3가지 뷰 모드, 사용자 커스텀 카테고리(localStorage)

---

## 2. 의존성

`package.json`에 다음 패키지를 추가하세요. (베이코앱 기준 버전)

```json
{
  "dependencies": {
    "@prisma/client": "^5.10.2",
    "@sparticuz/chromium": "^143.0.4",
    "playwright-core": "^1.59.0",
    "soap": "^1.8.0",
    "next-auth": "^4.24.13",
    "http-proxy-agent": "^7.0.2",
    "https-proxy-agent": "^7.0.6",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "lucide-react": "^0.563.0",
    "recharts": "^3.7.0"
  },
  "devDependencies": {
    "prisma": "^5.10.2"
  }
}
```

- `soap` : 바로빌 SOAP 호출용
- `@sparticuz/chromium` + `playwright-core` : 서버리스(Vercel/Lambda)에서 쿠팡 스크래핑용 Chromium
- `@dnd-kit/*` : 카테고리 순서 드래그앤드롭
- `recharts` : 캘린더/통계 차트 (선택)
- `lucide-react` : 아이콘

---

## 3. 환경변수

`.env.local` 또는 호스팅 환경에 다음을 등록합니다.

```bash
# 데이터베이스 (PostgreSQL)
DATABASE_URL="postgresql://user:pass@host:5432/dbname?schema=public"
DIRECT_URL="postgresql://user:pass@host:5432/dbname?schema=public"

# 바로빌 (필수)
BAROBILL_CERTKEY="발급받은_인증키"
BAROBILL_CORP_NUM="사업자번호(하이픈 없음)"
BAROBILL_CARD_ID="바로빌 카드 계정 ID"
BAROBILL_CONTACT_ID="바로빌 담당자 ID(대체용)"

# 쿠팡 스크래핑 (선택 — UI에서 입력받아도 됨)
COUPANG_USER_LOGIN_ID="coupang@email.com"
COUPANG_USER_LOGIN_PASSWORD="비밀번호"
COUPANG_USER_HEADLESS="true"

# 로컬 개발 시 Chromium 경로 지정 (선택)
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"

# 쿠팡 Akamai 차단 우회용 프록시 (선택, 하나만 설정)
QUOTAGUARDSTATIC_URL="http://user:pass@proxy.quotaguard.com:9293"
FIXIE_URL="http://user:pass@proxy.fixie.com:80"
HTTPS_PROXY="http://..."
COUPANG_USER_PROXY_URL="http://..."
```

---

## 4. Prisma 스키마

`prisma/schema.prisma`의 generator/datasource 블록 아래에 추가합니다.

```prisma
model CardUsage {
  id                    String   @id @default(uuid())

  // 식별자
  corpNum               String   // 사업자번호
  cardNum               String   // 카드번호 (마스킹된 형태로 저장됨)
  useKey                String   // 바로빌 건별 고유 키

  // 시각
  useDT                 String   // YYYYMMDD 또는 YYYYMMDDHHMMSS
  usedAt                DateTime?

  // 승인 정보
  approvalType          String?  // '승인' | '취소' (정규화)
  approvalNum           String?
  approvalAmount        Int?
  foreignApprovalAmount Float?

  // 금액 (다양한 필드 → 최종 totalAmount 우선 사용)
  amount                Int?
  tax                   Int?
  serviceCharge         Int?
  totalAmount           Int?

  // 가맹점
  useStoreNum           String?
  useStoreCorpNum       String?
  useStoreTaxType       Int?
  useStoreName          String?
  useStoreCeo           String?
  useStoreAddr          String?
  useStoreBizType       String?
  useStoreTel           String?

  // 결제 조건
  paymentPlan           String?  // '일시불' | '할부' 등
  installmentMonths     String?
  currencyCode          String?

  // 사용자 입력
  memo                  String?  // 바로빌이 보내준 메모
  userMemo              String?  // 사용자가 입력한 메모
  category              String?  // CategoryCode (CAFE, FOOD, ...)

  // 검토 상태
  reviewedAt            DateTime?
  reviewedBy            String?

  // 쿠팡 매칭
  coupangPurchaseId     String?
  coupangPurchase       CoupangPurchase? @relation(fields: [coupangPurchaseId], references: [id], onDelete: SetNull)

  // 메타
  raw                   Json?    // 바로빌 원본 응답 (금액 보정용)
  syncedAt              DateTime @default(now())
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([corpNum, cardNum, useKey])
  @@index([usedAt])
  @@index([cardNum])
  @@index([approvalNum])
  @@index([reviewedAt])
  @@index([coupangPurchaseId])
}

model CoupangPurchase {
  id            String      @id @default(uuid())
  orderId       String      @unique  // 쿠팡 주문 ID
  orderedAt     DateTime
  totalAmount   Int
  paymentMethod String?
  itemSummary   String?               // "상품명 외 N건"
  itemsJson     Json?                 // CoupangPurchaseItem[]
  raw           Json?
  syncedAt      DateTime    @default(now())
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  cardUsages    CardUsage[]

  @@index([orderedAt])
  @@index([totalAmount])
}
```

추가 후:
```bash
npx prisma migrate dev --name add_card_usage
npx prisma generate
```

---

## 5. 복사해야 하는 파일 목록

베이코앱의 다음 파일들을 신규 프로젝트의 동일 경로로 옮깁니다.

### 5-1. 서버 라이브러리 (`lib/`)

| 원본 경로 | 라인 수 | 역할 |
|---|---|---|
| [lib/barobillCard.ts](lib/barobillCard.ts) | 712 | 바로빌 SOAP 클라이언트. `getCardEx2`, `refreshCard`, `getPeriodCardApprovalLog`, `getPeriodCardLogEx3`, `fetchCardUsageByPeriod` 등 |
| [lib/coupangPurchase.ts](lib/coupangPurchase.ts) | 513 | 쿠팡 Playwright 스크래퍼. `scrapeCoupangPurchases`, 프록시 처리, CAPTCHA/WAF 감지 |
| [lib/cardCategory.ts](lib/cardCategory.ts) | 145 | 카테고리 자동 분류 규칙 (`classifyCategory`, `DEFAULT_CATEGORIES`) |

### 5-2. API 라우트 (`app/api/admin/`)

| 원본 경로 | 메소드 | 역할 |
|---|---|---|
| [app/api/admin/card-usage/route.ts](app/api/admin/card-usage/route.ts) | GET, PATCH | 목록 조회 + 메모/카테고리/검토상태/매칭 수정 |
| [app/api/admin/card-usage/sync/route.ts](app/api/admin/card-usage/sync/route.ts) | POST | 바로빌 동기화 (조회 → upsert → 금액 보정 → 분류) |
| [app/api/admin/coupang-purchase/route.ts](app/api/admin/coupang-purchase/route.ts) | GET | 수동 매칭용 쿠팡 주문 조회 |
| [app/api/admin/coupang-purchase/sync/route.ts](app/api/admin/coupang-purchase/sync/route.ts) | POST | 쿠팡 스크래핑 + DB 저장 |
| [app/api/admin/coupang-purchase/match/route.ts](app/api/admin/coupang-purchase/match/route.ts) | POST | 카드 ↔ 쿠팡 자동 매칭 |

### 5-3. 프론트엔드 (`app/admin/card-usage/`)

| 원본 경로 | 라인 수 | 역할 |
|---|---|---|
| [app/admin/card-usage/page.tsx](app/admin/card-usage/page.tsx) | 16 | 세션 체크 + 클라이언트 컴포넌트 마운트 |
| [app/admin/card-usage/CardUsageClient.tsx](app/admin/card-usage/CardUsageClient.tsx) | 2641 | 메인 UI (필터/동기화 버튼/테이블/캘린더/모달 등 전체 화면) |

> 베이코앱은 `next-auth` + `session.user.role === 'ADMIN'`으로 권한을 체크합니다.
> 신규 프로젝트의 인증 방식에 맞게 `page.tsx`의 가드 부분만 교체하면 됩니다.

---

## 6. 데이터 흐름

```
┌────────────────────────────────────────────────┐
│  Admin UI: app/admin/card-usage/CardUsageClient│
│  - 날짜/카드/점포명 필터, 동기화 버튼          │
│  - 메모/카테고리/검토 상태/수동 매칭 편집      │
│  - Table / List / Calendar 뷰                  │
└─────────────┬──────────────────────────────────┘
              │ HTTP
   ┌──────────▼──────────────────────────────────┐
   │ /api/admin/card-usage           GET/PATCH   │
   │ /api/admin/card-usage/sync      POST        │
   │ /api/admin/coupang-purchase     GET         │
   │ /api/admin/coupang-purchase/sync  POST      │
   │ /api/admin/coupang-purchase/match POST      │
   └──┬─────────────────────────┬────────────────┘
      │                         │
┌─────▼───────────┐    ┌────────▼────────────┐
│ Barobill SOAP   │    │ Coupang Web         │
│ ws.baroservice  │    │ mc.coupang.com      │
│ (카드 승인 API) │    │ (Playwright 스크랩) │
└─────┬───────────┘    └────────┬────────────┘
      │                         │
      └───────────┬─────────────┘
                  ▼
   ┌──────────────────────────────┐
   │ PostgreSQL (Prisma)          │
   │  - CardUsage                 │
   │  - CoupangPurchase           │
   └──────────────────────────────┘
```

---

## 7. API 명세

### 7-1. `GET /api/admin/card-usage`

목록 조회 (페이징).

쿼리 파라미터:
| 이름 | 타입 | 기본값 | 비고 |
|---|---|---|---|
| `page` | number | 1 | |
| `pageSize` | number | 50 | 최대 10000 |
| `cardNum` | string | - | contains 검색 |
| `storeName` | string | - | contains 검색 |
| `startDate` | string | - | `YYYY-MM-DD` 또는 `YYYYMMDD` |
| `endDate` | string | - | `YYYY-MM-DD` 또는 `YYYYMMDD` |

응답:
```ts
{
  items: CardUsageItem[],   // approvalStatus 계산값 포함, coupangPurchase relation 포함
  page, pageSize, totalCount, totalPages,
  summary: { totalAmount: number, lastSyncedAt: string | null }
}
```

### 7-2. `PATCH /api/admin/card-usage`

```ts
body: {
  id: string,                            // 필수
  memo?: string,                         // userMemo로 저장
  category?: string,                     // CategoryCode
  reviewed?: boolean,                    // true → reviewedAt = now()
  coupangPurchaseId?: string | null      // 매칭 연결/해제
}
```

### 7-3. `POST /api/admin/card-usage/sync`

```ts
body: {
  startDate: string,
  endDate: string,
  cardNum?: string,
  refreshBeforeFetch?: boolean   // true 면 바로빌 RefreshCard로 즉시 최신화 후 조회
}
```

응답:
```ts
{
  success, fetchedCount, storedCount,
  amountResolvedCount, amountMissingCount, recalcFixedCount,
  categorizedCount, targetCards, refreshResults, syncedAt
}
```

### 7-4. `POST /api/admin/coupang-purchase/sync`

```ts
body: {
  startDate: string,        // YYYY-MM-DD
  endDate: string,
  loginId: string,
  loginPassword: string,
  headless?: boolean        // 기본 true
}
```

실패 코드:
- `409 CAPTCHA_REQUIRED` — 캡차 발생, 사용자 수동 로그인 필요
- `LOGIN_FAILED` — 자격증명 오류
- `LAUNCH_FAILED` — Chromium 초기화 실패

### 7-5. `POST /api/admin/coupang-purchase/match`

```ts
body: {
  startDate?: string,
  endDate?: string,
  overrideExisting?: boolean
}
```

매칭 규칙:
1. `useStoreName` 에 "쿠팡" 포함
2. `totalAmount` 정확히 일치
3. `usedAt` 와 `orderedAt` 차이 ≤ 2일
4. 후보가 정확히 1건일 때만 매칭 (모호하면 건너뜀)

---

## 8. 카테고리 시스템

`lib/cardCategory.ts` 에 정의된 14종 카테고리 코드:

```
CAFE / FOOD / BAKERY / TRANSPORT / SHOPPING / CONVENIENCE /
FUEL / FINANCE / TELECOM / OFFICE / MEDICAL / EDUCATION /
ENTERTAINMENT / OTHER
```

`classifyCategory(storeName, bizType)` 가 가맹점명/업종 정규식 매칭으로 자동 분류합니다.
프론트엔드에서는 `localStorage.beico-card-categories` 키로 사용자 커스텀 라벨/색상/순서를 저장합니다 (드래그앤드롭 변경 가능).

---

## 9. 핵심 유틸 함수 (lib/barobillCard.ts 내부)

| 함수 | 역할 |
|---|---|
| `parseDateInput(input, endOfDay?)` | `YYYY-MM-DD` / `YYYYMMDD` → KST Date |
| `toYmd(input)` | 다양한 포맷 → `YYYYMMDD` |
| `resolveAmount(row)` | `totalAmount > approvalAmount > (amount+tax+serviceCharge)` 우선순위로 금액 산출 |
| `recalcAmountFromRaw(raw)` | DB의 raw JSON을 다시 파싱해 0원 레코드 보정 |
| `normalizeApprovalStatus(row)` | `'승인'/'취소'` → `'APPROVED'/'CANCELED'/'UNKNOWN'` |
| `maskCard(cardNum)` | `1234-****-****-3456` 마스킹 |
| `escapeXml`, `decodeXml` | SOAP 안전 처리 |

---

## 10. 이관 체크리스트

- [ ] `package.json`에 의존성 추가 후 `npm install`
- [ ] `prisma/schema.prisma` 에 `CardUsage`, `CoupangPurchase` 모델 추가
- [ ] `npx prisma migrate dev --name add_card_usage`
- [ ] `lib/` 3개 파일 복사 (`barobillCard.ts`, `coupangPurchase.ts`, `cardCategory.ts`)
- [ ] `app/api/admin/card-usage/**`, `app/api/admin/coupang-purchase/**` 복사
- [ ] `app/admin/card-usage/page.tsx`, `CardUsageClient.tsx` 복사
- [ ] `page.tsx` 의 인증 가드를 신규 프로젝트 인증 시스템에 맞게 수정
- [ ] `.env.local` 에 환경변수 등록 (바로빌 4종 필수, 쿠팡/프록시 선택)
- [ ] 서버리스 배포(Vercel 등)일 경우 `@sparticuz/chromium` 사용 확인. 일반 Node 서버일 경우 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 또는 `npx playwright install chromium` 으로 브라우저 준비
- [ ] `/admin/card-usage` 진입 → 동기화 버튼으로 1차 데이터 적재 테스트
- [ ] 쿠팡 동기화 → 자동 매칭 동작 확인

---

## 11. 운영 시 알아두면 좋은 점

- **금액 0원 보정**: 바로빌이 가끔 금액 필드를 비워서 보내므로, sync 시 raw JSON 에서 다시 합산해 보정합니다 (`recalcFixedCount` 통계 확인).
- **레거시 fallback**: `GetPeriodCardApprovalLog` 결과에 금액이 비면 `GetPeriodCardLogEx3` 로 다시 조회해 머징합니다.
- **쿠팡 selector 다중화**: 쿠팡 DOM 구조가 자주 바뀌어 selector를 여러 개 시도합니다. 깨지면 `extractOrdersFromPage` 셀렉터부터 점검.
- **Akamai/CAPTCHA**: 서버리스 IP는 차단 빈도가 높음. 프록시(QuotaGuard/Fixie 등) 설정 권장.
- **카드번호 마스킹**: DB 저장 시 이미 마스킹된 값을 사용. 평문 저장 금지.
- **권한**: 관리자 전용 화면이므로 `page.tsx` 가드 누락 주의.

---

## 12. 참고: 베이코앱 최근 관련 커밋

```
61d505b Route Coupang scraper through outbound proxy when configured
e7f64cd Detect Coupang Akamai bot block before searching for login inputs
6ae6e17 Use verified Coupang login DOM selectors
558d545 Require Coupang credentials in sync modal
56c1da3 Add Coupang purchase matching for card usage transactions
```

쿠팡 스크래퍼는 운영 중 지속적인 fine-tuning이 필요했음을 보여주는 커밋들입니다. 옮긴 후에도 selector 깨짐/Akamai 대응이 1차 유지보수 포인트입니다.
