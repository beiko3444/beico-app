package com.beiko.smsforwarder;

import java.text.NumberFormat;
import java.util.Locale;

final class SyncProgress {
    final String stage;
    final int total;
    final int scanned;
    final int queued;
    final int sent;
    final int failed;
    final int pending;
    final String lastError;

    SyncProgress(
            String stage,
            int total,
            int scanned,
            int queued,
            int sent,
            int failed,
            int pending,
            String lastError
    ) {
        this.stage = clean(stage, "대기중");
        this.total = Math.max(0, total);
        this.scanned = Math.max(0, scanned);
        this.queued = Math.max(0, queued);
        this.sent = Math.max(0, sent);
        this.failed = Math.max(0, failed);
        this.pending = Math.max(0, pending);
        this.lastError = clean(lastError, "");
    }

    int percent() {
        if (total <= 0) return stage.equals("완료") ? 100 : 0;
        int completed = Math.max(0, scanned + sent + failed);
        return Math.max(0, Math.min(100, Math.round(completed * 100f / total)));
    }

    String summary() {
        NumberFormat format = NumberFormat.getIntegerInstance(Locale.KOREA);
        StringBuilder builder = new StringBuilder();
        builder.append("현재 단계: ").append(stage)
                .append("\n진행률 ").append(percent()).append("%");

        if (total > 0 || scanned > 0) {
            builder.append("\n스캔 ")
                    .append(format.format(scanned))
                    .append("/")
                    .append(format.format(total));
        }

        builder.append("\n큐 추가 ").append(format.format(queued)).append("건")
                .append(" · 전송성공 ").append(format.format(sent)).append("건")
                .append(" · 실패 ").append(format.format(failed)).append("건")
                .append("\n대기큐 ").append(format.format(pending)).append("건");

        if (lastError.length() > 0) {
            builder.append("\n마지막 오류: ").append(lastError);
        }

        return builder.toString();
    }

    private static String clean(String value, String fallback) {
        if (value == null || value.trim().length() == 0) return fallback;
        return value.trim();
    }
}
