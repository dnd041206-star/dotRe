import { supabase } from './supabaseClient'

/// 닉네임으로 사용자 검색 (친구 찾기)
export async function searchUserByEmail(nickname) {
  const { data, error } = await supabase
    .rpc('search_profile_by_nickname', { nick: nickname })
  if (error) throw error
  return data?.[0] ?? null
}

// 친구 신청 보내기 (중복 확인 포함)
export async function sendFriendRequest(myId, friendId) {
  // 자기 자신에게 신청 방지
  if (myId === friendId) {
    return { ok: false, reason: 'self' }
  }

  // 이미 관계가 있는지 양방향으로 확인
  const { data: existing, error: checkError } = await supabase
    .from('friends')
    .select('id, status')
    .or(
      `and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`
    )
    .maybeSingle()
  if (checkError) throw checkError

  if (existing) {
    // 이미 친구이거나, 이미 신청이 오간 상태
    if (existing.status === 'accepted') {
      return { ok: false, reason: 'already_friend' }
    }
    return { ok: false, reason: 'already_pending' }
  }

  // 관계가 없으면 새로 신청
  const { error } = await supabase
    .from('friends')
    .insert({ user_id: myId, friend_id: friendId, status: 'pending' })
  if (error) throw error

  return { ok: true }
}

// 3) 나에게 온 친구 신청 목록 (상대 프로필 포함)
export async function getReceivedRequests(myId) {
  const { data, error } = await supabase
    .from('friends')
    .select('id, status, requester:profiles!friends_user_id_fkey(id, email, full_name, nickname)')
    .eq('friend_id', myId)
    .eq('status', 'pending')
  if (error) throw error
  return data
}

// 친구 신청 수락 (pending 상태일 때만)
export async function acceptFriendRequest(requestId) {
  const { data, error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('id')
  if (error) throw error
  return data
}

// 5) 내 친구 목록 (수락된 것, 양방향)
export async function getMyFriends(myId) {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id, status,
      user:profiles!friends_user_id_fkey(id, email, full_name, nickname, bio),
      friend:profiles!friends_friend_id_fkey(id, email, full_name, nickname, bio)
    `)
    .eq('status', 'accepted')
    .or(`user_id.eq.${myId},friend_id.eq.${myId}`)
  if (error) throw error

  // 내가 user쪽이든 friend쪽이든, '상대방'만 추려서 반환
  return data.map((row) => {
    const other = row.user.id === myId ? row.friend : row.user
    return { relationId: row.id, ...other }
  })
}

/** 친구 삭제 (양방향 관계 한 행 제거) */
export async function removeFriend(relationId) {
  const { error } = await supabase.from('friends').delete().eq('id', relationId)
  if (error) throw error
}