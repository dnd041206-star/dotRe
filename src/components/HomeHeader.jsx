import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { getStreakDays } from '../lib/diaryService'

export default function HomeHeader({ onStatusLoaded }) {
  const { session } = useAuth()
  const [todayStr, setTodayStr] = useState('')
  const [streak, setStreak] = useState(0)
  const [writtenToday, setWrittenToday] = useState(false)

  useEffect(() => {
    const id = session?.user?.id
    if (!id) return

    // 1. 오늘 날짜 형성 (YYYY-MM-DD)
    const today = new Date().toLocaleDateString('sv-SE')
    setTodayStr(today)

    // 2. 오늘 일기 작성 여부 확인 및 연속 작성일 계산
    Promise.all([
      supabase
        .from('diaries')
        .select('id')
        .eq('user_id', id)
        .eq('diary_date', today)
        .limit(1),
      getStreakDays(id)
    ]).then(([{ data: todayDiaries }, streakCount]) => {
      const isWritten = (todayDiaries?.length || 0) > 0
      setWrittenToday(isWritten)
      setStreak(streakCount)

      // 부모(HomePage)로 오늘 작성 완료 여부전달
      if (onStatusLoaded) {
        onStatusLoaded(isWritten)
      }
    }).catch(console.error)
  }, [session, onStatusLoaded])

  return (
      <div className="flex flex-col items-center gap-1 font-galmuri9">
      {/* 오늘 날짜 */}
      <span className="whitespace-nowrap text-[10px] font-bold text-black">{todayStr}</span>

      {/* 오늘 작성 여부 & 연속 작성일 */}
      <span
        className={`whitespace-nowrap rounded-full border border-line px-2 py-0.5 text-[9px] text-black ${
          writtenToday ? 'bg-accent' : 'bg-white'
        }`}>
        {writtenToday ? '오늘 기록 완료!' : '오늘 미작성'}
      </span>
      <span className="whitespace-nowrap text-[10px] text-black">
        연속 작성 {streak}일째
      </span>
    </div>
  )
}
