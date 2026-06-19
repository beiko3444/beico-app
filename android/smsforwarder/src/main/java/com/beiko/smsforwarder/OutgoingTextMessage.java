package com.beiko.smsforwarder;

final class OutgoingTextMessage {
    final String id;
    final String toName;
    final String toNumber;
    final String body;

    OutgoingTextMessage(String id, String toName, String toNumber, String body) {
        this.id = id;
        this.toName = toName;
        this.toNumber = toNumber;
        this.body = body;
    }
}
