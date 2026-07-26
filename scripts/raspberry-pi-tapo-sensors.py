#!/usr/bin/env python3
"""Store Tapo T310/T315 readings in Raspberry Pi SQLite.

The script supports a local H200 connection and a SmartThings cloud bridge for
an H200 on another network.  Configuration is read from environment variables,
and all measurement history stays in a local SQLite database.
"""

from __future__ import annotations

import argparse
import asyncio
import fcntl
import json
import os
import sqlite3
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    from kasa import Credentials, Discover, Module
except ImportError:  # Allows --help and SQLite checks before the package is installed.
    Credentials = None  # type: ignore[assignment, misc]
    Discover = None  # type: ignore[assignment, misc]
    Module = None  # type: ignore[assignment, misc]


SUPPORTED_MODELS = {"T310", "T315"}
DEFAULT_DB_PATH = "/var/lib/beiko/tapo-sensors.sqlite3"


@dataclass(frozen=True)
class Settings:
    source: str
    hub_host: str
    username: str
    password: str
    smartthings_bridge_url: str
    smartthings_collector_secret: str
    db_path: Path
    sensor_ids: frozenset[str]
    retention_days: int
    timeout_seconds: int


@dataclass(frozen=True)
class Reading:
    sensor_id: str
    sensor_name: str
    model: str
    hub_host: str
    collected_at: str
    temperature_c: float
    humidity_percent: float
    battery_percent: int | None
    raw_state: dict[str, Any]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime | None = None) -> str:
    value = value or utc_now()
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_settings() -> Settings:
    source = os.environ.get("TAPO_SOURCE", "local").strip().lower()
    if source not in {"local", "smartthings"}:
        raise ValueError("TAPO_SOURCE는 local 또는 smartthings여야 합니다.")

    hub_host = os.environ.get("TAPO_HUB_HOST", "").strip()
    username = os.environ.get("TAPO_USERNAME", "").strip()
    password = os.environ.get("TAPO_PASSWORD", "")
    smartthings_bridge_url = os.environ.get("SMARTTHINGS_BRIDGE_URL", "").strip()
    smartthings_collector_secret = os.environ.get("SMARTTHINGS_COLLECTOR_SECRET", "")
    if source == "local" and (not hub_host or not username or not password):
        raise ValueError("TAPO_HUB_HOST, TAPO_USERNAME, TAPO_PASSWORD를 모두 설정해야 합니다.")
    if source == "smartthings" and (
        not smartthings_bridge_url.startswith("https://") or not smartthings_collector_secret
    ):
        raise ValueError(
            "SmartThings 방식에는 HTTPS SMARTTHINGS_BRIDGE_URL과 "
            "SMARTTHINGS_COLLECTOR_SECRET을 설정해야 합니다."
        )

    db_path = Path(os.environ.get("TAPO_DB_PATH", DEFAULT_DB_PATH)).expanduser()
    sensor_ids = frozenset(
        sensor_id.strip()
        for sensor_id in os.environ.get("TAPO_SENSOR_IDS", "").split(",")
        if sensor_id.strip()
    )
    retention_days = positive_int("TAPO_RETENTION_DAYS", default=730)
    timeout_seconds = positive_int("TAPO_TIMEOUT_SECONDS", default=20)
    return Settings(
        source=source,
        hub_host=hub_host,
        username=username,
        password=password,
        smartthings_bridge_url=smartthings_bridge_url,
        smartthings_collector_secret=smartthings_collector_secret,
        db_path=db_path,
        sensor_ids=sensor_ids,
        retention_days=retention_days,
        timeout_seconds=timeout_seconds,
    )


def positive_int(name: str, *, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} 값은 양의 정수여야 합니다.") from error
    if value < 1:
        raise ValueError(f"{name} 값은 1 이상이어야 합니다.")
    return value


@contextmanager
def collector_lock(db_path: Path) -> Iterator[None]:
    """Prevent a delayed systemd run from overlapping the next run."""
    db_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock_path = db_path.with_suffix(db_path.suffix + ".lock")
    with lock_path.open("w", encoding="utf-8") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("이미 다른 온습도 수집 작업이 실행 중입니다.") from error
        yield


def open_database(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path, timeout=30)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS tapo_sensors (
            sensor_id TEXT PRIMARY KEY,
            sensor_name TEXT NOT NULL,
            model TEXT NOT NULL,
            hub_host TEXT NOT NULL,
            first_seen_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tapo_measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            collected_at TEXT NOT NULL,
            temperature_c REAL NOT NULL,
            humidity_percent REAL NOT NULL,
            battery_percent INTEGER,
            raw_state TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (sensor_id) REFERENCES tapo_sensors(sensor_id) ON DELETE CASCADE,
            UNIQUE (sensor_id, collected_at)
        );

        CREATE INDEX IF NOT EXISTS idx_tapo_measurements_sensor_collected
            ON tapo_measurements(sensor_id, collected_at DESC);

        CREATE TABLE IF NOT EXISTS tapo_collection_errors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            occurred_at TEXT NOT NULL,
            stage TEXT NOT NULL,
            error_message TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tapo_collection_errors_occurred
            ON tapo_collection_errors(occurred_at DESC);
        """
    )
    connection.commit()


def record_error(connection: sqlite3.Connection, stage: str, error: BaseException | str) -> None:
    message = str(error).strip() or type(error).__name__
    connection.execute(
        "INSERT INTO tapo_collection_errors (occurred_at, stage, error_message) VALUES (?, ?, ?)",
        (iso_utc(), stage, message[:2000]),
    )
    connection.commit()


def as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def module_value(device: Any, module_key: Any, attribute: str, sys_info_key: str) -> float | None:
    """Read a current feature, with sys_info fallback for future package changes."""
    module = device.modules.get(module_key) if module_key is not None else None
    value = getattr(module, attribute, None) if module is not None else None
    if value is None:
        value = getattr(device, "sys_info", {}).get(sys_info_key)
    return as_number(value)


def expected_sensor(device: Any, allowed_sensor_ids: frozenset[str]) -> bool:
    sensor_id = str(getattr(device, "device_id", ""))
    model = str(getattr(device, "model", "")).upper().strip()
    return (not allowed_sensor_ids or sensor_id in allowed_sensor_ids) and any(
        model.startswith(supported_model) for supported_model in SUPPORTED_MODELS
    )


def reading_from_child(device: Any, settings: Settings, collected_at: str) -> Reading:
    if Module is None:
        raise RuntimeError("python-kasa가 설치되지 않았습니다. requirements-tapo.txt를 설치해 주세요.")

    temperature_c = module_value(device, Module.TemperatureSensor, "temperature", "current_temp")
    humidity_percent = module_value(device, Module.HumiditySensor, "humidity", "current_humidity")
    battery_value = module_value(device, Module.BatterySensor, "battery", "battery_percentage")
    if temperature_c is None or not -50 <= temperature_c <= 100:
        raise ValueError("유효한 온도 값을 읽지 못했습니다.")
    if humidity_percent is None or not 0 <= humidity_percent <= 100:
        raise ValueError("유효한 습도 값을 읽지 못했습니다.")

    battery_percent: int | None = None
    if battery_value is not None:
        if not 0 <= battery_value <= 100:
            raise ValueError("유효한 배터리 값을 읽지 못했습니다.")
        battery_percent = round(battery_value)

    sensor_id = str(getattr(device, "device_id", "")).strip()
    if not sensor_id:
        raise ValueError("센서 ID를 읽지 못했습니다.")
    sensor_name = str(getattr(device, "alias", "") or getattr(device, "model", sensor_id)).strip()
    model = str(getattr(device, "model", "")).upper().strip()
    raw_state = getattr(device, "sys_info", {})
    if not isinstance(raw_state, dict):
        raw_state = {"value": str(raw_state)}

    return Reading(
        sensor_id=sensor_id,
        sensor_name=sensor_name,
        model=model,
        hub_host=settings.hub_host,
        collected_at=collected_at,
        temperature_c=temperature_c,
        humidity_percent=humidity_percent,
        battery_percent=battery_percent,
        raw_state=raw_state,
    )


async def fetch_local_readings(settings: Settings) -> tuple[list[Reading], list[str]]:
    if Credentials is None or Discover is None:
        raise RuntimeError("python-kasa가 설치되지 않았습니다. requirements-tapo.txt를 설치해 주세요.")

    hub = await Discover.discover_single(
        settings.hub_host,
        credentials=Credentials(settings.username, settings.password),
        timeout=settings.timeout_seconds,
    )
    if hub is None:
        raise RuntimeError(f"H200 허브를 찾지 못했습니다: {settings.hub_host}")

    try:
        await hub.update(update_children=True)
        collected_at = iso_utc()
        readings: list[Reading] = []
        errors: list[str] = []
        for child in hub.children:
            if not expected_sensor(child, settings.sensor_ids):
                continue
            try:
                readings.append(reading_from_child(child, settings, collected_at))
            except Exception as error:
                sensor_label = str(getattr(child, "alias", "") or getattr(child, "model", "unknown"))
                errors.append(f"{sensor_label}: {error}")

        if not readings:
            filter_note = "지정한 센서" if settings.sensor_ids else "T310/T315 센서"
            details = f" ({'; '.join(errors)})" if errors else ""
            raise RuntimeError(f"{filter_note}에서 온습도 값을 읽지 못했습니다.{details}")
        return readings, errors
    finally:
        await hub.disconnect()


async def list_local_sensors(settings: Settings) -> dict[str, Any]:
    if Credentials is None or Discover is None:
        raise RuntimeError("python-kasa가 설치되지 않았습니다. requirements-tapo.txt를 설치해 주세요.")

    hub = await Discover.discover_single(
        settings.hub_host,
        credentials=Credentials(settings.username, settings.password),
        timeout=settings.timeout_seconds,
    )
    if hub is None:
        raise RuntimeError(f"H200 허브를 찾지 못했습니다: {settings.hub_host}")

    try:
        await hub.update(update_children=True)
        return {
            "hub": {"host": settings.hub_host, "model": str(getattr(hub, "model", "")), "name": str(getattr(hub, "alias", ""))},
            "sensors": [
                {
                    "id": str(getattr(child, "device_id", "")),
                    "name": str(getattr(child, "alias", "")),
                    "model": str(getattr(child, "model", "")),
                    "supported": any(
                        str(getattr(child, "model", "")).upper().strip().startswith(supported_model)
                        for supported_model in SUPPORTED_MODELS
                    ),
                }
                for child in hub.children
            ],
        }
    finally:
        await hub.disconnect()


def smartthings_payload(settings: Settings) -> dict[str, Any]:
    request = Request(
        settings.smartthings_bridge_url,
        headers={
            "Authorization": f"Bearer {settings.smartthings_collector_secret}",
            "Accept": "application/json",
            "User-Agent": "beiko-tapo-raspberry-collector/1.0",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=settings.timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"SmartThings 연결 서버 오류 ({error.code}): {details}") from error
    except URLError as error:
        raise RuntimeError(f"SmartThings 연결 서버에 접속하지 못했습니다: {error.reason}") from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("SmartThings 연결 서버 응답이 올바른 JSON이 아닙니다.") from error
    if not isinstance(payload, dict):
        raise RuntimeError("SmartThings 연결 서버 응답 형식이 올바르지 않습니다.")
    if payload.get("ok") is not True:
        raise RuntimeError(str(payload.get("error") or "SmartThings 연결 서버가 수집에 실패했습니다."))
    return payload


def smartthings_reading(
    raw_sensor: dict[str, Any],
    settings: Settings,
    collected_at: str,
) -> Reading:
    sensor_id = str(raw_sensor.get("deviceId") or "").strip()
    sensor_name = str(raw_sensor.get("label") or sensor_id).strip()
    model = str(raw_sensor.get("model") or "SMARTTHINGS_CLIMATE").strip().upper()
    temperature_c = as_number(raw_sensor.get("temperatureC"))
    humidity_percent = as_number(raw_sensor.get("humidityPercent"))
    battery_value = as_number(raw_sensor.get("batteryPercent"))
    if not sensor_id:
        raise ValueError("센서 ID가 없습니다.")
    if temperature_c is None or not -50 <= temperature_c <= 100:
        raise ValueError(f"{sensor_name}: 유효한 온도 값이 없습니다.")
    if humidity_percent is None or not 0 <= humidity_percent <= 100:
        raise ValueError(f"{sensor_name}: 유효한 습도 값이 없습니다.")

    battery_percent: int | None = None
    if battery_value is not None:
        if not 0 <= battery_value <= 100:
            raise ValueError(f"{sensor_name}: 유효한 배터리 값이 없습니다.")
        battery_percent = round(battery_value)

    return Reading(
        sensor_id=sensor_id,
        sensor_name=sensor_name,
        model=model,
        hub_host="smartthings-cloud",
        collected_at=collected_at,
        temperature_c=temperature_c,
        humidity_percent=humidity_percent,
        battery_percent=battery_percent,
        raw_state={"source": "smartthings", **raw_sensor},
    )


def fetch_smartthings_readings(settings: Settings) -> tuple[list[Reading], list[str]]:
    payload = smartthings_payload(settings)
    collected_at = str(payload.get("collectedAt") or iso_utc()).strip()
    raw_sensors = payload.get("sensors")
    if not isinstance(raw_sensors, list):
        raise RuntimeError("SmartThings 연결 서버가 센서 목록을 반환하지 않았습니다.")

    readings: list[Reading] = []
    errors: list[str] = []
    for raw_sensor in raw_sensors:
        if not isinstance(raw_sensor, dict):
            continue
        sensor_id = str(raw_sensor.get("deviceId") or "").strip()
        if settings.sensor_ids and sensor_id not in settings.sensor_ids:
            continue
        try:
            readings.append(smartthings_reading(raw_sensor, settings, collected_at))
        except Exception as error:
            errors.append(str(error))

    if not readings:
        details = f" ({'; '.join(errors)})" if errors else ""
        raise RuntimeError(f"SmartThings에서 온습도 값을 읽지 못했습니다.{details}")
    return readings, errors


def list_smartthings_sensors(settings: Settings) -> dict[str, Any]:
    payload = smartthings_payload(settings)
    raw_sensors = payload.get("sensors")
    if not isinstance(raw_sensors, list):
        raise RuntimeError("SmartThings 연결 서버가 센서 목록을 반환하지 않았습니다.")
    return {
        "hub": {"host": "smartthings-cloud", "model": "H200", "name": "SmartThings"},
        "sensors": [
            {
                "id": str(sensor.get("deviceId") or ""),
                "name": str(sensor.get("label") or ""),
                "model": str(sensor.get("model") or "SMARTTHINGS_CLIMATE"),
                "supported": sensor.get("temperatureC") is not None
                and sensor.get("humidityPercent") is not None,
            }
            for sensor in raw_sensors
            if isinstance(sensor, dict)
        ],
    }


def persist_readings(connection: sqlite3.Connection, readings: Sequence[Reading], retention_days: int) -> int:
    now = iso_utc()
    inserted = 0
    with connection:
        for reading in readings:
            connection.execute(
                """
                INSERT INTO tapo_sensors (sensor_id, sensor_name, model, hub_host, first_seen_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(sensor_id) DO UPDATE SET
                    sensor_name = excluded.sensor_name,
                    model = excluded.model,
                    hub_host = excluded.hub_host,
                    last_seen_at = excluded.last_seen_at
                """,
                (reading.sensor_id, reading.sensor_name, reading.model, reading.hub_host, now, now),
            )
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO tapo_measurements
                    (sensor_id, collected_at, temperature_c, humidity_percent, battery_percent, raw_state, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reading.sensor_id,
                    reading.collected_at,
                    reading.temperature_c,
                    reading.humidity_percent,
                    reading.battery_percent,
                    json.dumps(reading.raw_state, ensure_ascii=False, default=str, sort_keys=True),
                    now,
                ),
            )
            inserted += cursor.rowcount

        cutoff = iso_utc(utc_now() - timedelta(days=retention_days))
        connection.execute("DELETE FROM tapo_measurements WHERE collected_at < ?", (cutoff,))
    return inserted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Tapo T310/T315 값을 라즈베리파이 SQLite에 저장합니다.")
    parser.add_argument("command", choices=("poll", "list"), nargs="?", default="poll", help="poll: 값 저장, list: 연결된 센서 목록 출력")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        settings = read_settings()
        with collector_lock(settings.db_path):
            with open_database(settings.db_path) as connection:
                initialize_database(connection)
                if args.command == "list":
                    sensor_list = (
                        list_smartthings_sensors(settings)
                        if settings.source == "smartthings"
                        else asyncio.run(list_local_sensors(settings))
                    )
                    print(json.dumps(sensor_list, ensure_ascii=False, indent=2))
                    return 0

                try:
                    readings, child_errors = (
                        fetch_smartthings_readings(settings)
                        if settings.source == "smartthings"
                        else asyncio.run(fetch_local_readings(settings))
                    )
                    inserted = persist_readings(connection, readings, settings.retention_days)
                    for error in child_errors:
                        record_error(connection, "child", error)
                    summary = ", ".join(
                        f"{reading.sensor_name}: {reading.temperature_c:.1f}°C / {reading.humidity_percent:.0f}%"
                        for reading in readings
                    )
                    print(f"저장 완료: {inserted}건 ({summary})")
                    return 0
                except Exception as error:
                    record_error(connection, "poll", error)
                    raise
    except Exception as error:
        print(f"온습도 수집 실패: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
