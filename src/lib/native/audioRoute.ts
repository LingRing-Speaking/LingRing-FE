import { isIosNative, NativeWebRTC } from "./webrtcPlugin";

// 방안 3 (#84): audio routing 은 native libwebrtc 의 RTCAudioSession 으로 통제.
// 기존 AudioRoute plugin (방안 1/2 의 AVAudioSession 직접 통제) 은 Phase 6 에서 제거 예정.
// 이 모듈의 시그니처는 그대로 유지해서 useCallSession.ts 변경을 minimum 으로.

// 통화 connection 확립 시점 (onConnectionStateChange === "connected") 에 호출.
// RTCAudioSession 의 카테고리/모드/옵션 + setActive(true) + isAudioEnabled=true 를 일괄 수행.
// 웹/Android 환경에서는 no-op.
export async function configureCallAudioRoute(): Promise<void> {
  if (!isIosNative()) return;
  await NativeWebRTC.configureForCall();
}

// 스피커 라우팅 토글. iOS 만 활성, 웹/Android no-op.
// RTCAudioSession.overrideOutputAudioPort 호출. on=false 시 .none → mode .voiceChat default = Receiver.
export async function setSpeakerphone(on: boolean): Promise<void> {
  if (!isIosNative()) return;
  await NativeWebRTC.setSpeaker({ on });
}

// 통화 종료/cleanup 시 호출. isAudioEnabled=false + setActive(false). 웹/Android no-op.
export async function endCallAudioRoute(): Promise<void> {
  if (!isIosNative()) return;
  await NativeWebRTC.endCall();
}
