import Foundation
import Capacitor
import AVFoundation

// 음성 통화 중 출력 라우팅 토글용 in-app Capacitor 플러그인.
// JS 측 src/lib/native/audioRoute.ts 의 registerPlugin("AudioRoute") 와 매핑된다.
//
// `on=true` 이면 스피커폰으로 강제 라우팅, `on=false` 이면 기본 라우팅(이어피스 또는 BT 헤드셋).
@objc(AudioRoutePlugin)
public class AudioRoutePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioRoutePlugin"
    public let jsName = "AudioRoute"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setSpeaker", returnType: CAPPluginReturnPromise),
    ]

    @objc func setSpeaker(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(on ? .speaker : .none)
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }
}
