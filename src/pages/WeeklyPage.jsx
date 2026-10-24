import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWeekly, claimWeekly } from '../lib/api'
import { GRADE_TABLE } from '../game/weekly'
import NutsBar from '../components/NutsBar'

const gradeColor = (g) => GRADE_TABLE.find((x) => x.grade === g)?.color ?? '#9ca3af'

function Pedestal({ item }) {
  return (
    <div className="relative w-[22%] flex-none">
      {/* 캡슐 — 아이템보다 위 레이어 */}
      <img src="/assets/ui/Pedestal.png" alt=""
           className="relative z-10 block w-full select-none" draggable={false} />

      {/* 아이템 — 캡슐 뒤로 */}
      {item && (
        <div className="absolute inset-x-0 bottom-[22%] top-0 z-0 flex items-center justify-center">
          <img src={item.image_url} alt={item.name}
               className="pixel max-h-[60%] max-w-[60%] object-contain" draggable={false} />
        </div>
      )}
    </div>
  )
}

export default function WeeklyPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)   // 결산 창

  const load = () => { getWeekly().then(setData).catch((e) => setError(e.message)) }
  useEffect(load, [])

  const handleStart = async () => {
    setBusy(true)
    try {
      const r = await claimWeekly(current.weekStart)
      setResult(r)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center font-galmuri11 text-[11px] text-white">
        {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex h-full items-center justify-center font-galmuri11 text-[11px] text-white">
        불러오는 중...
      </div>
    )
  }

  const current = data.weeks.find((w) => w.isCurrent)
  if (!current) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center font-galmuri11 text-[11px] text-white">
        평가 정보를 불러오지 못했습니다
      </div>
    )
  }

  // 단상 7칸 — 위 4개, 아래 3개
  const slots = Array.from({ length: 7 }, (_, i) => current.items[i] ?? null)

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden px-[4%] py-[3%]">

      {/* ── 상단 줄: 너트 / 도움말 ── */}
      <div className="flex flex-none items-start justify-between">
        <NutsBar value={data.nuts} widthClass="w-[32%]" textClass="text-[18px]" />
        {/* 도움말 버튼 — 주간평가용 모달 만들면 onClick 연결 */}
        <button aria-label="도움말" className="btn-icon w-[10%]">
          <img src="/assets/ui/Support.png" alt="" className="block w-full select-none" draggable={false} />
        </button>
      </div>

      {/* ── 제목 ── */}
      <h2 className="mt-[3%] flex-none text-center font-galmuri9 text-[26px] font-bold text-accent-2 [text-shadow:_-1.5px_0_white,_0_1.5px_white,_1.5px_0_white,_0_-1.5px_white]">
        주간 평가
      </h2>

      <div className="min-h-0 flex-[1.4]" />

      {/* ── 마스코트 + 말풍선 ── */}
      <div className="flex flex-none items-start">
        <img src="/assets/char/hakase_test.png" alt=""
             className="pixel w-[26%] flex-none select-none" draggable={false} />

        <div className="relative mt-[6%] w-[58%] flex-none">
          <img src="/assets/ui/TestBubble.png" alt=""
               className="block w-full select-none" draggable={false} />
          <div className="absolute inset-y-0 left-[16%] right-[6%] flex flex-col items-center justify-center text-center">
            <p className="font-galmuri11 text-[12px] leading-relaxed text-ink">
              이번 주 주간평가<br />보너스 아이템은...
            </p>
            <p className="mt-1 font-galmuri9 text-[17px] font-regular text-white">
              <span className="[text-shadow:_-1.5px_0_var(--color-accent-2),_0_1.5px_var(--color-accent-2),_1.5px_0_var(--color-accent-2),_0_-1.5px_var(--color-accent-2)]">
                {current.bonusLabel}
              </span>
              <span className="ml-1 font-galmuri11 text-[13px] font-normal text-ink">(이)라네..</span>
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1" />

      {/* ── 단상 7개 (위 4 / 아래 3) ── */}
      <div className="flex flex-none flex-col items-center">
        <div className="flex w-full justify-center gap-[3%]">
          {slots.slice(0, 4).map((it, i) => <Pedestal key={i} item={it} />)}
        </div>
        <div className="mt-[2%] flex w-full justify-center gap-[3%]">
          {slots.slice(4, 7).map((it, i) => <Pedestal key={i} item={it} />)}
        </div>
      </div>

      <p className="mt-[2%] flex-none text-center font-galmuri11 text-[9px] text-black">
        이번 주 아이템 {current.itemCount}개
        {current.bonusCount > 0 && ` · 보너스 +${current.bonusCount}`}
      </p>

      <div className="min-h-0 flex-[0.8]" />

      {/* ── 평가 시작 버튼 ── */}
      <div className="flex flex-none flex-col items-center">
        {current.claimed ? (
          <div className="w-[54%] opacity-60">
            <img src="/assets/ui/TestComplete.png" alt="이번 주 평가 완료"
                 className="block w-full select-none" draggable={false} />
          </div>
        ) : (
          <button
            onClick={handleStart}
            disabled={!current.claimable || busy}
            aria-label={busy ? '평가 중' : '평가 시작'}
            className="btn-icon w-[54%] transition-opacity disabled:opacity-40"
          >
            <img src="/assets/ui/TestStart.png" alt="평가 시작"
                 className="block w-full select-none" draggable={false} />
          </button>
        )}

        {!current.claimed && !current.isSunday && (
          <p className="mt-1.5 text-center font-galmuri11 text-[9px] text-ink-dim">
            평가는 일요일에 열려요
          </p>
        )}
      </div>

      <div className="min-h-0 flex-[0.6]" />

      {/* ── 뒤로가기 ── */}
      <div className="flex flex-none items-center">
        <button onClick={() => navigate('/')} aria-label="홈으로" className="btn-icon w-[13%]">
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>
      </div>

      {/* ── 결산 창 ── */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
             onClick={() => setResult(null)}>
          <div className="w-full max-w-[320px] overflow-hidden rounded-[10px] border-2 border-line bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b-2 border-line bg-accent px-3 py-1">
              <span className="flex-1 font-galmuri9 text-[11px] font-bold text-accent-ink">
                이번 주 평가 결과
              </span>
              <button onClick={() => setResult(null)} aria-label="닫기"
                      className="btn-icon flex h-5 w-5 items-center justify-center rounded-sm border border-accent-ink bg-surface font-galmuri9 text-[9px] leading-none text-accent-ink">
                ✕
              </button>
            </div>

            <div className="p-4 text-center">
              <p className="my-2 font-galmuri9 text-[56px] font-bold leading-none"
                 style={{ color: gradeColor(result.grade) }}>
                {result.grade}
              </p>

              <div className="mt-3 rounded-[6px] border-2 border-border bg-surface-2 py-3 font-galmuri9 text-[12px] font-bold text-ink">
                🥜 너트 {result.reward} 획득!
              </div>
              <p className="mt-2 font-galmuri11 text-[9px] text-ink-dim">
                보유 너트 {result.nuts}
              </p>

              <button onClick={() => setResult(null)}
                      className="mt-4 w-full rounded-full border-2 border-line bg-accent py-2 font-galmuri9 text-[11px] font-bold text-accent-ink">
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}