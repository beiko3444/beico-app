package com.beiko.smsforwarder;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class SingleFlightTest {
    @Test
    public void rejectsSecondStartUntilFinished() {
        SingleFlight singleFlight = new SingleFlight();

        assertTrue(singleFlight.tryStart());
        assertFalse(singleFlight.tryStart());

        singleFlight.finish();

        assertTrue(singleFlight.tryStart());
    }
}
