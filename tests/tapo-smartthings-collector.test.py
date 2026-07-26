import importlib.util
import json
import sqlite3
import sys
from pathlib import Path


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "raspberry-pi-tapo-sensors.py"
SPEC = importlib.util.spec_from_file_location("beiko_tapo_collector", SCRIPT_PATH)
assert SPEC and SPEC.loader
collector = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = collector
SPEC.loader.exec_module(collector)


settings = collector.Settings(
    source="smartthings",
    hub_host="",
    username="",
    password="",
    smartthings_bridge_url="https://www.beiko.co.kr/api/smartthings/pi-readings",
    smartthings_collector_secret="test-secret",
    db_path=Path("/tmp/test-tapo.sqlite3"),
    sensor_ids=frozenset(),
    retention_days=730,
    timeout_seconds=20,
)

reading = collector.smartthings_reading(
    {
        "deviceId": "sensor-310",
        "label": "창고 T310",
        "model": "T310",
        "temperatureC": 24.56,
        "humidityPercent": 61.2,
        "batteryPercent": 88,
    },
    settings,
    "2026-07-26T01:05:00Z",
)

assert reading.sensor_id == "sensor-310"
assert reading.temperature_c == 24.56
assert reading.humidity_percent == 61.2
assert reading.battery_percent == 88
assert reading.hub_host == "smartthings-cloud"


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(
            {
                "ok": True,
                "collectedAt": "2026-07-26T01:05:00Z",
                "sensors": [
                    {
                        "deviceId": "sensor-310",
                        "label": "창고 T310",
                        "model": "T310",
                        "temperatureC": 24.56,
                        "humidityPercent": 61.2,
                        "batteryPercent": 88,
                    }
                ],
            }
        ).encode("utf-8")


collector.urlopen = lambda *_args, **_kwargs: FakeResponse()
bridge_readings, bridge_errors = collector.fetch_smartthings_readings(settings)
assert bridge_errors == []
assert len(bridge_readings) == 1
assert bridge_readings[0].sensor_name == "창고 T310"

connection = sqlite3.connect(":memory:")
collector.initialize_database(connection)
inserted = collector.persist_readings(connection, [reading], 730)
assert inserted == 1
row = connection.execute(
    """
    SELECT sensor_id, temperature_c, humidity_percent, battery_percent
    FROM tapo_measurements
    """
).fetchone()
assert row == ("sensor-310", 24.56, 61.2, 88)

inserted_again = collector.persist_readings(connection, [reading], 730)
assert inserted_again == 0
connection.close()

print("tapo smartthings collector ok")
