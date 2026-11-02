import { supabase } from './supabaseClient'

/** 내가 구매한 아이템 전부 (배치 여부 포함) */
export async function getRoomItems(myId) {
  const { data, error } = await supabase
    .from('room_items')
    .select('id, item_id, placed, x, y, z, scale, flipped, items(name, image_url, rarity)')
    .eq('user_id', myId)
    .order('z', { ascending: true })
  if (error) throw error
  return data
}

/** 방에 배치된 것만 (홈 화면용) */
export async function getPlacedItems(myId) {
  const { data, error } = await supabase
    .from('room_items')
    .select('id, x, y, z, scale,  flipped, items(name, image_url)')
    .eq('user_id', myId)
    .eq('placed', true)
    .order('z', { ascending: true })
  if (error) throw error
  return data
}

/** 배치 정보 저장 */
export async function saveRoomItem(rowId, fields) {
  const { error } = await supabase.from('room_items').update(fields).eq('id', rowId)
  if (error) throw error
}

/** 여러 개 한 번에 저장 */
export async function saveRoomLayout(rows) {
  await Promise.all(
    rows.map((r) =>
      supabase.from('room_items')
        .update({ placed: r.placed, x: r.x, y: r.y, z: r.z, scale: r.scale, flipped: r.flipped })
        .eq('id', r.id)
    )
  )
}

/** 내가 구매한 가구 전부 (배치 여부 포함) */
export async function getRoomFurniture(myId) {
  const { data, error } = await supabase
    .from('room_furniture')
    .select('id, furniture_id, placed, x, y, z, scale, flipped, furniture_catalog(name, image_url, category)')
    .eq('user_id', myId)
    .order('z', { ascending: true })
  if (error) throw error
  return data
}

export async function getPlacedFurniture(myId) {
  const { data, error } = await supabase
    .from('room_furniture')
    .select('id, x, y, z, scale, flipped, furniture_catalog(name, image_url, category)')
    .eq('user_id', myId)
    .eq('placed', true)
    .order('z', { ascending: true })
  if (error) throw error
  return data
}

/** 가구 배치 정보 저장 (한 개) */
export async function saveRoomFurniture(rowId, fields) {
  const { error } = await supabase.from('room_furniture').update(fields).eq('id', rowId)
  if (error) throw error
}

/** 가구 여러 개 한 번에 저장 */
export async function saveFurnitureLayout(rows) {
  await Promise.all(
    rows.map((r) =>
      supabase.from('room_furniture')
        .update({ placed: r.placed, x: r.x, y: r.y, z: r.z, scale: r.scale, flipped: r.flipped })
        .eq('id', r.id)
    )
  )
}

