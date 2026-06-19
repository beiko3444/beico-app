package com.beiko.smsforwarder;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

public class SyncProgressTest {
    @Test
    public void percentUsesCompletedWorkOverTotalWork() {
        SyncProgress progress = new SyncProgress(
                "전송중",
                100,
                10,
                20,
                7,
                3,
                17,
                "HTTP 401"
        );

        assertEquals(20, progress.percent());
        assertEquals("전송중", progress.stage);
        assertEquals(17, progress.pending);
    }

    @Test
    public void summaryShowsStageCountsAndLastError() {
        SyncProgress progress = new SyncProgress(
                "기존 문자 스캔중",
                5000,
                450,
                0,
                0,
                0,
                12,
                "Unauthorized"
        );

        String summary = progress.summary();

        assertTrue(summary.contains("현재 단계: 기존 문자 스캔중"));
        assertTrue(summary.contains("스캔 450/5,000"));
        assertTrue(summary.contains("대기큐 12건"));
        assertTrue(summary.contains("마지막 오류: Unauthorized"));
    }
}
