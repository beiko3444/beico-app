# BEIKO Mobile

Standalone Android app for BEIKO admin phone notifications and SMS-style messaging.

This app is intentionally separate from the existing root `android/` Capacitor app.

## Setup

1. Put Firebase Android config at:

   `apps/beiko-mobile/android/app/google-services.json`

   Without this file, the app can compile and the SMS screen can open, but FCM token registration and push alerts will not work.

2. Set these server environment variables:

   - `BEIKO_ALERT_APP_REGISTER_SECRET`
   - `BEIKO_ALERT_APP_ADMIN_USERNAME` optional, defaults to first admin user
   - existing Firebase Admin variables: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

3. Build:

   ```bash
   cd apps/beiko-mobile/android
   ./gradlew assembleDebug
   ```

4. Install `app/build/outputs/apk/debug/app-debug.apk`.

## App Features

- Registers this device as an `alerts:android` FCM target.
- Receives admin push alerts for new orders, incoming mobile messages, and deposit SMS matching.
- Provides a chat-like SMS screen using Android SMS permissions.
