package com.lingring.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.kakao.sdk.common.KakaoSdk;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        KakaoSdk.init(this, getString(R.string.kakao_app_key));
        // #193 Phase 0 스파이크 — 판정 후 제거 (debug 빌드 한정)
        final boolean isDebuggable =
                (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (isDebuggable) {
            WebRtcSpike.scheduleRun(this);
        }
    }
}
