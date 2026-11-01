import { supabase } from './supabaseClient'
import { requestItem } from './api'



// 사진을 Storage에 올리고 공개 주소를 반환
async function uploadPhoto(userId, file) {
  // 파일 확장자만 추출 (jpg, png 등)
  const ext = file.name.split('.').pop().toLowerCase()
  // 한글·공백 걱정 없는 안전한 이름으로 생성
  const fileName = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('diary-photos')
    .upload(fileName, file)
  if (error) throw error

  const { data } = supabase.storage.from('diary-photos').getPublicUrl(fileName)
  return data.publicUrl
}

/** 로컬 기준 'YYYY-MM-DD' — 저장할 때 쓰는 형식과 동일하게 맞춘다 */
const dateKey = (d) => d.toLocaleDateString('sv-SE')

/** 연속 작성일 계산.
 *  오늘 기록이 있으면 오늘부터, 없으면 어제부터 거슬러 올라가며 끊기는 지점까지 센다.
 *  (오늘 아직 안 썼어도 "어제까지 N일 연속"을 보여주기 위함) */
export async function getStreakDays(userId) {
  const { data, error } = await supabase
    .from('diaries')
    .select('diary_date')
    .eq('user_id', userId)
    .order('diary_date', { ascending: false })
    .limit(60)
  if (error || !data?.length) return 0

  const days = new Set(data.map((d) => String(d.diary_date).slice(0, 10)))

  const cursor = new Date()
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1)

  let streak = 0
  while (days.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * 일기 저장 → 서버에 아이템 생성 요청.
 * 아이템은 pending 상태로만 만들어지고, 실제 생성은 서버가 백그라운드로 진행한다.
 * 반환된 itemId로 결과 화면에서 Realtime 구독을 건다.
 */
export async function createDiaryWithItem({ userId, content, photoFile }) {
  if (!photoFile) throw new Error('사진을 첨부해주세요')

  const photoUrl = await uploadPhoto(userId, photoFile)

  const { data: diary, error: diaryError } = await supabase
    .from('diaries')
    .insert({ user_id: userId, content, photo_url: photoUrl, diary_date: new Date().toLocaleDateString('sv-SE')})
    .select()
    .single()
  if (diaryError) throw diaryError

  const streakDays = await getStreakDays(userId)
  const { itemId } = await requestItem({ diaryId: diary.id, streakDays })

  return { diary, itemId }
}

// 내가 만든 아이템 (캘린더용)
export async function getMyItems(userId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, image_url, description, rarity, stats, power, meta_status, created_at, diaries(diary_date, content, photo_url)')
    .eq('creator_id', userId)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// /** 교환받은 아이템 (남이 만들어 나에게 보낸 것) */
// export async function getReceivedItems(userId) {
//   const { data, error } = await supabase
//     .from('items')
//     .select('id, name, image_url, description, rarity, stats, power, created_at, creator_id')
//     .eq('owner_id', userId)
//     .neq('creator_id', userId)
//     .eq('meta_status', 'done')
//     .order('created_at', { ascending: false })
//   if (error) throw error
//   return data
// }


/** 대표 아이템으로 고를 수 있는 아이템 — 내가 소유한 모든 완료된 아이템
 *  (내가 만든 것 + 친구에게 교환받은 것 모두 포함) */
export async function getOwnedItems(userId) {
  const { data, error } = await supabase
    .from('items')
    .select('id, name, image_url, description, rarity, stats, power, meta_status, created_at')
    .eq('owner_id', userId)
    .eq('meta_status', 'done')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}