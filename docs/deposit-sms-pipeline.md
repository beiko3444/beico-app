# Deposit SMS Pipeline

Android SMS Forwarder -> Raspberry Pi SQLite -> Beiko app ingest API.

## Beiko App

Set the same secret in Vercel and on the Raspberry Pi.

```bash
DEPOSIT_SMS_INGEST_SECRET=change-this-long-random-secret
```

Endpoint:

```http
POST /api/admin/deposit-sms/ingest
Authorization: Bearer ${DEPOSIT_SMS_INGEST_SECRET}
Content-Type: application/json
```

Body:

```json
{
  "messageHash": "sha256...",
  "sender": "1588-0000",
  "body": "[은행] 입금 1,234,000원 홍길동 잔액 ...",
  "receivedAt": "2026-05-09T10:00:00+09:00",
  "amount": 1234000,
  "depositorName": "홍길동",
  "bankName": "은행",
  "sourceDevice": "android-sms-forwarder"
}
```

## Raspberry Pi

```bash
cd /path/to/beico-app
python3 scripts/raspberry-pi-sms-server.py
```

Recommended environment:

```bash
export SMS_DB_PATH=/home/pi/beiko-incoming-sms.sqlite3
export SMS_SERVER_HOST=0.0.0.0
export SMS_SERVER_PORT=8088
export BEIKO_DEPOSIT_SMS_API_URL=https://www.beiko.co.kr/api/admin/deposit-sms/ingest
export DEPOSIT_SMS_INGEST_SECRET=change-this-long-random-secret
```

SMS Forwarder target:

```text
POST http://<raspberry-pi-ip>:8088/sms/incoming
```

JSON template:

```json
{
  "sender": "{from}",
  "message": "{message}",
  "receivedAt": "{sentStamp}",
  "sourceDevice": "android-phone"
}
```

## Matching

The app auto-confirms only when one recent unpaid order has the exact same server-calculated final amount.

Status values:

- `AUTO_CONFIRMED`: one exact order match, order marked `DEPOSIT_COMPLETED`.
- `UNMATCHED`: no order matched.
- `AMBIGUOUS`: two or more orders had the same amount.
- `NOT_DEPOSIT`: outgoing/payment SMS or no deposit amount.
- `DUPLICATE_OR_ALREADY_CONFIRMED`: same SMS or already-confirmed target order.
