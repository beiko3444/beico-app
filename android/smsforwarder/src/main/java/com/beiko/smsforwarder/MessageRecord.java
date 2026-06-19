package com.beiko.smsforwarder;

final class MessageRecord {
    final String deviceMessageId;
    final String messageType;
    final String sender;
    final String senderName;
    final String body;
    final long receivedAtMillis;
    final String threadId;
    final String sourceDevice;

    MessageRecord(
            String deviceMessageId,
            String messageType,
            String sender,
            String senderName,
            String body,
            long receivedAtMillis,
            String threadId,
            String sourceDevice
    ) {
        this.deviceMessageId = deviceMessageId;
        this.messageType = messageType;
        this.sender = sender;
        this.senderName = senderName;
        this.body = body;
        this.receivedAtMillis = receivedAtMillis;
        this.threadId = threadId;
        this.sourceDevice = sourceDevice;
    }
}
