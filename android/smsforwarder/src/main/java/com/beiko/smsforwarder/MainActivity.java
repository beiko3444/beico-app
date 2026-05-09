package com.beiko.smsforwarder;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int SMS_PERMISSION_REQUEST = 3444;
    private EditText endpointInput;
    private TextView permissionStatus;
    private TextView lastStatus;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildUi();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_REQUEST) {
            refreshStatus();
        }
    }

    private void buildUi() {
        int padding = dp(22);
        ScrollView scrollView = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(padding, padding, padding, padding);
        root.setBackgroundColor(Color.WHITE);
        scrollView.addView(root);

        TextView eyebrow = label("BEIKO SMS", 13, 0xFFEE341B, true);
        eyebrow.setLetterSpacing(0.18f);
        root.addView(eyebrow);

        TextView title = label("입금 문자 자동전송", 28, 0xFF111827, true);
        title.setPadding(0, dp(6), 0, dp(4));
        root.addView(title);

        TextView description = label(
                "문자가 오면 라즈베리파이로 자동 전송하고, 베이코앱 주문 금액과 자동 매칭합니다.",
                15,
                0xFF667085,
                false
        );
        description.setLineSpacing(dp(2), 1.0f);
        root.addView(description);

        permissionStatus = pill();
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        pillParams.setMargins(0, dp(22), 0, dp(14));
        root.addView(permissionStatus, pillParams);

        TextView endpointLabel = label("라즈베리파이 수신 URL", 13, 0xFF475467, true);
        root.addView(endpointLabel);

        endpointInput = new EditText(this);
        endpointInput.setSingleLine(true);
        endpointInput.setText(SmsForwarder.getEndpoint(this));
        endpointInput.setTextSize(15);
        endpointInput.setSelectAllOnFocus(true);
        endpointInput.setPadding(dp(14), 0, dp(14), 0);
        endpointInput.setBackgroundColor(0xFFF8FAFC);
        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(54)
        );
        inputParams.setMargins(0, dp(8), 0, dp(14));
        root.addView(endpointInput, inputParams);

        Button saveButton = actionButton("URL 저장", 0xFF111827);
        saveButton.setOnClickListener(view -> {
            SmsForwarder.saveEndpoint(this, endpointInput.getText().toString());
            toast("저장 완료");
            refreshStatus();
        });
        root.addView(saveButton, buttonParams());

        Button permissionButton = actionButton("SMS 권한 허용", 0xFFEE341B);
        permissionButton.setOnClickListener(view -> requestSmsPermission());
        root.addView(permissionButton, buttonParams());

        Button testButton = actionButton("테스트 전송", 0xFF0F766E);
        testButton.setOnClickListener(view -> {
            SmsForwarder.sendTest(this, message -> runOnUiThread(() -> {
                toast(message);
                refreshStatus();
            }));
            toast("테스트 전송 중...");
        });
        root.addView(testButton, buttonParams());

        TextView note = label(
                "주의: 테스트 전송은 베이코앱에 테스트 문자 1건을 저장합니다. 실제 입금확인 매칭은 입금 키워드와 주문 금액이 정확히 맞을 때만 처리됩니다.",
                13,
                0xFF667085,
                false
        );
        note.setPadding(0, dp(16), 0, dp(8));
        note.setLineSpacing(dp(2), 1.0f);
        root.addView(note);

        lastStatus = label("", 14, 0xFF101828, true);
        lastStatus.setPadding(dp(14), dp(14), dp(14), dp(14));
        lastStatus.setBackgroundColor(0xFFF2F4F7);
        root.addView(lastStatus, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        setContentView(scrollView);
        refreshStatus();
    }

    private void refreshStatus() {
        boolean granted = hasSmsPermission();
        permissionStatus.setText(granted ? "SMS 권한 허용됨 · 자동전송 대기중" : "SMS 권한 필요 · 버튼을 눌러 허용하세요");
        permissionStatus.setTextColor(granted ? 0xFF027A48 : 0xFFB42318);
        permissionStatus.setBackgroundColor(granted ? 0xFFECFDF3 : 0xFFFFF1F1);
        if (lastStatus != null) {
            lastStatus.setText("마지막 상태\n" + SmsForwarder.getLastStatus(this));
        }
    }

    private void requestSmsPermission() {
        if (hasSmsPermission()) {
            toast("이미 권한이 허용되어 있습니다.");
            return;
        }
        requestPermissions(
                new String[]{Manifest.permission.RECEIVE_SMS},
                SMS_PERMISSION_REQUEST
        );
    }

    private boolean hasSmsPermission() {
        return checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    private TextView label(String text, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private TextView pill() {
        TextView view = label("", 14, 0xFF027A48, true);
        view.setGravity(Gravity.CENTER_VERTICAL);
        view.setPadding(dp(16), 0, dp(16), 0);
        return view;
    }

    private Button actionButton(String text, int color) {
        Button button = new Button(this);
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(16);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setBackgroundColor(color);
        return button;
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(52)
        );
        params.setMargins(0, dp(8), 0, 0);
        return params;
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
