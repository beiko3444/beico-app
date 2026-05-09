# Beiko SMS Forwarder Android App

베이코 입금 문자 자동매칭용 Android 앱입니다.

## APK

Debug APK:

```text
android/smsforwarder/build/outputs/apk/debug/smsforwarder-debug.apk
```

## 기본 동작

- 앱 첫 실행 후 `SMS 권한 허용`을 누릅니다.
- 기본 수신 URL은 `http://192.168.219.176:8088/sms/incoming`입니다.
- 문자가 오면 아래 JSON을 라즈베리파이로 전송합니다.

```json
{
  "sender": "문자 발신번호",
  "message": "문자 원문",
  "receivedAt": "수신시각",
  "sourceDevice": "beiko-sms-forwarder/기기명/android-id"
}
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
