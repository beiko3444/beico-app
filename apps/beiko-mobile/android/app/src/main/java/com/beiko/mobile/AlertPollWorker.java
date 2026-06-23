package com.beiko.mobile;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class AlertPollWorker extends Worker {
    private static final String WORK_NAME = "beiko-alert-poll";
    private static final String CHANNEL_ID = "beiko_alerts_polling";

    public AlertPollWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    public static void schedule(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(AlertPollWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
        );
    }

    public static void pollNow(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(AlertPollWorker.class).build();
        WorkManager.getInstance(context).enqueue(request);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            SharedPreferences prefs = MainActivity.getPrefs(getApplicationContext());
            String secret = prefs.getString(MainActivity.KEY_SECRET, "");
            if (secret == null || secret.trim().length() == 0) return Result.success();

            String since = prefs.getString(MainActivity.KEY_LAST_ALERT_AT, "");
            if (since == null || since.length() == 0) {
                prefs.edit().putString(MainActivity.KEY_LAST_ALERT_AT, isoNow()).apply();
                return Result.success();
            }

            String serverUrl = MainActivity.normalizeServerUrl(
                    prefs.getString(MainActivity.KEY_SERVER_URL, MainActivity.DEFAULT_SERVER_URL)
            );
            JSONObject response = fetchAlerts(serverUrl, secret, since);
            JSONArray alerts = response.optJSONArray("alerts");
            if (alerts == null || alerts.length() == 0) return Result.success();

            String latest = since;
            for (int i = alerts.length() - 1; i >= 0; i--) {
                JSONObject alert = alerts.optJSONObject(i);
                if (alert == null) continue;
                showNotification(
                        alert.optString("title", "BEIKO 알림"),
                        alert.optString("body", "새 알림이 있습니다."),
                        alert.optString("url", "")
                );
                String createdAt = alert.optString("createdAt", "");
                if (createdAt.compareTo(latest) > 0) latest = createdAt;
            }
            prefs.edit().putString(MainActivity.KEY_LAST_ALERT_AT, latest).apply();
            return Result.success();
        } catch (Exception error) {
            return Result.retry();
        }
    }

    private JSONObject fetchAlerts(String serverUrl, String secret, String since) throws Exception {
        String endpoint = serverUrl + "/api/mobile/alerts?since=" + URLEncoder.encode(since, "UTF-8");
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        try {
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setRequestProperty("Authorization", "Bearer " + secret.trim());
            connection.setRequestProperty("x-mobile-message-secret", secret.trim());

            int code = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                    StandardCharsets.UTF_8
            ));
            StringBuilder body = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code + ": " + body);
            return new JSONObject(body.toString());
        } finally {
            connection.disconnect();
        }
    }

    private void showNotification(String title, String body, String url) {
        Context context = getApplicationContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "BEIKO 알림",
                    NotificationManager.IMPORTANCE_HIGH
            );
            manager.createNotificationChannel(channel);
        }

        Intent intent;
        if (url != null && url.startsWith("/")) {
            String baseUrl = MainActivity.normalizeServerUrl(
                    MainActivity.getPrefs(context).getString(MainActivity.KEY_SERVER_URL, MainActivity.DEFAULT_SERVER_URL)
            );
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(baseUrl + url));
        } else {
            intent = new Intent(context, MainActivity.class);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new android.app.Notification.Builder(context, CHANNEL_ID)
                : new android.app.Notification.Builder(context);
        builder
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
        manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private static String isoNow() {
        return String.format(Locale.US, "%tFT%<tTZ", new Date());
    }
}
