import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { regenerateItem } from '../lib/api'
import { STAT_KEYS, STAT_LABELS, RARITY_TABLE, statPercent } from '../game/statSystem'

const GRADE_ICON = {
  normal: '/assets/icons/GradeNormal.png',
  rare: '/assets/icons/GradeRare.png',
  epic: '/assets/icons/GradeEpic.png',
  unique: '/assets/icons/GradeUnique.png',
}

export default function ItemResultPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let alive = true

    supabase.from('items').select('*').eq('id', itemId).single()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setLoadError('아이템을 찾을 수 없습니다')
        else setItem(data)
      })

    const channel = supabase
      .channel(`item-${itemId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items', filter: `id=eq.${itemId}` },
        ({ new: row }) => { if (alive) setItem(row) })
      .subscribe()

    return () => { alive = false; supabase.removeChannel(channel) }
  }, [itemId])

  const handleRetry = async () => {
    const prev = item
    try {
      setItem((p) => ({ ...p, meta_status: 'pending', error_msg: null }))
      await regenerateItem(itemId)
    } catch (err) {
      alert(err.message)
      setItem(prev)          // 실패하면 원래 상태로 복구
    }
  }

  const handleShare = async () => {
    try {
      const blob = await (await fetch(item.image_url)).blob()
      const file = new File([blob], `${item.name}.png`, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: item.name })
        return
      }
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'),
        { href: url, download: `${item.name}.png` }).click()
      URL.revokeObjectURL(url)
    } catch {
      alert('이미지를 저장하지 못했습니다')
    }
  }

  if (loadError) {
    return (
      <div className="p-4 text-center font-galmuri11 text-[11px] text-ink">
        <p>{loadError}</p>
        <button onClick={() => navigate('/')} className="mt-2 underline">홈으로</button>
      </div>
    )
  }

  if (!item) {
    return <div className="p-4 text-center font-galmuri11 text-[11px] text-ink-dim">불러오는 중...</div>
  }

  // 생성 중
  if (item.meta_status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-accent" />
        <p className="font-galmuri9 text-[11px] font-bold text-ink">픽살락시로 아이템을 보내는 중이에요</p>
        <p className="font-galmuri11 text-[10px] text-ink-dim">20초~1분 정도 걸려요</p>
      </div>
    )
  }

  // 실패
  if (item.meta_status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 p-8">
        <p className="text-center font-galmuri11 text-[11px] text-ink">
          {item.error_msg || '아이템 생성에 실패했어요'}
        </p>
        <div className="flex gap-2 font-galmuri9 text-[10px] font-bold">
          <button onClick={handleRetry} className="rounded-full border-2 border-line bg-accent px-4 py-2">
            다시 시도
          </button>
          <button onClick={() => navigate('/')} className="rounded-full border-2 border-border bg-surface-2 px-4 py-2">
            메인화면으로
          </button>
        </div>
      </div>
    )
  }

  const rarity = RARITY_TABLE[item.rarity] || RARITY_TABLE.normal

  return (
    <div className="flex flex-col px-[1%] py-[1%]">
      {/* ── 결과 카드 ── */}
      <div className="relative">
        <img src="/assets/ui/RW.png" alt="" className="block w-full select-none" draggable={false} />

        {/* 카드 본문 */}
        <div className="absolute inset-x-[6%] bottom-[3%] top-[11%] flex flex-col items-center">
          {/* 아이템 이미지 + 등급 배지 */}
          <div className="relative w-[47%]">
            <img src="/assets/ui/ItemResult.png" alt="" className="block w-full select-none" draggable={false} />
            <img
              src={item.image_url}
              alt={item.name}
              className="pixel absolute inset-[10%] h-[80%] w-[80%] object-contain"
              draggable={false}
            />
            {/* 등급 배지 — 아이템 칸 좌상단에 걸침 */}
            <div className="absolute -left-[14%] -top-[7%] w-[56%]">
              <img
                src={GRADE_ICON[item.rarity] || GRADE_ICON.normal}
                alt={rarity.label}
                className="block w-full select-none"
                draggable={false}
              />
            </div>
          </div>

          {/* 아이템 이름 — 갈무리9 */}
          <h2 className="mt-[3%] text-center font-galmuri9 text-[15px] font-bold text-ink">
            {item.name}
          </h2>

          {/* 설명 — 갈무리11 */}
          <p className="mt-[2%] whitespace-pre-line text-center font-galmuri11 text-[11px] leading-relaxed text-ink-dim">
            {item.description}
          </p>

          {/* 스탯 4종 — 2×2 */}
          <div className="mt-auto w-full">
            <div className="grid grid-cols-2 gap-x-[3%] gap-y-[11%]">
              {STAT_KEYS.map((k) => (
                <div key={k} className="relative">
                  <img src="/assets/ui/StatBar.png" alt="" className="block w-full  select-none" draggable={false} />
                  <span className="absolute inset-0 flex items-center justify-center gap-1 font-galmuri9 text-[14px] text-ink">
                    <img src={STAT_LABELS[k].icon} alt=""
                         className="pixel h-4 w-4 flex-none" draggable={false} />
                    <span>{k.toUpperCase()} : {item.stats?.[k] ?? 0}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-[3%] text-right font-galmuri11 text-[9px] text-ink-dim">
              아이템 종합치 {item.power}
            </p>
          </div>
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="mt-3 flex items-center justify-between px-[6%]">
        <button onClick={() => navigate('/')} aria-label="홈으로" className="w-[15%]">
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>

        <button onClick={() => navigate('/calendar')} aria-label="캘린더" className="w-[38%]">
          <img src="/assets/ui/CalendarPath.png" alt="" className="block w-full select-none" draggable={false} />
        </button>

        <button onClick={handleShare} aria-label="공유하기" className="w-[20%]">
          <img src="/assets/ui/Share.png" alt="" className="block w-full select-none" draggable={false} />
        </button>
      </div>

      {/* 다시 뽑기 — 명세서엔 없지만 기존 기능이라 유지 */}
      <button
        onClick={handleRetry}
        className="-mt-1.5 self-center font-galmuri11 text-[11px] text-ink-dim underline"
      >
        다시 뽑기
      </button>
    </div>
  )
}