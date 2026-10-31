import { AVATAR_CATEGORY_KEYS } from '../game/avatar'

/** 겹치는 순서 = AVATAR_CATEGORY_KEYS 순서 (얼굴 → 헤어 → 의상).
 *  실제로 겹쳐보고 순서가 이상하면(예: 의상이 헤어를 가려야 하는 경우)
 *  avatar.js의 AVATAR_CATEGORY_KEYS 배열 순서를 바꾸면 여기도 같이 바뀜 */
export default function AvatarPreview({ equipped, items, className = '' }) {
  const findImage = (category) => {
    const id = equipped?.[category]
    if (!id) return null
    return items?.find((p) => p.id === id)?.image_url ?? null
  }

  return (
    <div className={`relative aspect-square w-full ${className}`}>
      {/* 베이스 캐릭터 */}
      <img
        src="/assets/char/CharacterBase.png"
        alt=""
        className="pixel absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />

      {/* 장착된 파츠 — 카테고리 순서대로 겹치기 */}
      {AVATAR_CATEGORY_KEYS.map((category) => {
        const url = findImage(category)
        if (!url) return null
        return (
          <img
            key={category}
            src={url}
            alt=""
            className="pixel absolute inset-0 h-full w-full select-none object-contain"
            draggable={false}
          />
        )
      })}
    </div>
  )
}