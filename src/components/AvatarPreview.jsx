/** 쌓는 순서(아래→위): 의상 → 헤어 → 얼굴
 *  얼굴(눈)이 항상 맨 위에 와서 앞머리에 가려지지 않게 함.
 *  탭 순서(얼굴/헤어/의상)랑은 별개라 avatar.js의 AVATAR_CATEGORY_KEYS는 안 건드려도 됨 */
const LAYER_ORDER = ['outfit', 'hair', 'face']

export default function AvatarPreview({ equipped, items, className = '' }) {
  const findImage = (category) => {
    const id = equipped?.[category]
    if (!id) return null
    return items?.find((p) => p.id === id)?.image_url ?? null
  }

  return (
    <div className={`relative aspect-square ${className}`}>
      <img
        src="/assets/char/CharacterBase.png"
        alt=""
        className="pixel absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />

      {LAYER_ORDER.map((category) => {
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