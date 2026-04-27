# FASSTO OpenAPI V1 연동 가이드

## 연동 정보

- **Swagger UI**: https://fmsapi.fassto.ai/swagger-ui.html
- **API 스펙(JSON)**: https://fmsapi.fassto.ai/v2/api-docs
- **공식 가이드**: https://guide-kr.fassto.ai/1a436b86-bfba-80a3-8292-d93a0a4d83ce

## 인증

### 토큰 발급

```
POST /api/v1/auth/connect?apiCd={apiCd}&apiKey={apiKey}
```

- 성공 시 `data.accessToken`, `data.expreDatetime` (yyyymmddhh24miss) 반환
- 이후 모든 API 호출에 `accessToken` 헤더 필수

### 인증 해제

```
GET /api/v1/auth/disconnect
```

## 공통 응답 형식

```json
{
  "header": { "code": "HTTP STATUS", "dataCount": 0, "msg": "메시지" },
  "errorInfo": { "errorCode": "", "errorMessage": "", "errorData": [] },
  "data": {}
}
```

## 베이코앱에서 구현 가능한 기능

### 1단계 - 즉시 구현 가능

| 기능 | API | 설명 |
|------|-----|------|
| 재고 조회 | `GET /api/v1/stock/list/{cstCd}` | 파스토 센터 실시간 재고 조회, 앱 재고와 동기화 |
| 상품 등록 | `POST /api/v1/goods/{cstCd}` | 베이코 상품을 파스토에 등록 |
| 상품 수정 | `PATCH /api/v1/goods/{cstCd}` | 상품 정보 업데이트 |
| 상품 조회 | `GET /api/v1/goods/{cstCd}` | 파스토에 등록된 상품 목록 조회 |
| 입고 등록 | `POST /api/v1/warehousing/{cstCd}` | 입고 요청 등록 |
| 입고 조회 | `GET /api/v1/warehousing/{cstCd}/{start}/{end}` | 기간별 입고 내역 조회 |
| 입고 상세 | `GET /api/v1/warehousing/detail/{cstCd}/{slipNo}` | 입고 상세 조회 |

### 2단계 - 주문 연동 후 구현

| 기능 | API | 설명 |
|------|-----|------|
| 출고 요청 (택배) | `POST /api/v1/delivery/parcel/{cstCd}` | 주문 확정 시 자동 출고 요청 |
| 출고 수정 | `PATCH /api/v1/delivery/parcel/{cstCd}` | 출고 정보 수정 |
| 출고 취소 | `PATCH /api/v1/delivery/cancel/{cstCd}` | 출고 요청 취소 |
| 출고 조회 | `GET /api/v1/delivery/{cstCd}/{start}/{end}/{status}/{outDiv}` | 출고 현황 조회 |
| 출고 상세 | `GET /api/v1/delivery/detail/{cstCd}/{slipNo}` | 출고 상세 + 송장번호 조회 |

### 3단계 - 부가 기능

| 기능 | API | 설명 |
|------|-----|------|
| 반품 등록 | `POST /api/v1/return/reservation/{cstCd}` | 반품 요청 |
| 반품 조회 | `GET /api/v1/return/godDetail/{cstCd}` | 반품 상세 |
| 출고처 관리 | `POST/PATCH /api/v1/shop/{cstCd}` | 출고처 등록/수정 |
| 공급사 관리 | `POST/PATCH /api/v1/supplier/{cstCd}` | 공급사 등록/수정 |
| 정산 조회 | `GET /api/v1/settlement/{clsMon}/{whCd}/{cstCd}` | 월별 정산 내역 |

## 주요 코드값

### 입고 방법 (inWay)
- `01`: 택배
- `02`: 차량

### 입고 상태 (wrkStat)
- `1`: 입고요청/센터도착
- `2`: 검수중
- `3`: 검수완료/입고확정
- `4`: 입고완료
- `5`: 입고취소

### 출고 상태 (status)
- `ORDER`: 출고요청
- `WORKING`: 작업중
- `DONE`: 출고완료
- `PARTDONE`: 부분출고
- `CANCEL`: 취소
- `SHORTAGE`: 재고부족

### 출고 구분 (outDiv)
- `1`: 택배
- `2`: 차량배송

### 상품 유형 (godType)
- `1`: 단일
- `2`: 모음
- `3`: 세트
- `4`: 대표상품

### 본품/사은품 (giftDiv)
- `01`: 본품
- `02`: 사은품
- `03`: 부자재

## 환경 변수 (필요)

```env
FASSTO_API_URL=https://fmsapi.fassto.ai
FASSTO_API_CD=파스토에서_발급받은_코드
FASSTO_API_KEY=파스토에서_발급받은_키
FASSTO_CST_CD=고객사코드
```

## 비즈니스 제약사항

- 출고 요청은 센터 운영 마감시간 내 건만 처리
- 해외 배송 상품 정보 일부는 API 등록 불가 (FMS에서 수동 입력)
- 반품 검수 내역은 API 미제공
- 교환 = 반품 등록 + 신규 출고 요청 (별도 처리)
