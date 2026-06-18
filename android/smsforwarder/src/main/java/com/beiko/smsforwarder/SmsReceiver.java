package com.beiko.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SmsForwarder.isEnabled(context)) return;

        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;

        StringBuilder body = new StringBuilder();
        String sender = "";
        long receivedAt = System.currentTimeMillis();
        for (SmsMessage sms : messages) {
            if (sms == null) continue;
            if (sender.length() == 0 && sms.getOriginatingAddress() != null) {
                sender = sms.getOriginatingAddress();
            }
            if (sms.getMessageBody() != null) {
                body.append(sms.getMessageBody());
            }
            if (sms.getTimestampMillis() > 0) {
                receivedAt = sms.getTimestampMillis();
            }
        }

        if (body.length() == 0) return;
        MessageRecord record = SmsForwarder.buildMessage(
                context.getApplicationContext(),
                SmsForwarder.createFallbackMessageId("SMS", sender, body.toString(), receivedAt),
                "SMS",
                sender,
                body.toString(),
                receivedAt,
                ""
        );
        SmsForwarder.enqueueAndRetry(context.getApplicationContext(), record);
    }
}
