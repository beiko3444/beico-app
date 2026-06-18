package com.beiko.smsforwarder;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

final class SmsQueue extends SQLiteOpenHelper {
    private static final String DB_NAME = "beiko_sms_queue.db";
    private static final int DB_VERSION = 1;
    private static final String TABLE = "pending_messages";

    SmsQueue(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE " + TABLE + " ("
                + "device_message_id TEXT PRIMARY KEY,"
                + "message_type TEXT NOT NULL,"
                + "sender TEXT,"
                + "body TEXT NOT NULL,"
                + "received_at INTEGER NOT NULL,"
                + "thread_id TEXT,"
                + "source_device TEXT,"
                + "attempt_count INTEGER NOT NULL DEFAULT 0,"
                + "last_error TEXT,"
                + "created_at INTEGER NOT NULL"
                + ")");
        db.execSQL("CREATE INDEX idx_pending_created_at ON " + TABLE + " (created_at)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        db.execSQL("DROP TABLE IF EXISTS " + TABLE);
        onCreate(db);
    }

    boolean enqueue(MessageRecord message) {
        if (message == null || isBlank(message.deviceMessageId) || isBlank(message.body)) return false;

        ContentValues values = new ContentValues();
        values.put("device_message_id", message.deviceMessageId);
        values.put("message_type", message.messageType);
        values.put("sender", message.sender);
        values.put("body", message.body);
        values.put("received_at", message.receivedAtMillis);
        values.put("thread_id", message.threadId);
        values.put("source_device", message.sourceDevice);
        values.put("created_at", System.currentTimeMillis());

        long result = getWritableDatabase().insertWithOnConflict(
                TABLE,
                null,
                values,
                SQLiteDatabase.CONFLICT_IGNORE
        );
        return result != -1;
    }

    int enqueueAll(List<MessageRecord> messages) {
        if (messages == null || messages.isEmpty()) return 0;
        int inserted = 0;
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (MessageRecord message : messages) {
                if (message == null || isBlank(message.deviceMessageId) || isBlank(message.body)) continue;
                ContentValues values = new ContentValues();
                values.put("device_message_id", message.deviceMessageId);
                values.put("message_type", message.messageType);
                values.put("sender", message.sender);
                values.put("body", message.body);
                values.put("received_at", message.receivedAtMillis);
                values.put("thread_id", message.threadId);
                values.put("source_device", message.sourceDevice);
                values.put("created_at", System.currentTimeMillis());
                long result = db.insertWithOnConflict(TABLE, null, values, SQLiteDatabase.CONFLICT_IGNORE);
                if (result != -1) inserted++;
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        return inserted;
    }

    List<MessageRecord> getPending(int limit) {
        ArrayList<MessageRecord> messages = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
                TABLE,
                new String[]{"device_message_id", "message_type", "sender", "body", "received_at", "thread_id", "source_device"},
                null,
                null,
                null,
                null,
                "created_at ASC",
                String.valueOf(limit)
        )) {
            while (cursor.moveToNext()) {
                messages.add(new MessageRecord(
                        cursor.getString(0),
                        cursor.getString(1),
                        cursor.getString(2),
                        cursor.getString(3),
                        cursor.getLong(4),
                        cursor.getString(5),
                        cursor.getString(6)
                ));
            }
        }
        return messages;
    }

    void markSent(List<MessageRecord> messages) {
        if (messages == null || messages.isEmpty()) return;
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            for (MessageRecord message : messages) {
                db.delete(TABLE, "device_message_id = ?", new String[]{message.deviceMessageId});
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    void markFailed(List<MessageRecord> messages, String error) {
        if (messages == null || messages.isEmpty()) return;
        SQLiteDatabase db = getWritableDatabase();
        ContentValues values = new ContentValues();
        values.put("last_error", error == null ? "unknown" : error);
        db.beginTransaction();
        try {
            for (MessageRecord message : messages) {
                db.execSQL(
                        "UPDATE " + TABLE + " SET attempt_count = attempt_count + 1, last_error = ? WHERE device_message_id = ?",
                        new Object[]{values.getAsString("last_error"), message.deviceMessageId}
                );
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    int countPending() {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM " + TABLE, null)) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().length() == 0;
    }
}
