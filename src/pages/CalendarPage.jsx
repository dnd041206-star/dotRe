import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getMyItems } from '../lib/diaryService'
import { getReceivedItems } from '../lib/tradeService'
import { RARITY_TABLE, STAT_KEYS, STAT_LABELS, statPercent } from '../game/statSystem'
import { gradeIcon } from '../game/gradeIcons'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** Date → 'YYYY-MM-DD' (로컬 기준) */
function toKey(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function CalendarPage() {
  const { session } = useAuth()
  const [tab, setTab] = useState('mine')          // mine | received
  const [mine, setMine] = useState([])
  const [received, setReceived] = useState([])
  const [cursor, setCursor] = useState(() => new Date())
  const [picked, setPicked] = useState(null)      // 선택한 날짜 키
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  // 연도 선택 모드
  const [pickingYear, setPickingYear] = useState(false)
  const [yearRangeStart, setYearRangeStart] = useState(() => new Date().getFullYear() - 5)

  useEffect(() => {
    if (!session) return
    Promise.all([
      getMyItems(session.user.id),
      getReceivedItems(session.user.id),
    ])
      .then(([a, b]) => { setMine(a); setReceived(b) })
      .catch((err) => console.error('불러오기 실패:', err))
      .finally(() => setLoading(false))
  }, [session])

  // 날짜별로 아이템 묶기
  const byDate = useMemo(() => {
    const map = {}
    const list = tab === 'mine' ? mine : received
    for (const it of list) {
      if (tab === 'mine' && it.meta_status !== 'done') continue
      const raw = tab === 'mine' ? (it.diaries?.diary_date || it.created_at) : it.created_at
      if (!raw) continue
      const key = String(raw).slice(0, 10)
      ;(map[key] ||= []).push(it)
    }
    return map
  }, [tab, mine, received])

  // 이번 달 격자 (앞뒤 빈칸 포함)
  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const out = []
    for (let i = 0; i < first.getDay(); i++) out.push(null)
    for (let d = 1; d <= last.getDate(); d++) out.push(new Date(year, month, d))
    return out
  }, [cursor])

  const moveMonth = (delta) => {
    setPicked(null)
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1))
  }

  const minYear = 2026

  const openYearPicker = () => {
    setYearRangeStart(Math.max(minYear, cursor.getFullYear() - 5))
    setPickingYear(true)
  }

  const moveYearRange = (delta) => {
    setYearRangeStart((y) => y + delta * 12)
  }

  const pickYear = (year) => {
    setCursor(new Date(year, cursor.getMonth(), 1))
    setPicked(null)
    setPickingYear(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-galmuri11 text-[11px] text-ink-dim">
        불러오는 중...
      </div>
    )
  }

  const todayKey = toKey(new Date())
  const pickedItems = picked ? byDate[picked] || [] : []

  return (
    <div className="flex h-full flex-col px-[0%] py-[1%]">
      {/* ── 달력 전체 박스 (헤더 + 달력) ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border-2 border-border bg-surface">

        {/* 연·월 이동 헤더 */}
        <div
          className="flex flex-none items-center justify-between border-b-2 border-border px-[4%] py-[4%]"
          style={{ backgroundColor: '#C4EC5F' }}
        >
          <button
            onClick={() => (pickingYear ? moveYearRange(-1) : moveMonth(-1))}
            aria-label={pickingYear ? '이전 연도 범위' : '이전 달'}
            disabled={pickingYear && yearRangeStart - 12 + 11 < minYear}
            className="btn-icon px-1 text-[18px] leading-none text-accent-2"
          >
            ◀
          </button>

          <button
            onClick={() => (pickingYear ? setPickingYear(false) : openYearPicker())}
            aria-label={pickingYear ? '연도 선택 닫기' : '연도 선택 열기'}
            className="btn-icon font-galmuri9 text-[28px] [text-shadow:_-1.5px_0_white,_0_1.5px_white,_1.5px_0_white,_0_-1.5px_white] font-regular leading-none text-ink"
          >
            {pickingYear
              ? `${yearRangeStart} - ${yearRangeStart + 11}`
              : `${cursor.getFullYear()}. ${cursor.getMonth() + 1}`}
          </button>

          <button
            onClick={() => (pickingYear ? moveYearRange(1) : moveMonth(1))}
            aria-label={pickingYear ? '다음 연도 범위' : '다음 달'}
            className="btn-icon px-1 text-[18px] leading-none text-accent-2"
          >
            ▶
          </button>
        </div>

        {pickingYear ? (
          /* ── 연도 선택 그리드 ── */
                     <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((year) => (
                <button
                  key={year}
                  onClick={() => pickYear(year)}
                  disabled={year < minYear}
                  className={`btn-icon rounded-[6px] border-2 py-3 font-galmuri9 text-[13px] font-bold disabled:opacity-30 ${
                    year === cursor.getFullYear()
                      ? 'border-line bg-accent text-accent-ink'
                      : 'border-border bg-surface-2 text-ink'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
        ) : (
          <>
            {/* 내 기록 / 받은 아이템 토글 */}
            <div className="relative mx-auto mt-[3%] w-[60%] flex-none">
              <img
                src={tab === 'mine'
                  ? '/assets/ui/CalendarMy.png'
                  : '/assets/ui/CalendarFriend.png'}
                alt={tab === 'mine' ? '내 기록' : '받은 아이템'}
                className="block w-full select-none"
                draggable={false}
              />

              {/* 왼쪽 절반 = 내 기록, 오른쪽 절반 = 받은 아이템 */}
              <button
                onClick={() => { setTab('mine'); setPicked(null) }}
                aria-label="내 기록"
                className="btn-icon absolute inset-y-0 left-0 w-1/2"
              />
              <button
                onClick={() => { setTab('received'); setPicked(null) }}
                aria-label="받은 아이템"
                className="btn-icon absolute inset-y-0 right-0 w-1/2"
              />
            </div>

            {/* 요일 + 날짜 격자 + 상세 (스크롤 영역) */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-[2%] pb-[3%] pt-[4%]">
              {/* 요일 */}
              <div className="grid grid-cols-7 text-center font-galmuri9 text-[13px] text-ink-dim">
                {WEEKDAYS.map((w, i) => (
                  <div key={i} className={i === 0 ? 'text-accent-2' : ''}>{w}</div>
                ))}
              </div>

              {/* 날짜 격자 */}
              <div className="mt-2 grid grid-cols-7 gap-1">
                {cells.map((date, i) => {
                  if (!date) return <div key={i} className="h-18" />
                  const key = toKey(date)
                  const dayItems = byDate[key] || []
                  const isToday = key === todayKey
                  const isPicked = key === picked

                  return (
                    <button
                      key={i}
                      onClick={() => setPicked(dayItems.length ? key : null)}
                      className={`btn-icon flex h-16 flex-col items-center justify-start overflow-hidden rounded-[4px] p-0.5 ${
                        isPicked ? 'bg-accent/30' : ''
                      } ${dayItems.length ? '' : 'opacity-60'}`}
                    >
                      <span className={`font-galmuri9 text-[9px] leading-none ${
                        isToday ? 'font-bold text-accent-2' : 'text-ink-dim'
                      }`}>
                        {date.getDate()}
                      </span>

                      {dayItems[0] && (
                        <div className="relative mt-0.5 min-h-0 w-full flex-1">
                          <img src={dayItems[0].image_url} alt=""
                               className="pixel h-full w-full object-contain" />
                          {dayItems.length > 1 && (
                            <span className="absolute bottom-0 right-0 rounded-full bg-ink px-1 font-galmuri9 text-[7px] leading-tight text-white">
                              +{dayItems.length - 1}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 선택한 날 상세 */}
              {pickedItems.length > 0 && (
                <div className="mt-[3%] rounded-[6px] border-2 border-border bg-surface-2 p-[3%]">
                  <p className="mb-2 font-galmuri11 text-[10px] text-ink-dim">{picked}</p>

                  {pickedItems.map((it) => {
                    const rarity = RARITY_TABLE[it.rarity] || RARITY_TABLE.normal
                    return (
                      <div key={it.id} className="mb-3 flex gap-2 last:mb-0">
                        <button onClick={() => setDetail(it)} className="btn-icon flex-none">
                          <img src={it.image_url} alt={it.name}
                               className="pixel h-16 w-16 rounded-[4px] border-2 border-border"
                               style={{ backgroundColor: rarity.color + '22' }} />
                        </button>

                        <div className="min-w-0 flex-1 rounded-[4px] bg-white p-2">
                          {tab === 'mine' ? (
                            <p className="whitespace-pre-wrap font-galmuri11 text-[10px] text-ink">
                              {it.diaries?.content || '작성된 일기가 없어요'}
                            </p>
                          ) : (
                            <>
                              <p className="font-galmuri11 text-[9px] text-ink-dim">보낸 사람</p>
                              <p className="mt-0.5 font-galmuri9 text-[11px] font-bold text-ink">
                                {it.sender?.nickname ?? it.sender?.full_name ?? '알 수 없음'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {Object.keys(byDate).length === 0 && (
                <p className="mt-6 text-center font-galmuri11 text-[10px] text-ink-dim">
                  {tab === 'mine'
                    ? '아직 기록된 아이템이 없어요. 일기를 작성해보세요!'
                    : '아직 받은 아이템이 없어요.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── 아이템 상세 모달 ── */}
      {detail && (() => {
        const rarity = RARITY_TABLE[detail.rarity] || RARITY_TABLE.normal
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
               onClick={() => setDetail(null)}>
            <div className="max-h-[80dvh] w-full max-w-[370px] overflow-hidden rounded-[10px] border-2 border-line bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
                 onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b-1 border-line bg-accent px-3 py-2">
                <span className="flex-1 truncate font-galmuri9 text-[11px] font-bold text-accent-ink">
                  {detail.name}
                </span>
                <button onClick={() => setDetail(null)} aria-label="닫기"
                        className="btn-icon flex h-5 w-5 items-center justify-center rounded-sm border border-accent-ink bg-surface font-galmuri9 text-[9px] leading-none text-accent-ink">
                  ✕
                </button>
              </div>

              <div className="max-h-[60dvh] overflow-y-auto p-3">
                <div className="flex flex-col items-center">
                  <img src={detail.image_url} alt={detail.name}
                       className="pixel h-28 w-28 rounded-[6px] border-2 border-border"
                       style={{ backgroundColor: rarity.color + '22' }} />
                   <img src={gradeIcon(detail.rarity)} alt={rarity.label}
                       className="mt-2 w-[16%] select-none" draggable={false} />
                  <p className="mt-2 whitespace-pre-line text-center font-galmuri11 text-[11px] text-ink-dim">
                    {detail.description}
                  </p>
                </div>

                {detail.sender && (
                  <div className="mt-3 rounded-[6px] border-2 border-border bg-surface-2 p-2 text-center">
                    <p className="font-galmuri11 text-[9px] text-ink-dim">보낸 사람</p>
                    <p className="mt-0.5 font-galmuri9 text-[11px] font-bold text-ink">
                      {detail.sender.nickname ?? detail.sender.full_name}
                    </p>
                  </div>
                )}

                <div className="mt-3 rounded-[6px] border-2 border-border bg-surface-2 p-2">
                  {STAT_KEYS.map((k) => (
                    <div key={k} className="mb-2 flex items-center gap-2 last:mb-0">
                      <span className="flex w-16 flex-none items-center gap-1 font-galmuri11 text-[11px] text-ink">
                        <img src={STAT_LABELS[k].icon} alt=""
                             className="pixel h-4 w-4 flex-none" draggable={false} />
                        {STAT_LABELS[k].ko}
                      </span>
                      <div className="h-2 flex-1 rounded-full border border-border bg-white">
                        <div className="h-full rounded-full"
                             style={{ width: `${statPercent(detail.stats?.[k] ?? 0)}%`,
                                      backgroundColor: STAT_LABELS[k].color }} />
                      </div>
                      <span className="w-7 text-right font-galmuri9 text-[10px] font-bold text-ink">
                        {detail.stats?.[k] ?? 0}
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 text-right font-galmuri11 text-[9px] text-ink-dim">
                    아이템 종합치 {detail.power}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}