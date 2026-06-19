package com.beiko.smsforwarder;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.InputType;
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
    private EditText secretInput;
    private EditText usernameInput;
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

        TextView title = label("모든 문자 DB 저장", 28, 0xFF111827, true);
        title.setPadding(0, dp(6), 0, dp(4));
        root.addView(title);

        TextView description = label(
                "받은 SMS와 MMS 본문을 베이코 서버 DB에 저장합니다. 동기화를 켠 뒤에만 기존 문자와 새 문자를 전송합니다.",
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

        endpointInput = input("서버 API URL", SmsForwarder.getEndpoint(this), false);
        root.addView(label("서버 API URL", 13, 0xFF475467, true));
        root.addView(endpointInput, inputParams());

        secretInput = input("MOBILE_MESSAGE_INGEST_SECRET", SmsForwarder.getSecret(this), true);
        root.addView(label("수집 비밀키", 13, 0xFF475467, true));
        root.addView(secretInput, inputParams());

        usernameInput = input("베이코 로그인 사용자명", SmsForwarder.getUsername(this), false);
        root.addView(label("베이코 사용자명", 13, 0xFF475467, true));
        root.addView(usernameInput, inputParams());

        Button saveButton = actionButton("설정 저장", 0xFF111827);
        saveButton.setOnClickListener(view -> {
            saveInputs();
            toast("저장 완료");
            refreshStatus();
        });
        root.addView(saveButton, buttonParams());

        Button permissionButton = actionButton("SMS/MMS 권한 허용", 0xFFEE341B);
        permissionButton.setOnClickListener(view -> requestSmsPermission());
        root.addView(permissionButton, buttonParams());

        Button enableButton = actionButton("동기화 켜고 기존 문자 가져오기", 0xFF0F766E);
        enableButton.setOnClickListener(view -> enableSyncAndImport());
        root.addView(enableButton, buttonParams());

        Button retryButton = actionButton("대기 문자 재전송", 0xFF475467);
        retryButton.setOnClickListener(view -> {
            saveInputs();
            SmsForwarder.setEnabled(this, true);
            SmsForwarder.retryPending(this);
            toast("재전송을 시작했습니다.");
            refreshStatus();
        });
        root.addView(retryButton, buttonParams());

        Button testButton = actionButton("테스트 전송", 0xFF2563EB);
        testButton.setOnClickListener(view -> {
            saveInputs();
            SmsForwarder.sendTest(this, message -> runOnUiThread(() -> {
                toast(message);
                refreshStatus();
            }));
            toast("테스트 전송 중...");
        });
        root.addView(testButton, buttonParams());

        Button disableButton = actionButton("동기화 끄기", 0xFF991B1B);
        disableButton.setOnClickListener(view -> {
            SmsForwarder.setEnabled(this, false);
            toast("동기화를 중지했습니다.");
            refreshStatus();
        });
        root.addView(disableButton, buttonParams());

        TextView note = label(
                "주의: 모든 받은 문자 본문이 서버에 저장됩니다. MMS 첨부파일은 제외하고 텍스트만 저장합니다.",
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

    private void enableSyncAndImport() {
        saveInputs();
        if (!hasSmsPermissions()) {
            requestSmsPermission();
            toast("권한 허용 후 다시 눌러주세요.");
            return;
        }
        if (isBlank(SmsForwarder.getSecret(this)) || isBlank(SmsForwarder.getUsername(this))) {
            toast("비밀키와 사용자명을 입력하세요.");
            return;
        }

        SmsForwarder.setEnabled(this, true);
        SmsSync.importExistingAsync(this, message -> runOnUiThread(() -> {
            toast(message);
            refreshStatus();
        }));
        toast("기존 문자 가져오기를 시작했습니다.");
        refreshStatus();
    }

    private void saveInputs() {
        SmsForwarder.saveEndpoint(this, endpointInput.getText().toString());
        SmsForwarder.saveSecret(this, secretInput.getText().toString());
        SmsForwarder.saveUsername(this, usernameInput.getText().toString());
    }

    private void refreshStatus() {
        boolean granted = hasSmsPermissions();
        boolean enabled = SmsForwarder.isEnabled(this);
        permissionStatus.setText(granted
                ? (enabled ? "권한 허용됨 · 동기화 켜짐" : "권한 허용됨 · 동기화 꺼짐")
                : "SMS/MMS 권한 필요 · 버튼을 눌러 허용하세요");
        permissionStatus.setTextColor(granted && enabled ? 0xFF027A48 : 0xFFB42318);
        permissionStatus.setBackgroundColor(granted && enabled ? 0xFFECFDF3 : 0xFFFFF1F1);
        if (lastStatus != null) {
            lastStatus.setText("마지막 상태\n"
                    + SmsForwarder.getLastStatus(this)
                    + "\n\n대기 큐: " + SmsForwarder.getPendingCount(this) + "건");
        }
    }

    private void requestSmsPermission() {
        if (hasSmsPermissions()) {
            toast("이미 권한이 허용되어 있습니다.");
            return;
        }
        requestPermissions(
                new String[]{
                        Manifest.permission.READ_SMS,
                        Manifest.permission.RECEIVE_SMS,
                        Manifest.permission.RECEIVE_MMS,
                        Manifest.permission.RECEIVE_WAP_PUSH
                },
                SMS_PERMISSION_REQUEST
        );
    }

    private boolean hasSmsPermissions() {
        return checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.RECEIVE_MMS) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.RECEIVE_WAP_PUSH) == PackageManager.PERMISSION_GRANTED;
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

    private EditText input(String hint, String value, boolean password) {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint(hint);
        input.setText(value);
        input.setTextSize(15);
        input.setSelectAllOnFocus(true);
        input.setPadding(dp(14), 0, dp(14), 0);
        input.setBackgroundColor(0xFFF8FAFC);
        if (password) {
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        }
        return input;
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

    private LinearLayout.LayoutParams inputParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(54)
        );
        params.setMargins(0, dp(8), 0, dp(14));
        return params;
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

    private boolean isBlank(String value) {
        return value == null || value.trim().length() == 0;
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
