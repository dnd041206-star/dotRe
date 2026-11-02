import { supabase } from './supabaseClient'

// 내 프로필 정보 + 통계 불러오기
export async function getMyProfile(userId) {
  // 1) 프로필 기본 정보
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (profileError) throw profileError

  // 2) 일기 작성 횟수 (개수만 세기)
  const { count, error: countError } = await supabase
    .from('diaries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (countError) throw countError

  return { profile, diaryCount: count ?? 0 }
}

//닉네임 관련 함수!
// 닉네임 중복 확인 (사용 가능하면 true)
export async function isNicknameAvailable(nickname, myId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('nickname', nickname)
    .maybeSingle()
  if (error) throw error
  // 아무도 안 쓰거나, 나 자신이면 사용 가능
  return !data || data.id === myId
}

// 닉네임 저장
export async function updateNickname(myId, nickname) {
  const { error } = await supabase
    .from('profiles')
    .update({ nickname })
    .eq('id', myId)
  if (error) {
    // unique 제약 위반이면 중복 에러
    if (error.code === '23505') {
      return { ok: false, reason: 'duplicate' }
    }
    throw error
  }
  return { ok: true }
}


/** 프로필 + 통계 + 대표 아이템 (본인·친구 공용) */
export async function getProfileFull(userId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, nickname, full_name, email, bio, birthday, rep_item_ids, nuts, created_at, equipped_face_id, equipped_hair_id, equipped_outfit_id')
    .eq('id', userId)
    .single()
  if (error) throw error

  const { data: diaryCount } = await supabase.rpc('diary_count', { uid: userId })

  let repItems = []
  const ids = (profile.rep_item_ids || []).filter(Boolean)
  if (ids.length) {
    const { data } = await supabase
      .from('items')
      .select('id, name, image_url, rarity')
      .in('id', ids)
    // 저장된 순서대로 정렬
    repItems = ids.map((id) => data?.find((it) => it.id === id)).filter(Boolean)
  }

  return { profile, diaryCount: diaryCount ?? 0, repItems }
}

/** 내 정보 수정 */
export async function updateProfile(myId, fields) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', myId)
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' }
    throw error
  }
  return { ok: true }
}

/** 대표 아이템 슬롯 저장 (최대 3) */
export async function setRepItems(myId, ids) {
  const { error } = await supabase
    .from('profiles')
    .update({ rep_item_ids: ids.slice(0, 3) })
    .eq('id', myId)
  if (error) throw error
}

// 회원탈퇴: 내 데이터 전부 삭제
export async function deleteMyAccount(myId) {
  // 순서: 교환기록 → 아이템 → 일기 → 친구 → 프로필
  // (외래키 관계상 자식부터 지우는 게 안전)
  await supabase.from('item_trades').delete().or(`from_user.eq.${myId},to_user.eq.${myId}`)
  await supabase.from('items').delete().eq('owner_id', myId)
  await supabase.from('diaries').delete().eq('user_id', myId)
  await supabase.from('friends').delete().or(`user_id.eq.${myId},friend_id.eq.${myId}`)
  await supabase.from('profiles').delete().eq('id', myId)
}

