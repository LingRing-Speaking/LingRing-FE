import { Capacitor } from "@capacitor/core";
import { NativeWebRTC } from "./webrtcPlugin";

// 통화 오디오 라우팅. 정책: 이어피스 기본, 스피커는 명시 토글 시에만.
// iOS(#84 방안 3)·Android(#193) 모두 같은 WebRTC native plugin 이 라우팅을 소유하므로
// 플랫폼 구분 없이 "네이티브면 호출, 웹(dev)이면 no-op" 하나의 분기만 갖는다.
// - iOS: RTCAudioSession (WebRTCPlugin.swift)
// - Android: AudioManager MODE_IN_COMMUNICATION + setCommunicationDevice (WebRTCPlugin.java)

// 통화 connection 확립 시점 (onConnectionStateChange === "connected") 에 호출.
export async function configureCallAudioRoute(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NativeWebRTC.configureForCall();
}

// 스피커 라우팅 토글. on=false 는 이어피스(BT 연결 시 BT)로 복귀.
export async function setSpeakerphone(on: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NativeWebRTC.setSpeaker({ on });
}

// 통화 종료/cleanup 시 호출 — 오디오 세션/모드 복원.
export async function endCallAudioRoute(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await NativeWebRTC.endCall();
}
