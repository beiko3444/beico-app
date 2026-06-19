package com.beiko.smsforwarder;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

final class SmsForwarder {
    static final String PREFS = "beiko_sms_forwarder";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_SECRET = "secret";
    static final String KEY_USERNAME = "username";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_LAST_STATUS = "last_status";
    static final String KEY_LAST_SENT_AT = "last_sent_at";
    private static final String KEY_PROGRESS_STAGE = "progress_stage";
    private static final String KEY_PROGRESS_TOTAL = "progress_total";
    private static final String KEY_PROGRESS_SCANNED = "progress_scanned";
    private static final String KEY_PROGRESS_QUEUED = "progress_queued";
    private static final String KEY_PROGRESS_SENT = "progress_sent";
    private static final String KEY_PROGRESS_FAILED = "progress_failed";
    private static final String KEY_PROGRESS_PENDING = "progress_pending";
    private static final String KEY_PROGRESS_ERROR = "progress_error";
    private static final int TIMEOUT_MS = 15000;
    private static final int BATCH_SIZE = 100;

    private SmsForwarder() {
    }

    static String getEndpoint(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String saved = prefs.getString(KEY_ENDPOINT, null);
        if (saved != null && saved.trim().length() > 0) return saved.trim();
        return context.getString(R.string.default_endpoint);
    }

    static void saveEndpoint(Context context, String endpoint) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ENDPOINT, endpoint.trim())
                .apply();
    }

    static String getSecret(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SECRET, "");
    }

    static void saveSecret(Context context, String secret) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_SECRET, secret == null ? "" : secret.trim())
                .apply();
    }

    static String getUsername(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_USERNAME, "");
    }

    static void saveUsername(Context context, String username) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_USERNAME, username == null ? "" : username.trim())
                .apply();
    }

    static boolean isEnabled(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_ENABLED, enabled)
                .apply();
    }

    static String getLastStatus(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_LAST_STATUS, "아직 전송 기록이 없습니다.");
    }

    static int getPendingCount(Context context) {
        return new SmsQueue(context).countPending();
    }

    static SyncProgress getProgress(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new SyncProgress(
                prefs.getString(KEY_PROGRESS_STAGE, "대기중"),
                prefs.getInt(KEY_PROGRESS_TOTAL, 0),
                prefs.getInt(KEY_PROGRESS_SCANNED, 0),
                prefs.getInt(KEY_PROGRESS_QUEUED, 0),
                prefs.getInt(KEY_PROGRESS_SENT, 0),
                prefs.getInt(KEY_PROGRESS_FAILED, 0),
                new SmsQueue(context).countPending(),
                prefs.getString(KEY_PROGRESS_ERROR, "")
        );
    }

    static void saveProgress(Context context, SyncProgress progress) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_PROGRESS_STAGE, progress.stage)
                .putInt(KEY_PROGRESS_TOTAL, progress.total)
                .putInt(KEY_PROGRESS_SCANNED, progress.scanned)
                .putInt(KEY_PROGRESS_QUEUED, progress.queued)
                .putInt(KEY_PROGRESS_SENT, progress.sent)
                .putInt(KEY_PROGRESS_FAILED, progress.failed)
                .putInt(KEY_PROGRESS_PENDING, progress.pending)
                .putString(KEY_PROGRESS_ERROR, progress.lastError)
                .apply();
    }

    static MessageRecord buildMessage(
            Context context,
            String deviceMessageId,
            String messageType,
            String sender,
            String body,
            long receivedAtMillis,
            String threadId
    ) {
        return new MessageRecord(
                deviceMessageId,
                messageType == null ? "SMS" : messageType,
                sender,
                body,
                receivedAtMillis,
                threadId,
                getDeviceLabel(context)
        );
    }

    static String createFallbackMessageId(String messageType, String sender, String body, long receivedAtMillis) {
        return messageType.toLowerCase(Locale.US) + ":incoming:" + sha256(sender + "|" + body + "|" + receivedAtMillis);
    }

    static void enqueueAndRetry(Context context, MessageRecord message) {
        if (!isEnabled(context)) return;
        SmsQueue queue = new SmsQueue(context);
        boolean inserted = queue.enqueue(message);
        if (inserted) {
            saveStatus(context, "문자 큐 저장: " + message.messageType + " / 대기 " + queue.countPending() + "건");
            saveProgress(context, new SyncProgress(
                    "새 문자 큐 저장",
                    1,
                    1,
                    1,
                    0,
                    0,
                    queue.countPending(),
                    ""
            ));
        }
        retryPending(context);
    }

    static void enqueueAndRetryBlocking(Context context, MessageRecord message) {
        if (!isEnabled(context)) return;
        SmsQueue queue = new SmsQueue(context);
        boolean inserted = queue.enqueue(message);
        if (inserted) {
            saveStatus(context, "문자 큐 저장: " + message.messageType + " / 대기 " + queue.countPending() + "건");
            saveProgress(context, new SyncProgress(
                    "새 문자 큐 저장",
                    1,
                    1,
                    1,
                    0,
                    0,
                    queue.countPending(),
                    ""
            ));
        }
        drainQueue(context.getApplicationContext());
    }

    static void retryPending(Context context) {
        new Thread(() -> drainQueue(context.getApplicationContext())).start();
    }

    static void sendTest(Context context, Callback callback) {
        String body = "[BEIKO TEST] mobile message connection check";
        MessageRecord message = buildMessage(
                context,
                "test:" + System.currentTimeMillis(),
                "SMS",
                "BEIKO-TEST",
                body,
                System.currentTimeMillis(),
                "test"
        );
        new Thread(() -> {
            try {
                PostResult result = postBatch(context, java.util.Collections.singletonList(message));
                if (result.isSuccessful()) {
                    saveStatus(context, "테스트 전송 완료: HTTP " + result.code + " / "
                            + formatDisplayTime(System.currentTimeMillis()));
                    saveProgress(context, new SyncProgress("테스트 완료", 1, 0, 0, 1, 0, getPendingCount(context), ""));
                    callback.onDone("테스트 전송 완료");
                } else {
                    String status = "테스트 전송 실패: " + result.summary() + " / "
                            + formatDisplayTime(System.currentTimeMillis());
                    saveStatus(context, status);
                    saveProgress(context, new SyncProgress("테스트 실패", 1, 0, 0, 0, 1, getPendingCount(context), result.summary()));
                    callback.onDone(status);
                }
            } catch (Exception error) {
                String status = "테스트 전송 실패: " + safeError(error) + " / "
                        + formatDisplayTime(System.currentTimeMillis());
                saveStatus(context, status);
                saveProgress(context, new SyncProgress("테스트 실패", 1, 0, 0, 0, 1, getPendingCount(context), safeError(error)));
                callback.onDone(status);
            }
        }).start();
    }

    private static void drainQueue(Context context) {
        SmsQueue queue = new SmsQueue(context);
        List<MessageRecord> pending = queue.getPending(BATCH_SIZE);
        if (pending.isEmpty()) {
            saveProgress(context, new SyncProgress("완료", 0, 0, 0, 0, 0, 0, ""));
            return;
        }

        int pendingBefore = queue.countPending();
        saveProgress(context, new SyncProgress(
                "서버 전송중",
                pending.size(),
                0,
                pending.size(),
                0,
                0,
                pendingBefore,
                ""
        ));

        try {
            PostResult result = postBatch(context, pending);
            if (result.isSuccessful()) {
                queue.markSent(pending);
                int pendingAfter = queue.countPending();
                saveStatus(context, "전송 완료: " + pending.size() + "건 / 대기 " + queue.countPending()
                        + "건 / " + formatDisplayTime(System.currentTimeMillis()));
                saveProgress(context, new SyncProgress(
                        pendingAfter > 0 ? "일부 전송 완료" : "완료",
                        pending.size(),
                        0,
                        pending.size(),
                        pending.size(),
                        0,
                        pendingAfter,
                        ""
                ));
                if (pendingAfter > 0) drainQueue(context);
            } else {
                String error = result.summary();
                queue.markFailed(pending, error);
                int pendingAfter = queue.countPending();
                saveStatus(context, "전송 실패: " + error + " / 대기 " + pendingAfter
                        + "건 / " + formatDisplayTime(System.currentTimeMillis()));
                saveProgress(context, new SyncProgress(
                        "전송 실패",
                        pending.size(),
                        0,
                        pending.size(),
                        0,
                        pending.size(),
                        pendingAfter,
                        error
                ));
            }
        } catch (Exception error) {
            String errorMessage = safeError(error);
            queue.markFailed(pending, errorMessage);
            int pendingAfter = queue.countPending();
            saveStatus(context, "전송 실패: " + errorMessage + " / 대기 " + pendingAfter
                    + "건 / " + formatDisplayTime(System.currentTimeMillis()));
            saveProgress(context, new SyncProgress(
                    "전송 실패",
                    pending.size(),
                    0,
                    pending.size(),
                    0,
                    pending.size(),
                    pendingAfter,
                    errorMessage
            ));
        }
    }

    private static PostResult postBatch(Context context, List<MessageRecord> messages) throws Exception {
        String endpoint = getEndpoint(context);
        String secret = getSecret(context);
        String username = getUsername(context);
        String payload = buildPayload(context, username, messages);

        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (secret != null && secret.trim().length() > 0) {
            connection.setRequestProperty("Authorization", "Bearer " + secret.trim());
            connection.setRequestProperty("x-mobile-message-secret", secret.trim());
        }

        try {
            byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bytes);
            }
            int code = connection.getResponseCode();
            InputStream responseStream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String body = "";
            if (responseStream != null) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(responseStream, StandardCharsets.UTF_8))) {
                    StringBuilder responseBody = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (responseBody.length() < 500) {
                            responseBody.append(line);
                        }
                    }
                    body = responseBody.toString();
                } catch (Exception ignored) {
                }
            }
            return new PostResult(code, body);
        } finally {
            connection.disconnect();
        }
    }

    private static String buildPayload(Context context, String username, List<MessageRecord> messages) {
        StringBuilder builder = new StringBuilder();
        builder.append("{");
        builder.append("\"username\":\"").append(jsonEscape(username)).append("\",");
        builder.append("\"sourceDevice\":\"").append(jsonEscape(getDeviceLabel(context))).append("\",");
        builder.append("\"messages\":[");
        for (int i = 0; i < messages.size(); i++) {
            MessageRecord message = messages.get(i);
            if (i > 0) builder.append(",");
            builder.append("{");
            builder.append("\"deviceMessageId\":\"").append(jsonEscape(message.deviceMessageId)).append("\",");
            builder.append("\"messageType\":\"").append(jsonEscape(message.messageType)).append("\",");
            builder.append("\"direction\":\"INBOUND\",");
            builder.append("\"sender\":\"").append(jsonEscape(message.sender)).append("\",");
            builder.append("\"body\":\"").append(jsonEscape(message.body)).append("\",");
            builder.append("\"receivedAt\":\"").append(jsonEscape(formatIso(message.receivedAtMillis))).append("\",");
            builder.append("\"threadId\":\"").append(jsonEscape(message.threadId)).append("\",");
            builder.append("\"sourceDevice\":\"").append(jsonEscape(message.sourceDevice)).append("\"");
            builder.append("}");
        }
        builder.append("]}");
        return builder.toString();
    }

    private static void saveStatus(Context context, String status) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LAST_STATUS, status)
                .putLong(KEY_LAST_SENT_AT, System.currentTimeMillis())
                .apply();
    }

    private static String getDeviceLabel(Context context) {
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        String model = Build.MODEL == null ? "Android" : Build.MODEL;
        return "beiko-sms-forwarder/" + model + "/" + (androidId == null ? "unknown" : androidId);
    }

    private static String formatIso(long timeMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US);
        formatter.setTimeZone(TimeZone.getDefault());
        return formatter.format(new Date(timeMillis));
    }

    private static String formatDisplayTime(long timeMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat("MM/dd HH:mm:ss", Locale.KOREA);
        return formatter.format(new Date(timeMillis));
    }

    private static String safeError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().length() == 0) return error.getClass().getSimpleName();
        return message;
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : bytes) result.append(String.format(Locale.US, "%02x", b));
            return result.toString();
        } catch (Exception ignored) {
            return String.valueOf(value.hashCode());
        }
    }

    interface Callback {
        void onDone(String message);
    }

    private static final class PostResult {
        final int code;
        final String body;

        PostResult(int code, String body) {
            this.code = code;
            this.body = body == null ? "" : body.trim();
        }

        boolean isSuccessful() {
            return code >= 200 && code < 300;
        }

        String summary() {
            if (body.length() == 0) return "HTTP " + code;
            return "HTTP " + code + ": " + body;
        }
    }
}
