# 네이버 판매통계

베이코앱은 네이버 통계 값을 DB에 저장하지 않는다.

흐름은 이렇게 간다.

1. 관리자가 `/admin/statistics` 화면을 연다.
2. 베이코앱이 라즈베리 모니터 API에 묻는다.
3. 라즈베리가 네이버 API에서 값을 받아온다.
4. 베이코앱은 받은 값을 화면에만 보여준다.

## 베이코앱 설정

Vercel에는 라즈베리 주소만 필요하다.

```bash
SMARTINVENTORY_MONITOR_URL=https://라즈베리_주소
```

고정 주소를 쓰지 않는다면 Gist 주소를 쓸 수 있다.

```bash
SMARTINVENTORY_MONITOR_URL_GIST=https://gist.githubusercontent.com/.../raw/...
```

화면을 열 때마다 라즈베리가 네이버 API를 새로 부르게 하려면:

```bash
NAVER_SALES_REMOTE_REFRESH=1
```

라즈베리에 이미 저장된 최근 값만 빠르게 보고 싶으면:

```bash
NAVER_SALES_REMOTE_REFRESH=0
```

## 라즈베리 API

베이코앱은 아래 주소를 읽는다.

```text
GET /revenue?period_days=30&refresh=1
GET /keywords?period_days=30&refresh=1
```

- `/revenue`: 상품별 매출
- `/keywords`: 검색어별 매출
- `period_days`: 며칠치를 볼지
- `refresh=1`: 네이버 API를 새로 호출

## 쓰지 않는 방식

예전 방식인 라즈베리에서 베이코앱으로 통계를 업로드하는 방식은 더 이상 쓰지 않는다.

```text
POST /api/admin/naver-sales/ingest
```

이 주소는 DB에 저장하지 않고 막힌 응답을 돌려준다.
