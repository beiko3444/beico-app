# BEIKO Mobile

Standalone Android app for BEIKO admin phone notifications and SMS-style messaging.

This app is intentionally separate from the existing root `android/` Capacitor app.

## Setup

1. Set this server environment variable:

   - `MOBILE_MESSAGE_INGEST_SECRET`

2. Build:

   ```bash
   cd apps/beiko-mobile/android
   ./gradlew assembleDebug
   ```

3. Install `app/build/outputs/apk/debug/app-debug.apk`.

4. Open the app and enter:

   - server URL, for example `https://www.beiko.co.kr`
   - the same `MOBILE_MESSAGE_INGEST_SECRET`

The app does not require Firebase. It checks `/api/mobile/alerts` periodically and shows local Android notifications.

## App Features

- Shows phone notifications for new orders, incoming mobile messages, and deposit SMS matching.
- Provides a chat-like SMS screen using Android SMS permissions.
