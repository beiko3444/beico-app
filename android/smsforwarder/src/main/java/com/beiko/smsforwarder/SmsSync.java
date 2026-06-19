package com.beiko.smsforwarder;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class SmsSync {
    private static final int MAX_IMPORT = 5000;

    private SmsSync() {
    }

    static void importExistingAsync(Context context, Callback callback) {
        new Thread(() -> {
            Context appContext = context.getApplicationContext();
            try {
                SmsQueue queue = new SmsQueue(appContext);
                ArrayList<MessageRecord> records = new ArrayList<>();
                SmsForwarder.saveProgress(appContext, new SyncProgress(
                        "SMS 스캔중",
                        MAX_IMPORT * 2,
                        0,
                        0,
                        0,
                        0,
                        queue.countPending(),
                        ""
                ));
                records.addAll(readSmsInbox(appContext, 0, 0));
                SmsForwarder.saveProgress(appContext, new SyncProgress(
                        "MMS 스캔중",
                        MAX_IMPORT * 2,
                        records.size(),
                        0,
                        0,
                        0,
                        queue.countPending(),
                        ""
                ));
                records.addAll(readMmsInbox(appContext, 0, records.size()));
                int queued = queue.enqueueAll(records);
                SmsForwarder.saveProgress(appContext, new SyncProgress(
                        "큐 저장 완료",
                        records.size(),
                        records.size(),
                        queued,
                        0,
                        0,
                        queue.countPending(),
                        ""
                ));
                SmsForwarder.retryPending(appContext);
                callback.onDone("기존 문자 스캔 완료: " + records.size() + "건 확인, " + queued + "건 큐 추가");
            } catch (Exception error) {
                SmsForwarder.saveProgress(appContext, new SyncProgress(
                        "기존 문자 스캔 실패",
                        1,
                        0,
                        0,
                        0,
                        1,
                        new SmsQueue(appContext).countPending(),
                        error.getMessage()
                ));
                callback.onDone("기존 문자 스캔 실패: " + error.getMessage());
            }
        }).start();
    }

    static void importRecentMmsAsync(Context context) {
        new Thread(() -> {
            importRecentMms(context.getApplicationContext());
        }).start();
    }

    static void importRecentMms(Context context) {
        Context appContext = context.getApplicationContext();
        try {
            long since = System.currentTimeMillis() - 10 * 60 * 1000;
            SmsQueue queue = new SmsQueue(appContext);
            List<MessageRecord> records = readMmsInbox(appContext, since, 0);
            int queued = queue.enqueueAll(records);
            SmsForwarder.saveProgress(appContext, new SyncProgress(
                    "새 MMS 큐 저장",
                    Math.max(1, records.size()),
                    records.size(),
                    queued,
                    0,
                    0,
                    queue.countPending(),
                    ""
            ));
            SmsForwarder.retryPending(appContext);
        } catch (Exception error) {
            SmsForwarder.saveProgress(appContext, new SyncProgress(
                    "새 MMS 처리 실패",
                    1,
                    0,
                    0,
                    0,
                    1,
                    new SmsQueue(appContext).countPending(),
                    error.getMessage()
            ));
        }
    }

    private static List<MessageRecord> readSmsInbox(Context context, long sinceMillis, int progressOffset) {
        ArrayList<MessageRecord> records = new ArrayList<>();
        String[] projection = new String[]{
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.THREAD_ID
        };
        String selection = sinceMillis > 0 ? Telephony.Sms.DATE + " >= ?" : null;
        String[] selectionArgs = sinceMillis > 0 ? new String[]{String.valueOf(sinceMillis)} : null;

        try (Cursor cursor = context.getContentResolver().query(
                Telephony.Sms.Inbox.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                Telephony.Sms.DATE + " DESC"
        )) {
            if (cursor == null) return records;
            int count = 0;
            while (cursor.moveToNext() && count < MAX_IMPORT) {
                String id = cursor.getString(0);
                String sender = cursor.getString(1);
                String body = cursor.getString(2);
                long receivedAt = cursor.getLong(3);
                String threadId = cursor.getString(4);
                if (body == null || body.trim().length() == 0) continue;
                records.add(SmsForwarder.buildMessage(
                        context,
                        SmsForwarder.createFallbackMessageId("SMS", sender, body, receivedAt),
                        "SMS",
                        sender,
                        body,
                        receivedAt,
                        threadId
                ));
                count++;
                if (count % 100 == 0) {
                    SmsForwarder.saveProgress(context, new SyncProgress(
                            "SMS 스캔중",
                            MAX_IMPORT * 2,
                            progressOffset + count,
                            0,
                            0,
                            0,
                            new SmsQueue(context).countPending(),
                            ""
                    ));
                }
            }
        }
        return records;
    }

    private static List<MessageRecord> readMmsInbox(Context context, long sinceMillis, int progressOffset) {
        ArrayList<MessageRecord> records = new ArrayList<>();
        Uri inbox = Uri.parse("content://mms/inbox");
        String[] projection = new String[]{"_id", "date", "thread_id"};
        long sinceSeconds = sinceMillis > 0 ? sinceMillis / 1000 : 0;
        String selection = sinceSeconds > 0 ? "date >= ?" : null;
        String[] selectionArgs = sinceSeconds > 0 ? new String[]{String.valueOf(sinceSeconds)} : null;

        try (Cursor cursor = context.getContentResolver().query(
                inbox,
                projection,
                selection,
                selectionArgs,
                "date DESC"
        )) {
            if (cursor == null) return records;
            int count = 0;
            while (cursor.moveToNext() && count < MAX_IMPORT) {
                String id = cursor.getString(0);
                long receivedAt = cursor.getLong(1) * 1000L;
                String threadId = cursor.getString(2);
                String body = readMmsText(context, id);
                if (body == null || body.trim().length() == 0) continue;
                records.add(SmsForwarder.buildMessage(
                        context,
                        "mms:" + id,
                        "MMS",
                        readMmsSender(context, id),
                        body,
                        receivedAt,
                        threadId
                ));
                count++;
                if (count % 50 == 0) {
                    SmsForwarder.saveProgress(context, new SyncProgress(
                            "MMS 스캔중",
                            MAX_IMPORT * 2,
                            progressOffset + count,
                            0,
                            0,
                            0,
                            new SmsQueue(context).countPending(),
                            ""
                    ));
                }
            }
        }
        return records;
    }

    private static String readMmsSender(Context context, String mmsId) {
        Uri uri = Uri.parse("content://mms/" + mmsId + "/addr");
        try (Cursor cursor = context.getContentResolver().query(
                uri,
                new String[]{"address", "type"},
                null,
                null,
                null
        )) {
            if (cursor == null) return "";
            while (cursor.moveToNext()) {
                int type = cursor.getInt(1);
                String address = cursor.getString(0);
                if (type == 137 && address != null) return address;
            }
        }
        return "";
    }

    private static String readMmsText(Context context, String mmsId) {
        Uri uri = Uri.parse("content://mms/part");
        StringBuilder body = new StringBuilder();
        try (Cursor cursor = context.getContentResolver().query(
                uri,
                new String[]{"_id", "ct", "text", "_data"},
                "mid = ?",
                new String[]{mmsId},
                null
        )) {
            if (cursor == null) return "";
            while (cursor.moveToNext()) {
                String contentType = cursor.getString(1);
                if (!"text/plain".equalsIgnoreCase(contentType)) continue;
                String text = cursor.getString(2);
                if (text == null || text.length() == 0) {
                    String partId = cursor.getString(0);
                    text = readMmsTextPartData(context, partId);
                }
                if (text != null && text.trim().length() > 0) {
                    if (body.length() > 0) body.append("\n");
                    body.append(text);
                }
            }
        }
        return body.toString();
    }

    private static String readMmsTextPartData(Context context, String partId) {
        Uri partUri = Uri.parse("content://mms/part/" + partId);
        try (InputStream input = context.getContentResolver().openInputStream(partUri)) {
            if (input == null) return "";
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    interface Callback {
        void onDone(String message);
    }
}
