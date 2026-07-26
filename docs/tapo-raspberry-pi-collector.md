# 외부 H200 온습도계 → 라즈베리파이 DB

H200이 라즈베리파이와 다른 인터넷망에 있으므로 로컬 IP 대신 SmartThings 클라우드를 사용합니다.

```text
외부 H200/T310/T315
  → Tapo 클라우드
  → SmartThings
  → 베이코 앱의 보안 연결 주소
  → 라즈베리파이 수집기
  → SQLite
```

Tapo 비밀번호와 H200 내부 IP는 라즈베리파이에 넣지 않습니다. 베이코 앱은 SmartThings의 기기 읽기 권한만 승인받고, 라즈베리파이는 베이코 앱의 전용 주소에서 현재 값을 받아 5분마다 SQLite에 저장합니다.

## 1. 베이코 앱의 SmartThings 연결

SmartThings Developer Center에서 API Access App을 등록합니다.

- Redirect URI: `https://www.beiko.co.kr/api/admin/smartthings/callback`
- Target/Webhook URL: `https://www.beiko.co.kr/api/smartthings/webhook`
- 권한: `r:devices:*`만 사용

Vercel 환경설정에 다음 값을 추가합니다.

```ini
SMARTTHINGS_CLIENT_ID=
SMARTTHINGS_CLIENT_SECRET=
SMARTTHINGS_TOKEN_ENCRYPTION_KEY=
SMARTTHINGS_REDIRECT_URI=https://www.beiko.co.kr/api/admin/smartthings/callback
SMARTTHINGS_COLLECTOR_SECRET=
```

암호화 키와 수집기 비밀값은 각각 충분히 긴 임의 문자열로 만듭니다. 두 값을 채팅이나 Git에 넣지 않습니다.

배포 후 관리자 메뉴의 `온습도`로 들어가 `SmartThings 연결`을 누르고 삼성 계정에서 기기 읽기 권한을 승인합니다. `지금 수집`을 눌렀을 때 T310/T315 값이 보이면 앱 쪽 연결이 완료된 것입니다.

SmartThings 공식 문서:

- [API Access App 등록](https://developer.smartthings.com/docs/service-integrations/app-setup)
- [OAuth 연결](https://developer.smartthings.com/docs/service-integrations/oauth)

## 2. 라즈베리파이 설치

아래의 `pi`는 실제 라즈베리파이 로그인 계정으로 바꿉니다.

```bash
sudo apt update
sudo apt install -y python3-venv sqlite3
sudo install -d -o pi -g pi -m 700 /opt/beiko-tapo /var/lib/beiko
```

이 저장소의 다음 파일을 라즈베리파이 `/opt/beiko-tapo`로 복사합니다.

```text
scripts/raspberry-pi-tapo-sensors.py
scripts/requirements-tapo.txt
scripts/systemd/beiko-tapo-collector.service.example
scripts/systemd/beiko-tapo-collector.timer.example
```

SmartThings 방식은 Python 기본 기능만 사용하므로 별도 패키지가 필요하지 않습니다. 같은 내부망 H200을 읽는 예전 방식도 함께 쓸 경우에만 아래 가상환경을 준비합니다.

```bash
cd /opt/beiko-tapo
python3 -m venv .venv
.venv/bin/pip install -r requirements-tapo.txt
```

## 3. 라즈베리파이 비밀 설정

`/etc/beiko/tapo-sensors.env`를 만들고 다음 값을 설정합니다.

```ini
TAPO_SOURCE=smartthings
SMARTTHINGS_BRIDGE_URL=https://www.beiko.co.kr/api/smartthings/pi-readings
SMARTTHINGS_COLLECTOR_SECRET=Vercel에_넣은_값과_동일한_비밀값

TAPO_DB_PATH=/var/lib/beiko/tapo-sensors.sqlite3
TAPO_RETENTION_DAYS=730
TAPO_TIMEOUT_SECONDS=30

# 비워 두면 SmartThings의 모든 온습도 센서를 저장합니다.
# 특정 센서만 저장하려면 list 결과의 ID를 쉼표로 구분합니다.
# TAPO_SENSOR_IDS=
```

파일 권한을 제한합니다.

```bash
sudo chown root:pi /etc/beiko/tapo-sensors.env
sudo chmod 640 /etc/beiko/tapo-sensors.env
```

## 4. 첫 저장 확인

센서 목록을 확인합니다.

```bash
sudo -u pi sh -c 'set -a; . /etc/beiko/tapo-sensors.env; set +a; python3 /opt/beiko-tapo/raspberry-pi-tapo-sensors.py list'
```

결과에 T310/T315가 나오면 한 번 저장합니다.

```bash
sudo -u pi sh -c 'set -a; . /etc/beiko/tapo-sensors.env; set +a; python3 /opt/beiko-tapo/raspberry-pi-tapo-sensors.py poll'
sqlite3 /var/lib/beiko/tapo-sensors.sqlite3 'SELECT sensor_id, collected_at, temperature_c, humidity_percent, battery_percent FROM tapo_measurements ORDER BY id DESC LIMIT 10;'
```

## 5. 5분 자동 수집

서비스 파일에서 `User=pi`, `Group=pi`를 실제 계정으로 바꾼 후 설치합니다. SmartThings 방식에서는 `ExecStart`를 시스템 Python으로 바꿔도 됩니다.

```ini
ExecStart=/usr/bin/python3 /opt/beiko-tapo/raspberry-pi-tapo-sensors.py poll
```

설치 및 실행:

```bash
sudo cp /opt/beiko-tapo/beiko-tapo-collector.service.example /etc/systemd/system/beiko-tapo-collector.service
sudo cp /opt/beiko-tapo/beiko-tapo-collector.timer.example /etc/systemd/system/beiko-tapo-collector.timer
sudo systemctl daemon-reload
sudo systemctl enable --now beiko-tapo-collector.timer
systemctl list-timers beiko-tapo-collector.timer
```

결과와 오류 확인:

```bash
journalctl -u beiko-tapo-collector.service -n 50 --no-pager
sqlite3 /var/lib/beiko/tapo-sensors.sqlite3 'SELECT occurred_at, stage, error_message FROM tapo_collection_errors ORDER BY id DESC LIMIT 10;'
```

## DB 구성

SQLite 파일의 기본 위치는 `/var/lib/beiko/tapo-sensors.sqlite3`입니다.

- `tapo_sensors`: SmartThings에서 찾은 온습도 센서
- `tapo_measurements`: 시간별 온도, 습도, 배터리 이력
- `tapo_collection_errors`: 연결 또는 저장 오류

기본 보관 기간은 730일입니다. 기존 로컬 H200 방식도 `TAPO_SOURCE=local`로 계속 사용할 수 있지만, 외부 H200에는 `smartthings` 방식을 사용합니다.
