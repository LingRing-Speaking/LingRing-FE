package com.lingring.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

// #55: 통화 중 마이크형 foreground service. 이게 있어야 백그라운드에서
// ① cached-app freezer/Doze 에 의한 프로세스 동결(→ 소켓 사망 → 통화 종료)이 면제되고
// ② Android 11+ 의 백그라운드 마이크 무음화가 해제된다.
// 수명은 WebRTCPlugin 이 소유: doStart 에서 시작, 마지막 peer close 에서 중지.
public class CallForegroundService extends Service {

    private static final String CHANNEL_ID = "call";
    private static final int NOTIFICATION_ID = 1001;

    static void start(final Context context) {
        context.startForegroundService(new Intent(context, CallForegroundService.class));
    }

    static void stop(final Context context) {
        context.stopService(new Intent(context, CallForegroundService.class));
    }

    @Override
    public int onStartCommand(final Intent intent, final int flags, final int startId) {
        createChannel();
        final Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        // 시스템에 의해 재시작될 이유가 없다 — 통화 수명은 앱 프로세스와 함께 간다
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(final Intent intent) {
        return null;
    }

    private void createChannel() {
        final NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "통화", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("통화 중 상태 표시");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        final Intent launch = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        final PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launch, PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("LingRing 통화 중")
                .setContentText("영어 회화가 진행 중이에요")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .build();
    }
}
