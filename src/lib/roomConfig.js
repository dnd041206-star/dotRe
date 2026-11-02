// 홈(MyRoom)과 방꾸미기(RoomEditPage)의 공통 좌표계 설정.
// 한쪽만 바꾸면 아이템 위치가 어긋나므로 반드시 이 파일에서만 수정할 것.
export const ITEM_SIZE = 0.22               // 아이템 기본 크기 (방 너비 대비)
export const FURN_SIZE = 0.3                // 가구 기본 크기
export const DEFAULT_ROOM_BG = '/assets/room/RoomBase.png'
// 아바타 — 홈 방 안의 고정 위치/크기 (0~1, 방 너비·높이 대비)
export const AVATAR_SIZE = 0.32
export const AVATAR_POS  = { x: 0.5, y: 0.78 }
export const AVATAR_Z    = 5