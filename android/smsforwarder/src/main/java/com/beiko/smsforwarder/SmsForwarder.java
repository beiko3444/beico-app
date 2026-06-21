package com.beiko.smsforwarder;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.telephony.SmsManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
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
    private static final int SYNC_ALARM_REQUEST = 7713;
    private static final long SYNC_INTERVAL_MS = 15 * 60 * 1000;
    static final String ACTION_SYNC_TICK = "com.beiko.smsforwarder.SYNC_TICK";
    private static final SingleFlight syncSingleFlight = new SingleFlight();
    private static boolean outgoingPollRunning = false;

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
        if (enabled) {
            scheduleSync(context);
            ForegroundSyncService.start(context);
        } else {
            cancelSync(context);
            ForegroundSyncService.stop(context);
        }
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
                lookupContactName(context, sender),
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
        runSyncOnceBlocking(context.getApplicationContext());
    }

    static void retryPending(Context context) {
        Context appContext = context.getApplicationContext();
        new Thread(() -> runSyncOnceBlocking(appContext)).start();
    }

    static void pollAndSendOutgoing(Context context) {
        if (!isEnabled(context)) return;
        new Thread(() -> pollAndSendOutgoingBlocking(context.getApplicationContext())).start();
    }

    static void scheduleSync(Context context) {
        Context appContext = context.getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) appContext.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        PendingIntent pendingIntent = syncPendingIntent(appContext, PendingIntent.FLAG_UPDATE_CURRENT);
        alarmManager.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + 60 * 1000,
                SYNC_INTERVAL_MS,
                pendingIntent
        );
    }

    private static void runSyncOnceBlocking(Context context) {
        if (!syncSingleFlight.tryStart()) return;
        try {
            Context appContext = context.getApplicationContext();
            drainQueue(appContext);
            pollAndSendOutgoingBlocking(appContext);
        } finally {
            syncSingleFlight.finish();
        }
    }

    private static void cancelSync(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getApplicationContext().getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        alarmManager.cancel(syncPendingIntent(context.getApplicationContext(), PendingIntent.FLAG_UPDATE_CURRENT));
    }

    private static PendingIntent syncPendingIntent(Context context, int flags) {
        Intent intent = new Intent(context, SyncRetryReceiver.class);
        intent.setAction(ACTION_SYNC_TICK);
        int finalFlags = flags;
        if (Build.VERSION.SDK_INT >= 23) {
            finalFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, SYNC_ALARM_REQUEST, intent, finalFlags);
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

    private static void pollAndSendOutgoingBlocking(Context context) {
        if (!isEnabled(context)) return;
        synchronized (SmsForwarder.class) {
            if (outgoingPollRunning) return;
            outgoingPollRunning = true;
        }
        try {
            pollAndSendOutgoingLocked(context);
        } finally {
            synchronized (SmsForwarder.class) {
                outgoingPollRunning = false;
            }
        }
    }

    private static void pollAndSendOutgoingLocked(Context context) {
        if (context.checkSelfPermission(android.Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            saveStatus(context, "발송 실패: SEND_SMS 권한이 없습니다.");
            saveProgress(context, new SyncProgress("발송 권한 필요", 1, 0, 0, 0, 1, getPendingCount(context), "SEND_SMS 권한 필요"));
            return;
        }

        try {
            List<OutgoingTextMessage> messages = fetchOutgoingMessages(context);
            if (messages.isEmpty()) return;

            saveStatus(context, "발송 대기문자 확인: " + messages.size() + "건");
            saveProgress(context, new SyncProgress("문자 발송중", messages.size(), messages.size(), messages.size(), 0, 0, getPendingCount(context), ""));

            JSONArray results = new JSONArray();
            int sent = 0;
            int failed = 0;
            for (OutgoingTextMessage message : messages) {
                JSONObject result = new JSONObject();
                result.put("id", message.id);
                try {
                    sendTextMessage(message);
                    result.put("status", "SENT");
                    result.put("error", "");
                    sent++;
                } catch (Exception error) {
                    result.put("status", "FAILED");
                    result.put("error", safeError(error));
                    failed++;
                }
                results.put(result);
            }

            reportOutgoingResults(context, results);
            saveStatus(context, "발송 처리 완료: 성공 " + sent + "건 / 실패 " + failed + "건 / "
                    + formatDisplayTime(System.currentTimeMillis()));
            saveProgress(context, new SyncProgress("문자 발송 완료", messages.size(), messages.size(), messages.size(), sent, failed, getPendingCount(context), failed > 0 ? "일부 발송 실패" : ""));
        } catch (Exception error) {
            saveStatus(context, "발송 대기문자 확인 실패: " + safeError(error) + " / "
                    + formatDisplayTime(System.currentTimeMillis()));
            saveProgress(context, new SyncProgress("발송 확인 실패", 1, 0, 0, 0, 1, getPendingCount(context), safeError(error)));
        }
    }

    private static List<OutgoingTextMessage> fetchOutgoingMessages(Context context) throws Exception {
        String endpoint = getOutgoingEndpoint(context);
        String username = getUsername(context);
        String sourceDevice = getDeviceLabel(context);
        String query = "?limit=10"
                + "&username=" + URLEncoder.encode(username == null ? "" : username, "UTF-8")
                + "&sourceDevice=" + URLEncoder.encode(sourceDevice, "UTF-8");

        HttpURLConnection connection = openJsonConnection(endpoint + query, "GET", context);
        try {
            int code = connection.getResponseCode();
            String response = readResponseBody(connection, code);
            if (code < 200 || code >= 300) {
                throw new Exception("HTTP " + code + ": " + response);
            }

            JSONObject json = new JSONObject(response);
            JSONArray items = json.optJSONArray("messages");
            ArrayList<OutgoingTextMessage> messages = new ArrayList<>();
            if (items == null) return messages;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id", "");
                String toNumber = item.optString("toNumber", "");
                String body = item.optString("body", "");
                if (id.length() == 0 || toNumber.length() == 0 || body.length() == 0) continue;
                messages.add(new OutgoingTextMessage(
                        id,
                        item.optString("toName", ""),
                        toNumber,
                        body
                ));
            }
            return messages;
        } finally {
            connection.disconnect();
        }
    }

    private static void reportOutgoingResults(Context context, JSONArray results) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("sourceDevice", getDeviceLabel(context));
        payload.put("results", results);

        HttpURLConnection connection = openJsonConnection(getOutgoingResultEndpoint(context), "POST", context);
        try {
            byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bytes);
            }
            int code = connection.getResponseCode();
            String response = readResponseBody(connection, code);
            if (code < 200 || code >= 300) {
                throw new Exception("HTTP " + code + ": " + response);
            }
        } finally {
            connection.disconnect();
        }
    }

    private static void sendTextMessage(OutgoingTextMessage message) {
        SmsManager smsManager = SmsManager.getDefault();
        ArrayList<String> parts = smsManager.divideMessage(message.body);
        if (parts == null || parts.isEmpty()) {
            throw new IllegalArgumentException("문자 내용이 비어 있습니다.");
        }
        smsManager.sendMultipartTextMessage(message.toNumber, null, parts, null, null);
    }

    private static HttpURLConnection openJsonConnection(String endpoint, String method, Context context) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        String secret = getSecret(context);
        if (secret != null && secret.trim().length() > 0) {
            connection.setRequestProperty("Authorization", "Bearer " + secret.trim());
            connection.setRequestProperty("x-mobile-message-secret", secret.trim());
        }
        if ("POST".equals(method)) {
            connection.setDoOutput(true);
        }
        return connection;
    }

    private static String readResponseBody(HttpURLConnection connection, int code) throws Exception {
        InputStream responseStream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        String body = "";
        if (responseStream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(responseStream, StandardCharsets.UTF_8))) {
                StringBuilder responseBody = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (responseBody.length() < 1000) {
                        responseBody.append(line);
                    }
                }
                body = responseBody.toString();
            } catch (Exception ignored) {
            }
        }
        return body;
    }

    private static String getOutgoingEndpoint(Context context) {
        return resolveMobileMessageEndpoint(context, "/api/mobile/messages/outgoing");
    }

    private static String getOutgoingResultEndpoint(Context context) {
        return resolveMobileMessageEndpoint(context, "/api/mobile/messages/outgoing/result");
    }

    private static String resolveMobileMessageEndpoint(Context context, String path) {
        String endpoint = getEndpoint(context).trim();
        int marker = endpoint.indexOf("/api/mobile/messages/");
        if (marker >= 0) {
            return endpoint.substring(0, marker) + path;
        }
        if (endpoint.endsWith("/")) {
            return endpoint.substring(0, endpoint.length() - 1) + path;
        }
        return endpoint + path;
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
            builder.append("\"senderName\":\"").append(jsonEscape(message.senderName)).append("\",");
            builder.append("\"body\":\"").append(jsonEscape(message.body)).append("\",");
            builder.append("\"receivedAt\":\"").append(jsonEscape(formatIso(message.receivedAtMillis))).append("\",");
            builder.append("\"threadId\":\"").append(jsonEscape(message.threadId)).append("\",");
            builder.append("\"sourceDevice\":\"").append(jsonEscape(message.sourceDevice)).append("\"");
            builder.append("}");
        }
        builder.append("]}");
        return builder.toString();
    }

    static void saveStatus(Context context, String status) {
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

    private static String lookupContactName(Context context, String phoneNumber) {
        if (phoneNumber == null || phoneNumber.trim().length() == 0) return "";
        if (context.checkSelfPermission(android.Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            return "";
        }

        Uri uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(phoneNumber)
        );
        try (Cursor cursor = context.getContentResolver().query(
                uri,
                new String[]{ContactsContract.PhoneLookup.DISPLAY_NAME},
                null,
                null,
                null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                return name == null ? "" : name;
            }
        } catch (Exception ignored) {
        }
        return "";
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
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '\\':
                    escaped.append("\\\\");
                    break;
                case '"':
                    escaped.append("\\\"");
                    break;
                case '\n':
                    escaped.append("\\n");
                    break;
                case '\r':
                    escaped.append("\\r");
                    break;
                case '\t':
                    escaped.append("\\t");
                    break;
                default:
                    if (ch < 0x20) {
                        escaped.append(String.format(Locale.US, "\\u%04x", (int) ch));
                    } else {
                        escaped.append(ch);
                    }
                    break;
            }
        }
        return escaped.toString();
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
