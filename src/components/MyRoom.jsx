import { ITEM_SIZE as SIZE, FURN_SIZE, DEFAULT_ROOM_BG,
         AVATAR_SIZE, AVATAR_POS, AVATAR_Z } from '../lib/roomConfig'
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getPlacedItems, getPlacedFurniture } from '../lib/roomService'
import { getAvatar } from '../lib/api'
import AvatarPreview from './AvatarPreview'

export default function MyRoom({ className = '' }) {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [furniture, setFurniture] = useState([])
  const [avatar, setAvatar] = useState(null)

  useEffect(() => {
    const id = session?.user?.id
    if (!id) return
    getPlacedItems(id).then(setItems).catch(console.error)
    getPlacedFurniture(id).then(setFurniture).catch(console.error)
    getAvatar().then(setAvatar).catch(console.error)
  }, [session])

  const bgRow = furniture.find((r) => r.furniture_catalog?.category === 'background')
  const roomBg = bgRow?.furniture_catalog?.image_url || DEFAULT_ROOM_BG

  const all = [
    ...items.map((r) => ({ ...r, key: `i-${r.id}`, image: r.items.image_url, name: r.items.name, size: SIZE })),
    ...furniture
      .filter((r) => r.furniture_catalog?.category !== 'background')
      .map((r) => ({ ...r, key: `f-${r.id}`, image: r.furniture_catalog?.image_url, name: r.furniture_catalog?.name, size: FURN_SIZE })),
  ]

  return (
    <div className={`relative aspect-square overflow-hidden ${className}`}>
      <img
        src={roomBg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ zIndex: 0 }}
        draggable={false}
      />

      {all.map((r) => (
        <img key={r.key} src={r.image} alt={r.name}
             className="pixel absolute"
             style={{
               left: `${(r.x ?? 0.5) * 100}%`,
               top: `${(r.y ?? 0.5) * 100}%`,
               width: `${r.size * (r.scale ?? 1) * 100}%`,
               zIndex: r.z ?? 0,
               transform: `translate(-50%, -50%) scaleX(${r.flipped ? -1 : 1})`,
             }} />
      ))}
      
      {/* 아바타 — 방 안 고정 위치 */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: `${AVATAR_POS.x * 100}%`,
          top: `${AVATAR_POS.y * 100}%`,
          width: `${AVATAR_SIZE * 100}%`,
          zIndex: AVATAR_Z,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <AvatarPreview equipped={avatar?.equipped} items={avatar?.items} className="w-full" />
      </div>



    </div>
  )
}