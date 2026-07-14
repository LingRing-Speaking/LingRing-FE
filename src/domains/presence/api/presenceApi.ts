import { httpDelete, httpPost } from "@/lib/http";

// 온라인 상태 갱신(하트비트). 호출할 때마다 서버의 접속 TTL(10초)이 갱신된다.
// 포그라운드 동안 주기적으로 호출해 온라인을 유지한다.
export const sendHeartbeat = () => httpPost<void>("/me/presence");

// 명시적 오프라인 전환. 멱등(이미 오프라인이어도 204)이며 TTL 만료를 기다리지 않고 즉시 오프라인이 된다.
export const goOffline = () => httpDelete<void>("/me/presence");
