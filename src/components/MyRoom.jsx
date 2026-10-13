import { ITEM_SIZE as SIZE, FURN_SIZE, DEFAULT_ROOM_BG } from '../lib/roomConfig'
import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getPlacedItems, getPlacedFurniture } from '../lib/roomService'

const AVATAR_SIZE = 0.32

export default function MyRoom({ className = '', background }) {
  const { session } = useAuth()
  const [items, setItems] = useState([])
  const [furniture, setFurniture] = useState([])

  useEffect(() => {
    const id = session?.user?.id
    if (!id) return
    getPlacedItems(id).then(setItems).catch(console.error)
    getPlacedFurniture(id).then(setFurniture).catch(console.error)
  }, [session])

  const all = [
    ...items.map((r) => ({ ...r, key: `i-${r.id}`, image: r.items.image_url, name: r.items.name, size: SIZE })),
    ...furniture.map((r) => ({ ...r, key: `f-${r.id}`, image: r.furniture_catalog?.image_url, name: r.furniture_catalog?.name, size: FURN_SIZE })),
  ]
 
  return (
    <div className={`relative aspect-square w-full overflow-hidden ${className}`}>
      {/* ▼ 방 배경 — 구매 배경(background) 있으면 그걸, 없으면 기본 배경 */}
      <img
        src={background || DEFAULT_ROOM_BG}
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
    </div>
  )
}