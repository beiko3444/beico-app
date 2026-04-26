# 카드 API 분리(이관) 설계서

## 1. 목표
- 현재 `beico-app` 내부에 있는 카드 사용내역 API/동기화 로직을 별도 서비스(`card-api-service`)로 분리한다.
- 관리자 UI는 기존 화면을 유지하되, 데이터 소스만 내부 DB 직접 조회에서 외부 API 호출로 전환한다.
- 1차 목표는 기능 동일성(조회/수정/동기화/매칭) 확보이며, 이후 성능/운영 고도화를 진행한다.

## 2. 현재 범위(이관 대상)
- 카드 사용내역 조회/수정
  - `GET /api/admin/card-usage`
  - `PATCH /api/admin/card-usage`
- 카드 동기화(바로빌 SOAP)
  - `POST /api/admin/card-usage/sync`
- 쿠팡 구매내역 연계(카드 매칭 기능 포함)
  - `GET /api/admin/coupang-purchase`
  - `POST /api/admin/coupang-purchase/sync`
  - `POST /api/admin/coupang-purchase/match`
- 핵심 라이브러리
  - `lib/barobillCard.ts`
  - `lib/cardCategory.ts`
  - `lib/coupangPurchase.ts`

## 3. 목표 아키텍처
- `beico-app`
  - 관리자 UI + 인증 세션 유지
  - 외부 카드 API 프록시/호출만 담당
- `card-api-service` (신규)
  - 카드/쿠팡 수집 및 정규화
  - 카드-쿠팡 자동 매칭
  - 카드 데이터 영속화 및 조회 API 제공
- DB
  - 1안: `card-api-service` 전용 DB(권장)
  - 2안: 기존 DB 공유(단기 전환 시)

## 4. 서비스 경계
- `beico-app`에서 제거할 책임
  - 바로빌 SOAP 직접 호출
  - 쿠팡 Playwright 스크래핑
  - 카드 금액 보정/카테고리 자동분류/자동매칭 배치
- `beico-app`에 남길 책임
  - 관리자 권한 확인(`ADMIN`)
  - UI 상태 관리 및 사용자 입력 검증
  - 외부 카드 API 에러 메시지 사용자 친화 변환

## 5. API 계약(외부 카드 서비스)

### 5.1 카드 조회
- `GET /v1/card-usages`
- Query
  - `page`, `pageSize`, `cardNum`, `storeName`, `startDate`, `endDate`
- Response
  - `items`, `page`, `pageSize`, `totalCount`, `totalPages`, `summary`

### 5.2 카드 수정
- `PATCH /v1/card-usages/{id}`
- Body
  - `memo?`, `category?`, `reviewed?`, `coupangPurchaseId?`

### 5.3 카드 동기화
- `POST /v1/card-usages/sync`
- Body
  - `startDate`, `endDate`, `cardNum?`, `refreshBeforeFetch?`

### 5.4 쿠팡 조회/동기화/매칭
- `GET /v1/coupang-purchases`
- `POST /v1/coupang-purchases/sync`
- `POST /v1/coupang-purchases/match`

## 6. 인증/보안
- `beico-app -> card-api-service`는 서버 간 토큰(HMAC 또는 Bearer Service Token) 사용
- IP allowlist(가능 시) + TLS 강제
- 민감정보(카드번호, 로그인 정보) 로그 마스킹
- 재시도 정책은 멱등성 보장 가능한 API에만 적용

## 7. 데이터/스키마 전략
- `CardUsage`, `CoupangPurchase` 모델은 기존 필드를 우선 호환 유지
- 주요 제약
  - `CardUsage`: `(corpNum, cardNum, useKey)` unique
  - 날짜 인덱스(`usedAt`, `orderedAt`) 유지
- 카테고리 분류 코드는 서비스 내부 정책 모듈로 이동

## 8. 이관 단계

### Phase 1: 어댑터 도입
- `beico-app` 라우트 내부에서 Prisma 직접 접근 대신 외부 API 호출로 추상화
- 기능 플래그 `CARD_API_PROVIDER=internal|external` 추가

### Phase 2: 읽기 전환
- 조회 API(`GET`) 먼저 외부로 전환
- 결과 비교 로그(샘플링)로 정합성 확인

### Phase 3: 쓰기/동기화 전환
- `PATCH`, `sync`, `match` 순서로 외부 전환
- 배치/스크래핑 작업 스케줄러를 `card-api-service`로 이전

### Phase 4: 내부 코드 제거
- `beico-app` 내 카드 도메인 비즈니스 로직 제거
- 프록시/클라이언트 계층만 유지

## 9. 롤백 전략
- 기능 플래그로 즉시 `internal` 복귀 가능하게 유지
- 외부 API 장애 시:
  - 조회: 캐시/최근 동기화 스냅샷 응답
  - 동기화: 큐 적재 후 재시도
- 롤백 시에도 데이터 손실 없도록 write audit 로그 유지

## 10. 완료 기준(Definition of Done)
- 기존 관리자 카드 화면 시나리오 100% 동작
  - 조회/필터/수정/동기화/매칭
- 기존 대비 응답 필드 호환성 유지(브레이킹 체인지 없음)
- 장애 대응(runbook) + 환경변수/배포 문서 완료
- 내부/외부 전환 기능 플래그 운영 검증 완료

## 11. 구현 체크리스트
- [ ] `beico-app`에 카드 API 클라이언트 모듈 추가
- [ ] 기존 라우트에서 외부 호출 어댑터 연결
- [ ] 서비스 토큰/시크릿 관리(환경변수 + 배포 비밀값)
- [ ] 외부 서비스 OpenAPI 스펙 문서화
- [ ] 통합 테스트(정상/오류/타임아웃/권한) 작성
- [ ] 운영 대시보드(성공률, 지연, 동기화 건수) 추가
