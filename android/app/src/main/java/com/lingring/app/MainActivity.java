package com.lingring.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.kakao.sdk.common.KakaoSdk;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 커스텀 플러그인은 super.onCreate (bridge 초기화) 전에 등록해야 한다
        registerPlugin(WebRTCPlugin.class);
        super.onCreate(savedInstanceState);
        KakaoSdk.init(this, getString(R.string.kakao_app_key));
    }
}
