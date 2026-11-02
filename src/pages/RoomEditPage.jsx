import { ITEM_SIZE as SIZE, FURN_SIZE, DEFAULT_ROOM_BG } from '../lib/roomConfig'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getRoomItems, saveRoomLayout, getRoomFurniture, saveFurnitureLayout } from '../lib/roomService'

const COLS = 5
const MIN_SLOTS = 10

export default function RoomEditPage() {
  const { session } = useAuth()
  const myId = session?.user.id
  const navigate = useNavigate()
  const roomRef = useRef(null)

  const [itemRows, setItemRows] = useState([])
  const [furnRows, setFurnRows] = useState([])
  const [dragId, setDragId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState('item')

  useEffect(() => {
    if (!myId) return
    getRoomItems(myId).then(setItemRows).catch(console.error)
    getRoomFurniture(myId).then(setFurnRows).catch(console.error)
  }, [myId])

  const rowsOf = (kind) => (kind === 'item' ? itemRows : furnRows)
  const setRowsOf = (kind) => (kind === 'item' ? setItemRows : setFurnRows)

  // 배경으로 적용된 가구 — 떠다니는 스프라이트 목록에서는 빼고, 방 바탕 이미지로만 씀
  const activeBg = furnRows.find((r) => r.placed && r.furniture_catalog?.category === 'background')
  const roomBg = activeBg?.furniture_catalog?.image_url || DEFAULT_ROOM_BG

  const placedAll = [
    ...itemRows.filter((r) => r.placed).map((r) => ({ ...r, kind: 'item', image: r.items.image_url, name: r.items.name, size: SIZE })),
    ...furnRows
      .filter((r) => r.placed && r.furniture_catalog?.category !== 'background')
      .map((r) => ({ ...r, kind: 'furniture', image: r.furniture_catalog?.image_url, name: r.furniture_catalog?.name, size: FURN_SIZE })),
  ]

  const storedItems = itemRows.filter((r) => !r.placed)
  const storedFurn = furnRows.filter((r) => !r.placed)

  const update = (kind, id, fields) => {
    setRowsOf(kind)((rs) => rs.map((r) => (r.id === id ? { ...r, ...fields } : r)))
    setDirty(true)
  }

  const toRatio = (e) => {
    const box = roomRef.current.getBoundingClientRect()
    return {
      x: Math.min(0.95, Math.max(0.05, (e.clientX - box.left) / box.width)),
      y: Math.min(0.95, Math.max(0.05, (e.clientY - box.top) / box.height)),
    }
  }

  const handleMove = (e) => {
    if (!dragId) return
    e.preventDefault()
    update(dragId.kind, dragId.id, toRatio(e))
  }

  const placeRow = (kind, row) => {
    const maxZ = Math.max(0, ...itemRows.map((r) => r.z ?? 0), ...furnRows.map((r) => r.z ?? 0))
    update(kind, row.id, { placed: true, x: 0.5, y: 0.5, z: maxZ + 1, scale: 1 })
    setSelected({ kind, id: row.id })
  }

  const DEFAULT_BG_ITEM = {
  id: '__default_bg__',
  __defaultBg: true,
  furniture_catalog: { name: '기본 배경', image_url: DEFAULT_ROOM_BG, category: 'background' },
}

const resetBackground = () => {
  setFurnRows((rows) => rows.map((r) =>
    r.furniture_catalog?.category === 'background' ? { ...r, placed: false } : r
  ))
  setDirty(true)
  setSelected(null)
}


  /** 배경 선택 — 좌표 없이, 고른 것만 placed:true로 두고 나머지 배경은 전부 false */
  const selectBackground = (row) => {
    setFurnRows((rows) => rows.map((r) => {
      if (r.furniture_catalog?.category !== 'background') return r
      return { ...r, placed: r.id === row.id }
    }))
    setDirty(true)
    setSelected(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all([saveRoomLayout(itemRows), saveFurnitureLayout(furnRows)])
      setDirty(false)
      alert('방을 저장했어요!')
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const sel = selected && rowsOf(selected.kind).find((r) => r.id === selected.id)

  const stored = tab === 'item' ? storedItems : [DEFAULT_BG_ITEM, ...storedFurn]
  const slotCount = Math.max(MIN_SLOTS, Math.ceil(stored.length / COLS) * COLS)
  const slots = Array.from({ length: slotCount }, (_, i) => stored[i] ?? null)

  const imgOf = (r) => (tab === 'item' ? r.items?.image_url : r.furniture_catalog?.image_url)
  const nameOf = (r) => (tab === 'item' ? r.items?.name : r.furniture_catalog?.name)

const handleSlotClick = (r) => {
  if (r.__defaultBg) {
    resetBackground()
    return
  }
  if (tab === 'furniture' && r.furniture_catalog?.category === 'background') {
    selectBackground(r)
  } else {
    placeRow(tab === 'item' ? 'item' : 'furniture', r)
  }
}

  return (
     <div className="no-scrollbar relative flex h-full flex-col overflow-y-auto px-[3%] py-[0%]">

      <div className="no-scrollbar relative flex h-full flex-col overflow-y-auto px-[4%] py-[3%]">

        {/* ── 헤더: 뒤로 / 방 편집 / 저장 ── */}
        <div className="flex flex-none items-center justify-between">
          <button onClick={() => navigate('/')} aria-label="홈으로" className="btn-icon w-[12%]">
            <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
          </button>

          <h2 className="mx-auto text-center flex-none translate-x-[12px] translate-y-[-5px] border-b-2 border-accent-2 pb-0.5 font-galmuri9 text-[26px] text-white text-outline"
          style={{ '--outline': '#ED2F89' }}>
          방 편집
          </h2>
          <button onClick={handleSave} disabled={!dirty || saving}
                  aria-label="저장" className="btn-icon w-[23%] disabled:opacity-40">
            <img src="/assets/ui/RoomSave.png" alt="저장" className="block w-full select-none" draggable={false} />
          </button>
        </div>

        {/* ── 방 ── */}
        <div ref={roomRef}
             onPointerMove={handleMove}
             onPointerUp={() => setDragId(null)}
             onPointerLeave={() => setDragId(null)}
             onPointerDown={(e) => { if (e.target === roomRef.current) setSelected(null) }}
             className="relative mt-[3%] aspect-square w-full flex-none touch-none overflow-hidden rounded-[14px]">
          <img src={roomBg} alt=""
               className="pointer-events-none absolute inset-0 h-full w-full object-cover"
               style={{ zIndex: 0 }} draggable={false} />

          {placedAll.map((r) => (
            <img key={`${r.kind}-${r.id}`}
                 src={r.image}
                 alt={r.name}
                 draggable={false}
                 onPointerDown={(e) => {
                   e.preventDefault()
                   e.currentTarget.setPointerCapture(e.pointerId)
                   setDragId({ kind: r.kind, id: r.id })
                   setSelected({ kind: r.kind, id: r.id })
                 }}
                 className={`pixel absolute cursor-move select-none
                   ${selected?.kind === r.kind && selected?.id === r.id ? 'ring-2 ring-accent' : ''}`}
                 style={{
                   left: `${(r.x ?? 0.5) * 100}%`,
                   top: `${(r.y ?? 0.5) * 100}%`,
                   width: `${r.size * (r.scale ?? 1) * 100}%`,
                   zIndex: r.z ?? 0,
                   transform: `translate(-50%, -50%) scaleX(${r.flipped ? -1 : 1})`,
                 }} />
          ))}

          {placedAll.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center font-galmuri11 text-[10px] text-ink-dim">
              아래 보관함에서 아이템·가구를 꺼내보세요
            </p>
          )}
        </div>

        {/* ── 선택한 물건 조작 ── */}
        {sel && (
          <div className="mt-[3%] flex-none rounded-[8px] border-2 border-border bg-white/80 p-2">
            <div className="flex items-center gap-2">

              <button onClick={() => update(selected.kind, sel.id, { flipped: !sel.flipped })}
                      className="translate-x-[39px] btn-icon rounded-[6px] border border-border px-4 py-1 font-galmuri9 text-[12px] text-ink"
                      style={{ backgroundColor: '#E1FF96' }}>
                좌우반전
              </button>
              <button onClick={() => {
                        const maxZ = Math.max(0, ...itemRows.map((r) => r.z ?? 0), ...furnRows.map((r) => r.z ?? 0))
                        update(selected.kind, sel.id, { z: maxZ + 1 })
                      }}
                      className="translate-x-[44px] btn-icon rounded-[6px] border border-border px-4 py-1 font-galmuri9 text-[12px] text-ink"
                      style={{ backgroundColor: '#E1FF96' }}>
                앞으로
              </button>
              <button onClick={() => { update(selected.kind, sel.id, { placed: false }); setSelected(null) }}
                      className="translate-x-[49px] btn-icon rounded-[6px] border border-border px-4 py-1 font-galmuri9 text-[12px] text-accent-2"
                      style={{ backgroundColor: '#E1FF96' }}>
                치우기
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="font-galmuri9 text-[12px] text-ink-dim">크기</span>
              <input type="range" min="0.4" max="2" step="0.05"
                     value={sel.scale ?? 1}
                     onChange={(e) => update(selected.kind, sel.id, { scale: Number(e.target.value) })}
                     className="flex-1" />
              <span className="w-10 text-right font-galmuri9 text-[12px] text-ink">
                {Math.round((sel.scale ?? 1) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* ── 보관함 목록 ── */}
        <div className="relative mt-[6%] flex-none">
          <img src="/assets/ui/RoomItemlist.png" alt=""
               className="block w-full select-none" draggable={false} />

          <div className="absolute inset-x-0 -top-[9%] mx-auto w-[62%]">
            <img src={tab === 'item' ? '/assets/ui/Room_ItemPick.png' : '/assets/ui/Room_InteriorPick.png'}
                 alt={tab === 'item' ? '아이템' : '인테리어'}
                 className="block w-full select-none" draggable={false} />
            <button onClick={() => setTab('item')} aria-label="아이템"
                    className="btn-icon absolute inset-y-0 left-0 w-1/2" />
            <button onClick={() => setTab('furniture')} aria-label="인테리어"
                    className="btn-icon absolute inset-y-0 right-0 w-1/2" />
          </div>

          <div className="no-scrollbar absolute inset-x-[3%] bottom-[4%] top-[11%] overflow-y-auto">
            <div className="grid grid-cols-5 gap-[2%]">
              {slots.map((r, i) =>
                r ? (
                  <button key={r.id}
                          onClick={() => handleSlotClick(r)}
                          aria-label={nameOf(r)}
                          className={`btn-icon flex aspect-square items-center justify-center rounded-[8px] border bg-white p-1 ${
                            r.__defaultBg && !activeBg ? 'border-accent-2' : 'border-border'
                          }`}>
                    {imgOf(r) ? (
                      <img src={imgOf(r)} alt="" className="pixel max-h-full max-w-full object-contain" draggable={false} />
                    ) : (
                      <span className="font-galmuri9 text-[7px] text-ink-dim">준비중</span>
                    )}
                  </button>
                ) : (
                  <div key={`empty-${i}`}
                       className="aspect-square rounded-[8px] border border-border bg-white" />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}