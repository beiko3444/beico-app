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
```

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
- `NaverSalesSyncLog`: 업로드 성공/실패 로그

관리자 화면은 `/admin/statistics`에서 DB에 저장된 집계만 조회한다.
