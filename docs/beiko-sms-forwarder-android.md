# Beiko SMS Forwarder Android App

베이코 서버 DB에 Android 수신 SMS/MMS 본문을 저장하는 Android 앱입니다.

## APK

Debug APK:

```text
android/smsforwarder/build/outputs/apk/debug/smsforwarder-debug.apk
```

## 기본 동작

- 서버 환경변수 `MOBILE_MESSAGE_INGEST_SECRET`을 설정합니다.
- 앱 첫 실행 후 서버 API URL, 수집 비밀키, 베이코 사용자명을 입력하고 저장합니다.
- `SMS/MMS 권한 허용`을 누른 뒤 `동기화 켜고 기존 문자 가져오기`를 누릅니다.
- 기본 수신 URL은 `https://www.beiko.co.kr/api/mobile/messages/batch`입니다.
- 새 SMS는 수신 즉시 큐에 저장하고 서버로 전송합니다.
- MMS는 텍스트 본문만 저장하며 첨부파일은 저장하지 않습니다.
- 오프라인/전송 실패 시 앱 내부 큐에 남겨두고 재전송합니다.

```json
{
  "username": "beiko-login-username",
  "sourceDevice": "beiko-sms-forwarder/기기명/android-id",
  "messages": [
    {
      "deviceMessageId": "sms:123",
      "messageType": "SMS",
      "direction": "INBOUND",
      "sender": "문자 발신번호",
      "body": "문자 원문",
      "receivedAt": "수신시각",
      "threadId": "1",
      "sourceDevice": "beiko-sms-forwarder/기기명/android-id"
    }
  ]
}
```

요청 인증:

```http
Authorization: Bearer ${MOBILE_MESSAGE_INGEST_SECRET}
Content-Type: application/json
```

## 빌드

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew :smsforwarder:assembleDebug
```

Android SDK 경로가 없다고 나오면 `android/local.properties`에 아래처럼 설정합니다.

```properties
sdk.dir=/Users/idabin/Library/Android/sdk
```
