package com.beiko.mobile;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    public static final String PREFS = "beiko_mobile";
    public static final String KEY_SERVER_URL = "server_url";
    public static final String KEY_SECRET = "secret";
    public static final String KEY_FCM_TOKEN = "fcm_token";
    public static final String DEFAULT_SERVER_URL = "https://www.beiko.co.kr";

    private LinearLayout content;
    private TextView status;
    private EditText serverUrlInput;
    private EditText secretInput;
    private EditText smsNumberInput;
    private EditText smsBodyInput;
    private LinearLayout conversationList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestRuntimePermissions();
        buildLayout();
        loadAlertTab();
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                setStatus("FCM 토큰을 가져오지 못했습니다: " + safeError(task.getException()));
                return;
            }
            String token = task.getResult();
            getPrefs(this).edit().putString(KEY_FCM_TOKEN, token).apply();
            setStatus("FCM 토큰 준비됨. 알림 등록을 눌러 서버에 연결하세요.");
            registerTokenInBackground(this, token);
        });
    }

    private void buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(246, 248, 251));
        setContentView(root);

        TextView title = new TextView(this);
        title.setText("BEIKO Mobile");
        title.setTextColor(Color.rgb(11, 18, 32));
        title.setTextSize(24);
        title.setGravity(Gravity.CENTER_VERTICAL);
        title.setPadding(dp(18), dp(18), dp(18), dp(8));
        title.setTypeface(null, 1);
        root.addView(title, new LinearLayout.LayoutParams(-1, dp(62)));

        LinearLayout tabs = new LinearLayout(this);
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        tabs.setPadding(dp(12), 0, dp(12), dp(8));
        root.addView(tabs, new LinearLayout.LayoutParams(-1, dp(56)));

        Button alertsTab = tabButton("알림");
        Button smsTab = tabButton("문자");
        tabs.addView(alertsTab, new LinearLayout.LayoutParams(0, -1, 1));
        tabs.addView(smsTab, new LinearLayout.LayoutParams(0, -1, 1));
        alertsTab.setOnClickListener(v -> loadAlertTab());
        smsTab.setOnClickListener(v -> loadSmsTab());

        status = new TextView(this);
        status.setTextColor(Color.rgb(82, 95, 120));
        status.setTextSize(12);
        status.setPadding(dp(18), 0, dp(18), dp(8));
        root.addView(status, new LinearLayout.LayoutParams(-1, dp(42)));

        ScrollView scroll = new ScrollView(this);
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(16), dp(8), dp(16), dp(24));
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    }

    private void loadAlertTab() {
        content.removeAllViews();
        SharedPreferences prefs = getPrefs(this);

        addSectionTitle("알림 앱 등록");
        addText("이 기기를 신규 주문, 문자 수신, 입금문자 매칭 알림 수신 기기로 등록합니다.");

        serverUrlInput = input("서버 주소", prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL), InputType.TYPE_CLASS_TEXT);
        secretInput = input("등록 시크릿", prefs.getString(KEY_SECRET, ""), InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        content.addView(serverUrlInput);
        content.addView(secretInput);

        Button save = primaryButton("저장하고 알림 등록");
        save.setOnClickListener(v -> {
            String serverUrl = normalizeServerUrl(serverUrlInput.getText().toString());
            String secret = secretInput.getText().toString().trim();
            getPrefs(this).edit()
                    .putString(KEY_SERVER_URL, serverUrl)
                    .putString(KEY_SECRET, secret)
                    .apply();
            String token = getPrefs(this).getString(KEY_FCM_TOKEN, "");
            if (token == null || token.length() == 0) {
                setStatus("FCM 토큰이 아직 없습니다. 잠시 후 다시 눌러주세요.");
                return;
            }
            registerTokenInBackground(this, token);
            setStatus("알림 등록 요청을 보냈습니다.");
        });
        content.addView(save);
    }

    private void loadSmsTab() {
        content.removeAllViews();
        addSectionTitle("문자 대화");
        addText("번호를 입력하고 대화를 불러온 뒤, 같은 화면에서 문자를 보냅니다.");

        smsNumberInput = input("전화번호", "", InputType.TYPE_CLASS_PHONE);
        smsBodyInput = input("문자 내용", "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        smsBodyInput.setMinLines(3);
        smsBodyInput.setGravity(Gravity.TOP | Gravity.START);
        content.addView(smsNumberInput);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        Button load = secondaryButton("대화 불러오기");
        Button send = primaryButton("전송");
        actions.addView(load, new LinearLayout.LayoutParams(0, dp(48), 1));
        actions.addView(send, new LinearLayout.LayoutParams(0, dp(48), 1));
        content.addView(actions);

        conversationList = new LinearLayout(this);
        conversationList.setOrientation(LinearLayout.VERTICAL);
        conversationList.setPadding(0, dp(12), 0, dp(12));
        content.addView(conversationList);

        content.addView(smsBodyInput);

        load.setOnClickListener(v -> loadConversation());
        send.setOnClickListener(v -> sendSms());
    }

    private void loadConversation() {
        String target = normalizeDigits(smsNumberInput.getText().toString());
        conversationList.removeAllViews();
        if (target.length() == 0) {
            setStatus("대화를 불러올 번호를 입력하세요.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            setStatus("READ_SMS 권한이 필요합니다.");
            requestRuntimePermissions();
            return;
        }

        Uri uri = Telephony.Sms.CONTENT_URI;
        String[] projection = new String[]{
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
        };
        int shown = 0;
        try (Cursor cursor = getContentResolver().query(uri, projection, null, null, Telephony.Sms.DATE + " DESC")) {
            if (cursor == null) return;
            ArrayList<SmsRow> rows = new ArrayList<>();
            while (cursor.moveToNext() && rows.size() < 80) {
                String address = cursor.getString(0);
                if (!normalizeDigits(address).endsWith(target) && !target.endsWith(normalizeDigits(address))) continue;
                rows.add(new SmsRow(address, cursor.getString(1), cursor.getLong(2), cursor.getInt(3)));
            }
            for (int i = rows.size() - 1; i >= 0; i--) {
                SmsRow row = rows.get(i);
                addBubble(row.body, row.date, row.type == Telephony.Sms.MESSAGE_TYPE_SENT);
                shown++;
            }
        } catch (Exception error) {
            setStatus("대화 불러오기 실패: " + safeError(error));
            return;
        }
        if (shown == 0) addText("표시할 대화가 없습니다.");
        setStatus("대화 " + shown + "건을 불러왔습니다.");
    }

    private void sendSms() {
        String toNumber = normalizeDigits(smsNumberInput.getText().toString());
        String body = smsBodyInput.getText().toString().trim();
        if (toNumber.length() == 0 || body.length() == 0) {
            setStatus("전화번호와 문자 내용을 입력하세요.");
            return;
        }
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            setStatus("SEND_SMS 권한이 필요합니다.");
            requestRuntimePermissions();
            return;
        }

        try {
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(body);
            smsManager.sendMultipartTextMessage(toNumber, null, parts, null, null);
            addBubble(body, System.currentTimeMillis(), true);
            smsBodyInput.setText("");
            setStatus("문자를 전송했습니다.");
        } catch (Exception error) {
            setStatus("문자 전송 실패: " + safeError(error));
        }
    }

    public static void registerTokenInBackground(Context context, String token) {
        SharedPreferences prefs = getPrefs(context);
        String secret = prefs.getString(KEY_SECRET, "");
        if (secret == null || secret.trim().length() == 0 || token == null || token.trim().length() == 0) return;

        String serverUrl = normalizeServerUrl(prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL));
        new Thread(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("token", token);
                body.put("platform", "android");
                body.put("deviceName", Build.MODEL == null ? "Android" : Build.MODEL);
                postJson(serverUrl + "/api/admin/alert-device/register", secret, "x-alert-app-secret", body);
            } catch (Exception ignored) {
            }
        }).start();
    }

    private static String postJson(String url, String secret, String secretHeader, JSONObject body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(12000);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setRequestProperty("Authorization", "Bearer " + secret);
            connection.setRequestProperty(secretHeader, secret);
            connection.setDoOutput(true);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bytes);
            }
            int code = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 400 ? connection.getErrorStream() : connection.getInputStream(),
                    StandardCharsets.UTF_8
            ));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) response.append(line);
            if (code < 200 || code >= 300) throw new Exception("HTTP " + code + ": " + response);
            return response.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT < 23) return;
        ArrayList<String> permissions = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.READ_SMS);
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) permissions.add(Manifest.permission.SEND_SMS);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!permissions.isEmpty()) requestPermissions(permissions.toArray(new String[0]), 10);
    }

    private void addBubble(String body, long date, boolean sent) {
        TextView bubble = new TextView(this);
        String time = new SimpleDateFormat("MM/dd HH:mm", Locale.KOREA).format(new Date(date));
        bubble.setText(body + "\n" + time);
        bubble.setTextSize(14);
        bubble.setTextColor(sent ? Color.WHITE : Color.rgb(15, 23, 42));
        bubble.setBackgroundColor(sent ? Color.rgb(239, 59, 45) : Color.WHITE);
        bubble.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-2, -2);
        params.setMargins(sent ? dp(56) : 0, dp(4), sent ? 0 : dp(56), dp(4));
        params.gravity = sent ? Gravity.RIGHT : Gravity.LEFT;
        conversationList.addView(bubble, params);
    }

    private void addSectionTitle(String value) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(18);
        view.setTypeface(null, 1);
        view.setTextColor(Color.rgb(11, 18, 32));
        view.setPadding(0, dp(8), 0, dp(8));
        content.addView(view);
    }

    private void addText(String value) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(13);
        view.setTextColor(Color.rgb(82, 95, 120));
        view.setPadding(0, dp(4), 0, dp(12));
        content.addView(view);
    }

    private EditText input(String hint, String value, int inputType) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setText(value);
        editText.setTextSize(15);
        editText.setSingleLine((inputType & InputType.TYPE_TEXT_FLAG_MULTI_LINE) == 0);
        editText.setInputType(inputType);
        editText.setPadding(dp(12), 0, dp(12), 0);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(54));
        params.setMargins(0, dp(6), 0, dp(8));
        editText.setLayoutParams(params);
        return editText;
    }

    private Button tabButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        return button;
    }

    private Button primaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(Color.WHITE);
        button.setBackgroundColor(Color.rgb(239, 59, 45));
        return button;
    }

    private Button secondaryButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        return button;
    }

    private void setStatus(String value) {
        runOnUiThread(() -> status.setText(value));
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private static String normalizeServerUrl(String value) {
        String text = value == null ? "" : value.trim();
        if (text.length() == 0) text = DEFAULT_SERVER_URL;
        while (text.endsWith("/")) text = text.substring(0, text.length() - 1);
        return text;
    }

    private static String normalizeDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private static String safeError(Exception error) {
        if (error == null) return "unknown";
        String message = error.getMessage();
        return message == null || message.trim().length() == 0 ? error.getClass().getSimpleName() : message;
    }

    private static class SmsRow {
        final String address;
        final String body;
        final long date;
        final int type;

        SmsRow(String address, String body, long date, int type) {
            this.address = address;
            this.body = body == null ? "" : body;
            this.date = date;
            this.type = type;
        }
    }
}
