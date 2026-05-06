import UIKit
import Capacitor
import WebKit

// Capacitor 8 SPM mode 의 in-app plugin 명시 등록 + WKWebView config 셋업.
// CAPBridgeViewController 그대로면 ObjC runtime 자동 발견이 안 돼 plugin 호출이 UNIMPLEMENTED 로 떨어진다.
// 참고: ionic-team/capacitor#7443.
class MainViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        // SPM mode 에서 main app target 의 in-app plugin 은 자동 등록되지 않으므로 명시 등록.
        // 방안 3 (#84): native libwebrtc + RTCAudioSession 통제 — 모든 통화 audio path 통합.
        bridge?.registerPluginInstance(WebRTCPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // iOS 18 WKWebView WebRTC 의 audio 자동재생 차단 회피.
        // 기본값은 .audio 등 일부 미디어가 사용자 인터랙션을 요구해 통화 진입 시 무음으로 떨어진다.
        // 참고: Apple Developer Forums #764453.
        if let webView = self.webView {
            webView.configuration.mediaTypesRequiringUserActionForPlayback = []
        }
    }
}
