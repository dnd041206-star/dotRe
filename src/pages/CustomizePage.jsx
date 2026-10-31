import AvatarPreview from '../components/AvatarPreview'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAvatar, buyAvatarPart, equipAvatarPart } from '../lib/api'
import { AVATAR_CATEGORY_KEYS, AVATAR_CATEGORY_LABELS } from '../game/avatar'

/** 카테고리별 탭 에셋 — 해당 카테고리가 선택된 상태의 그림 */
const TAB_IMG = {
  face:   '/assets/ui/Custom_Face.png',
  hair:   '/assets/ui/Custom_Hair.png',
  outfit: '/assets/ui/Custom_Outfit.png',
}

const PER_PAGE = 9   // 3 x 3

export default function CustomizePage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [category, setCategory] = useState(AVATAR_CATEGORY_KEYS[0])
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = () => { getAvatar().then(setData).catch((e) => setError(e.message)) }
  useEffect(load, [])

  // 카테고리를 바꾸면 첫 페이지로
  useEffect(() => { setPage(0) }, [category])

  const handleBuy = async (part) => {
    if (!confirm(`"${part.name}"을(를) 너트 ${part.price}개로 구매할까요?`)) return
    setBusy(part.id)
    try { await buyAvatarPart(part.id); load() }
    catch (err) { alert(err.message) }
    finally { setBusy(null) }
  }

  const handleEquip = async (part) => {
    setBusy(part.id)
    try { await equipAvatarPart(category, part.id); load() }
    catch (err) { alert(err.message) }
    finally { setBusy(null) }
  }

  if (error) {
    return <div className="flex h-full items-center justify-center px-6 text-center font-galmuri11 text-[11px] text-white">{error}</div>
  }
  if (!data) {
    return <div className="flex h-full items-center justify-center font-galmuri11 text-[11px] text-white">불러오는 중...</div>
  }

  const parts = data.items.filter((p) => p.category === category)
  const equippedId = data.equipped[category]

  const pageCount = Math.max(1, Math.ceil(parts.length / PER_PAGE))
  const pageParts = parts.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const slots = Array.from({ length: PER_PAGE }, (_, i) => pageParts[i] ?? null)

    return (
    <div className="relative flex h-full max-h-full min-h-0 flex-col overflow-hidden px-[4%] py-[4%]">

      {/* ── 제목 ── */}
      <h2 className="mx-auto flex-none border-b-2 border-accent-2 pb-0.5 font-galmuri9 text-[26px] text-accent-2 text-outline"
          style={{ '--outline': '#ffffff' }}>
        커스터마이징
      </h2>

      <div className="min-h-0 flex-[0.5]" />

      {/* ── 아바타 ── */}
      <div className="flex flex-none justify-center">
        <AvatarPreview equipped={data.equipped} items={data.items} className="w-[48%]" />
      </div>

      <div className="min-h-0 flex-1" />

      {/* ── 파츠 패널 ── */}
      <div className="flex-none rounded-[12px] border-2 border-border bg-surface p-[3%]">

        {/* 얼굴 / 헤어 / 의상 탭 */}
        <div className="relative">
          <img src={TAB_IMG[category] ?? TAB_IMG.face}
               alt={AVATAR_CATEGORY_LABELS[category]}
               className="block w-full select-none" draggable={false} />
          {AVATAR_CATEGORY_KEYS.slice(0, 3).map((key, i) => (
            <button key={key} onClick={() => setCategory(key)}
                    aria-label={AVATAR_CATEGORY_LABELS[key]}
                    className="btn-icon absolute inset-y-0 w-1/3"
                    style={{ left: `${(i * 100) / 3}%` }} />
          ))}
        </div>

        {/* 파츠 격자 */}
        <div className="mt-[6%] grid grid-cols-3 gap-[3%]">
          {slots.map((p, i) =>
            p ? (
              <button key={p.id}
                      onClick={() => (p.owned ? handleEquip(p) : handleBuy(p))}
                      disabled={busy === p.id}
                      className={`btn-icon flex aspect-[4/3] items-center justify-center rounded-[8px] border-2 bg-white p-1 disabled:opacity-50 ${
                        equippedId === p.id ? 'border-accent-2' : 'border-border'
                      }`}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="pixel max-h-full max-w-full object-contain" draggable={false} />
                ) : (
                  <span className="font-galmuri9 text-[10px] text-ink-dim">준비 중</span>
                )}
              </button>
            ) : (
              <div key={`empty-${i}`} className="aspect-[4/3] rounded-[8px] border-2 border-border bg-white" />
            )
          )}
        </div>

        {/* 페이지 점 */}
        <div className="mt-[9%] flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => (
            <button key={i} onClick={() => setPage(i)} aria-label={`${i + 1}페이지`}
                    className={`btn-icon h-2 w-2 rounded-full ${i === page ? 'bg-ink' : 'bg-border'}`} />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-[0.4]" />

      {/* ── 뒤로가기 ── */}
      <div className="flex flex-none items-center">
        <button onClick={() => navigate('/profile')} aria-label="프로필로" className="btn-icon w-[14%]">
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>
      </div>
    </div>
  )
}