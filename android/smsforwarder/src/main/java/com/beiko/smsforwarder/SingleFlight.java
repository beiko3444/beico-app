package com.beiko.smsforwarder;

final class SingleFlight {
    private boolean running = false;

    synchronized boolean tryStart() {
        if (running) return false;
        running = true;
        return true;
    }

    synchronized void finish() {
        running = false;
    }
}
