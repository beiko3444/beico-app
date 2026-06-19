package com.beiko.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;

public class MmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SmsForwarder.isEnabled(context)) return;
        if (!Telephony.Sms.Intents.WAP_PUSH_RECEIVED_ACTION.equals(intent.getAction())) return;
        PendingResult pendingResult = goAsync();
        Context appContext = context.getApplicationContext();
        new Thread(() -> {
            try {
                SmsSync.importRecentMms(appContext);
            } finally {
                pendingResult.finish();
            }
        }).start();
    }
}
