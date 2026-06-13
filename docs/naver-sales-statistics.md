# 네이버 판매통계 수집

베이코앱은 네이버 통계 API를 Vercel에서 직접 호출하지 않는다. 라즈베리파이가 네이버 API를 호출하고, 집계 결과만 베이코앱 API로 업로드한다.

## Vercel 환경변수

```bash
NAVER_SALES_INGEST_SECRET=긴_랜덤_토큰
```

## 라즈베리 환경변수

```bash
export NAVER_COMMERCE_CLIENT_ID=...
export NAVER_COMMERCE_CLIENT_SECRET=...
export NAVER_COMMERCE_TOKEN_TYPE=SELF
export NAVER_SALES_INGEST_SECRET=Vercel과_같은_토큰
export BEIKO_NAVER_SALES_API_URL=https://www.beiko.co.kr/api/admin/naver-sales/ingest
export NAVER_SALES_DAYS=2
export NAVER_SALES_SOURCE_DEVICE=raspberry-pi-naver-sales
export NAVER_SALES_REQUEST_DELAY_MS=1000
export NAVER_SALES_RETRY_COUNT=3
export NAVER_SALES_INCLUDE_INSIGHTS=1
export NAVER_SALES_INCLUDE_REALTIME=1
```

- `NAVER_SALES_REQUEST_DELAY_MS`: 날짜 하나 저장한 뒤 기다리는 시간이다. 네이버가 너무 많은 요청이라고 막으면 값을 늘린다.
- `NAVER_SALES_RETRY_COUNT`: 네이버 요청이 실패했을 때 다시 시도할 횟수다.
- `NAVER_SALES_INCLUDE_INSIGHTS`: `1`이면 검색어/채널 통계도 같이 수집한다.
- `NAVER_SALES_INCLUDE_REALTIME`: `1`이면 오늘 통계 스냅샷도 같이 저장한다.

## 수동 실행

```bash
node scripts/raspberry-pi-naver-sales-sync.mjs
```

## cron 예시

라즈베리에서 하루 2회 실행한다.

```cron
15 9,21 * * * cd /home/pi/beico-app && /usr/bin/node scripts/raspberry-pi-naver-sales-sync.mjs >> /home/pi/naver-sales-sync.log 2>&1
```

## 저장 구조

- `NaverSalesDaily`: 일자와 네이버 상품 번호별 판매 집계
- `NaverSalesInsightDaily`: 검색어/마케팅 채널별 집계
- `NaverSalesRealtimeSnapshot`: 오늘 통계 스냅샷
- `NaverSalesSyncLog`: 업로드 성공/실패 로그

관리자 화면은 `/admin/statistics`에서 DB에 저장된 집계만 조회한다.
