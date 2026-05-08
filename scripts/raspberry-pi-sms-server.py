#!/usr/bin/env python3
import hashlib
import json
import os
import re
import sqlite3
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional


DB_PATH = os.environ.get("SMS_DB_PATH", "./incoming_sms.sqlite3")
HOST = os.environ.get("SMS_SERVER_HOST", "0.0.0.0")
PORT = int(os.environ.get("SMS_SERVER_PORT", "8088"))
BEIKO_API_URL = os.environ.get(
    "BEIKO_DEPOSIT_SMS_API_URL",
    "https://www.beiko.co.kr/api/admin/deposit-sms/ingest",
)
INGEST_SECRET = os.environ.get("DEPOSIT_SMS_INGEST_SECRET", "")


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS incoming_sms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                received_at TEXT NOT NULL,
                sender TEXT NOT NULL,
                body TEXT NOT NULL,
                amount INTEGER,
                depositor_name TEXT,
                bank_name TEXT,
                message_hash TEXT NOT NULL UNIQUE,
                synced_at TEXT,
                sync_status TEXT NOT NULL DEFAULT 'PENDING',
                sync_error TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incoming_sms_received_at ON incoming_sms(received_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incoming_sms_amount ON incoming_sms(amount)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incoming_sms_sync_status ON incoming_sms(sync_status)")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_received_at(value: Any) -> str:
    if value is None or value == "":
        return now_iso()
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, timezone.utc).isoformat()
    text = str(value).strip()
    if not text:
        return now_iso()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except ValueError:
        return text


def normalize_amount(value: Any) -> Optional[int]:
    if isinstance(value, (int, float)) and value > 0:
        return int(round(value))
    if not isinstance(value, str):
        return None
    digits = re.sub(r"[^\d]", "", value)
    if not digits:
        return None
    amount = int(digits)
    return amount if amount > 0 else None


def extract_amount(body: str) -> Optional[int]:
    near_deposit = re.search(r"(?:입금|받음|송금|이체)[^\d]{0,24}((?:\d{1,3},)*\d{3,}|\d{4,})\s*(?:원|KRW)?", body, re.I)
    if near_deposit:
        amount = normalize_amount(near_deposit.group(1))
        if amount:
            return amount

    for match in re.finditer(r"(?:KRW|₩)?\s*((?:\d{1,3},)*\d{3,}|\d{4,})\s*(?:원|KRW)?", body, re.I):
        prefix = body[max(0, match.start() - 12):match.start()]
        if re.search(r"(잔액|잔고|남은금액)", prefix):
            continue
        amount = normalize_amount(match.group(1))
        if amount and amount >= 1000:
            return amount
    return None


def extract_bank_name(body: str) -> Optional[str]:
    bracket = re.search(r"\[(.*?)\]", body)
    if bracket and bracket.group(1).strip():
        return bracket.group(1).strip()
    bank = re.search(r"(국민|신한|우리|하나|기업|농협|카카오|토스|부산|대구|SC|케이뱅크|새마을|수협|우체국)", body, re.I)
    return bank.group(1).strip() if bank else None


def extract_depositor_name(body: str) -> Optional[str]:
    match = re.search(r"(?:입금|송금|받음)\s*(?:자|인)?[:\s-]*([가-힣A-Za-z0-9]{2,20})", body)
    if not match:
        return None
    value = match.group(1).strip()
    if value.isdigit() or re.search(r"(원|KRW|잔액|입금)", value):
        return None
    return value


def message_hash(sender: str, body: str, received_at: str) -> str:
    return hashlib.sha256(f"{sender.strip()}|{body.strip()}|{received_at}".encode("utf-8")).hexdigest()


def insert_sms(record: Dict[str, Any]) -> bool:
    with sqlite3.connect(DB_PATH) as conn:
        try:
            conn.execute(
                """
                INSERT INTO incoming_sms (
                    received_at, sender, body, amount, depositor_name, bank_name,
                    message_hash, sync_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
                """,
                (
                    record["receivedAt"],
                    record["sender"],
                    record["body"],
                    record["amount"],
                    record["depositorName"],
                    record["bankName"],
                    record["messageHash"],
                ),
            )
            return True
        except sqlite3.IntegrityError:
            return False


def update_sync(message_hash_value: str, status: str, error: Optional[str] = None) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            UPDATE incoming_sms
            SET synced_at = ?, sync_status = ?, sync_error = ?
            WHERE message_hash = ?
            """,
            (now_iso(), status, error, message_hash_value),
        )


def forward_to_beiko(record: Dict[str, Any]) -> Dict[str, Any]:
    if not INGEST_SECRET:
        raise RuntimeError("DEPOSIT_SMS_INGEST_SECRET is not set")

    payload = json.dumps(record, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        BEIKO_API_URL,
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {INGEST_SECRET}",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else {"success": True}


class SmsHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path != "/sms/incoming":
            self.respond(404, {"error": "Not found"})
            return

        record_hash = None
        try:
            payload = self.read_payload()
            sender = str(payload.get("sender") or payload.get("from") or "").strip()
            body = str(payload.get("body") or payload.get("message") or payload.get("text") or "").strip()
            if not sender or not body:
                self.respond(400, {"error": "sender and message/body are required"})
                return

            received_at = normalize_received_at(payload.get("receivedAt") or payload.get("timestamp") or payload.get("date"))
            amount = normalize_amount(payload.get("amount")) or extract_amount(body)
            record = {
                "messageHash": message_hash(sender, body, received_at),
                "sender": sender,
                "body": body,
                "receivedAt": received_at,
                "amount": amount,
                "depositorName": str(payload.get("depositorName") or extract_depositor_name(body) or "").strip() or None,
                "bankName": str(payload.get("bankName") or extract_bank_name(body) or "").strip() or None,
                "sourceDevice": str(payload.get("sourceDevice") or payload.get("device") or "android-sms-forwarder"),
            }
            record_hash = record["messageHash"]

            created = insert_sms(record)
            sync_result = forward_to_beiko(record)
            update_sync(record["messageHash"], "SYNCED")
            self.respond(200, {"success": True, "created": created, "syncResult": sync_result})
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if record_hash:
                update_sync(record_hash, "ERROR", f"Beiko API error {error.code}: {body}")
            self.respond(502, {"error": f"Beiko API error {error.code}: {body}"})
        except Exception as error:
            if record_hash:
                update_sync(record_hash, "ERROR", str(error))
            self.respond(500, {"error": str(error)})

    def read_payload(self) -> Dict[str, Any]:
        length = int(self.headers.get("content-length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8")
        if not raw:
            return {}
        content_type = self.headers.get("content-type", "")
        if "application/json" in content_type:
            return json.loads(raw)
        data: Dict[str, Any] = {}
        for part in raw.split("&"):
            if "=" in part:
                key, value = part.split("=", 1)
                data[urllib.parse.unquote_plus(key)] = urllib.parse.unquote_plus(value)
        return data

    def respond(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main() -> None:
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), SmsHandler)
    print(f"SMS server listening on http://{HOST}:{PORT}/sms/incoming")
    server.serve_forever()


if __name__ == "__main__":
    main()
