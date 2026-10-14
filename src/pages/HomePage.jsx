import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isDevAccount } from '../lib/devAccounts'
import NutsBadge from '../components/NutsBadge'
import MyRoom from '../components/MyRoom'
import HomeHeader from '../components/HomeHeader'

export default function HomePage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [hasWrittenToday, setHasWrittenToday] = useState(false)
  const [nickname, setNickname] = useState(null)
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    const id = session?.user?.id
    if (!id) return
    supabase.from('profiles').select('nickname, full_name').eq('id', id).single()
      .then(({ data }) => setNickname(data?.nickname ?? data?.full_name ?? null))
  }, [session])

  const handleStatusLoaded = useCallback((isWritten) => {
    setHasWrittenToday(isWritten)
  }, [])

  // 개발자 계정은 오늘 이미 썼더라도 버튼을 잠그지 않는다
  const lockWrite = hasWrittenToday && !isDevAccount(session?.user?.id)

  return (
    <div className="flex flex-col gap-3 p-1">
      {/* 1. 프로필 카드 + 오늘 기록 카드 */}
      <div className="flex gap-[2%]">
        {/* 프로필 카드 — 클릭 시 프로필 설정으로 이동 */}
        <button
          onClick={() => navigate('/profile')}
          className="flex w-[61%] items-center gap-[4%] rounded-xl bg-surface-2 p-[3.5%] text-left"
        >
          <div className="w-[35%] flex-none overflow-hidden rounded-lg bg-white p-[4%]">
            <img src="/assets/char/Portrait.png" alt="" className="block w-full" draggable={false} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-galmuri11 text-[13px] text-ink">
              {nickname ?? '이름'}
            </span>
            <NutsBadge widthClass="w-[70%]" textClass="text-[15px]" />
            <span className="text-right font-galmuri11 text-[9px] text-ink-dim">프로필 설정</span>
          </div>
        </button>

        {/* 오늘 기록 카드 */}
        <div className="flex flex-1 flex-col justify-center rounded-xl bg-surface-2 p-[3.5%]">
          <HomeHeader onStatusLoaded={handleStatusLoaded} />
        </div>
      </div>

      {/* 3. 방 (MyRoom) */}
      <div className="relative w-full">
        <MyRoom className="rounded-2xl border border-white/10" />
      </div>

      {/* 4. 하단 버튼 — 상점 / 방꾸미기 / 튜토리얼 + 일기작성 */}
      <div className="mt-0 flex w-full items-end gap-[1%]">
        <button onClick={() => navigate('/shop')} aria-label="상점"
                className="btn-icon w-[17%] flex-none">
          <img src="/assets/ui/ShopIcon.png" alt="상점"
               className="block w-full select-none" draggable={false} />
        </button>

        <button onClick={() => navigate('/room')} aria-label="방꾸미기"
                className="btn-icon w-[17%] flex-none">
          <img src="/assets/ui/HomeEditIcon.png" alt="방꾸미기"
               className="block w-full select-none" draggable={false} />
        </button>

        <button onClick={() => setShowTutorial(true)} aria-label="튜토리얼"
                className="btn-icon w-[17%] flex-none">
          <img src="/assets/ui/TutorialIcon.png" alt="튜토리얼"
               className="block w-full select-none" draggable={false} />
        </button>

        <button
          onClick={() => navigate('/write')}
          disabled={lockWrite}
          aria-label={lockWrite ? '오늘 일기 작성 완료' : '일기 작성'}
          className="btn-icon ml-auto w-[42%] flex-none translate-y-[6px] "
        >
          <img
            src={lockWrite ? '/assets/ui/WriteButton_dis.png' : '/assets/ui/WriteButton.png'}
            alt={lockWrite ? '오늘 일기 작성 완료' : '일기 작성'}
            className="block w-full select-none"
            draggable={false}
          />
        </button>
      </div>

      {/* 튜토리얼 창 — 내용은 나중에 채우면 됨 */}
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
             onClick={() => setShowTutorial(false)}>
          <div className="w-full max-w-[330px] overflow-hidden rounded-[10px] border-2 border-line bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b-2 border-line bg-accent px-3 py-1.5">
              <span className="flex-1 font-galmuri9 text-[12px] font-bold text-accent-ink">튜토리얼</span>
              <button onClick={() => setShowTutorial(false)} aria-label="닫기" className="btn-icon w-[20px]">
                <img src="/assets/ui/XButton.png" alt="" className="block w-full" draggable={false} />
              </button>
            </div>
            <div className="p-4">
              <p className="font-galmuri11 text-[11px] leading-relaxed text-ink">
                여기에 튜토리얼 내용이 들어갑니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}