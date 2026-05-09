package com.beiko.smsforwarder;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class SmsForwarder {
    static final String PREFS = "beiko_sms_forwarder";
    static final String KEY_ENDPOINT = "endpoint";
    static final String KEY_LAST_STATUS = "last_status";
    static final String KEY_LAST_SENT_AT = "last_sent_at";
    private static final int TIMEOUT_MS = 15000;

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

    static String getLastStatus(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_LAST_STATUS, "아직 전송 기록이 없습니다.");
    }

    static void forward(Context context, String sender, String message, long receivedAtMillis) {
        String endpoint = getEndpoint(context);
        String receivedAt = formatIso(receivedAtMillis);
        String payload = "{"
                + "\"sender\":\"" + jsonEscape(sender) + "\","
                + "\"message\":\"" + jsonEscape(message) + "\","
                + "\"receivedAt\":\"" + jsonEscape(receivedAt) + "\","
                + "\"sourceDevice\":\"" + jsonEscape(getDeviceLabel(context)) + "\""
                + "}";

        new Thread(() -> {
            String status;
            try {
                int code = postJson(endpoint, payload);
                status = code >= 200 && code < 300
                        ? "전송 완료: HTTP " + code + " / " + formatDisplayTime(System.currentTimeMillis())
                        : "전송 실패: HTTP " + code + " / " + formatDisplayTime(System.currentTimeMillis());
            } catch (Exception error) {
                status = "전송 실패: " + error.getMessage() + " / " + formatDisplayTime(System.currentTimeMillis());
            }
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_LAST_STATUS, status)
                    .putLong(KEY_LAST_SENT_AT, System.currentTimeMillis())
                    .apply();
        }).start();
    }

    static void sendTest(Context context, Callback callback) {
        String body = "[BEIKO TEST] SMS forwarder connection check";
        String endpoint = getEndpoint(context);
        String payload = "{"
                + "\"sender\":\"BEIKO-TEST\","
                + "\"message\":\"" + jsonEscape(body) + "\","
                + "\"receivedAt\":\"" + jsonEscape(formatIso(System.currentTimeMillis())) + "\","
                + "\"sourceDevice\":\"" + jsonEscape(getDeviceLabel(context) + "-test") + "\""
                + "}";
        new Thread(() -> {
            try {
                int code = postJson(endpoint, payload);
                callback.onDone("테스트 전송 완료: HTTP " + code);
            } catch (Exception error) {
                callback.onDone("테스트 전송 실패: " + error.getMessage());
            }
        }).start();
    }

    private static int postJson(String endpoint, String payload) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream outputStream = connection.getOutputStream()) {
            outputStream.write(bytes);
        }
        int code = connection.getResponseCode();
        try (BufferedReader ignored = new BufferedReader(new InputStreamReader(
                code >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                StandardCharsets.UTF_8
        ))) {
            while (ignored.readLine() != null) {
                // Drain body so the connection closes cleanly.
            }
        } catch (Exception ignored) {
        } finally {
            connection.disconnect();
        }
        return code;
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

    private static String jsonEscape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    interface Callback {
        void onDone(String message);
    }
}
