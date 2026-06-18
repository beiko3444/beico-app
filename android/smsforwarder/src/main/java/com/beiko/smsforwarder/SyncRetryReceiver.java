package com.beiko.smsforwarder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class SyncRetryReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!SmsForwarder.isEnabled(context)) return;
        SmsForwarder.retryPending(context.getApplicationContext());
    }
}
