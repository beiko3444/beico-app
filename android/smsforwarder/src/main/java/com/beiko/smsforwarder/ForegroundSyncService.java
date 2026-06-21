package com.beiko.smsforwarder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

public class ForegroundSyncService extends Service {
    private static final String CHANNEL_ID = "beiko_sms_sync";
    private static final int NOTIFICATION_ID = 3445;
    private static final long POLL_INTERVAL_MS = 10 * 1000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!SmsForwarder.isEnabled(ForegroundSyncService.this)) {
                stopSelf();
                return;
            }

            SmsForwarder.retryPending(ForegroundSyncService.this);
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    static void start(Context context) {
        Context appContext = context.getApplicationContext();
        Intent intent = new Intent(appContext, ForegroundSyncService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                appContext.startForegroundService(intent);
            } else {
                appContext.startService(intent);
            }
        } catch (RuntimeException ignored) {
            SmsForwarder.saveStatus(appContext, "포그라운드 동기화 시작 실패: 앱을 한 번 열어주세요.");
        }
    }

    static void stop(Context context) {
        Context appContext = context.getApplicationContext();
        try {
            appContext.stopService(new Intent(appContext, ForegroundSyncService.class));
        } catch (RuntimeException ignored) {
            // Service may already be stopped.
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        handler.removeCallbacks(ticker);
        ticker.run();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(ticker);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, flags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);

        return builder
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentTitle("Beiko 문자 동기화 실행 중")
                .setContentText("잠금 상태에서도 문자 저장/발송을 확인합니다.")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setShowWhen(false)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Beiko 문자 동기화",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("문자 수신 저장과 발송 대기열 확인을 계속 실행합니다.");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
