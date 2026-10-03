package com.lingring.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 기기의 앱 설정 화면을 연다. 알림 권한을 거절하면 OS 가 팝업을 다시 띄우지 않으므로
 * 유저가 직접 켤 수 있게 설정 화면으로 보낸다 (JS: src/domains/push/notificationSettings.ts).
 * iOS 는 웹뷰 링크(app-settings:)로 열리므로 이 플러그인은 Android 전용이다.
 */
@CapacitorPlugin(name = "AppSettings")
public class AppSettingsPlugin extends Plugin {

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        String packageName = getContext().getPackageName();
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Android 8+ : 앱 알림 설정 화면으로 바로 이동.
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, packageName);
        } else {
            // Android 7 이하에는 앱 알림 설정 화면이 없어 앱 정보 화면으로 보낸다.
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("앱 설정 화면을 열지 못했습니다.", e);
        }
    }
}
