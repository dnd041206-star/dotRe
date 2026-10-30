import { supabase } from './supabaseClient'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다')

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || '요청에 실패했습니다')
  return body
}

/** 일기로 아이템 생성 요청 — 즉시 itemId를 돌려주고 생성은 백그라운드 */
export function requestItem({ diaryId, streakDays = 0 }) {
  return request('/api/items', {
    method: 'POST',
    body: JSON.stringify({ diaryId, streakDays }),
  })
}

/** 같은 사진으로 다시 생성 */
export function regenerateItem(itemId, streakDays = 0) {
  return request(`/api/items/${itemId}/regenerate`, {
    method: 'POST',
    body: JSON.stringify({ streakDays }),
  })
}

export function getWeekly() {
  return request('/api/weekly')
}

export function claimWeekly(weekStart) {
  return request('/api/weekly/claim', {
    method: 'POST',
    body: JSON.stringify({ weekStart }),
  })
}

export function getShop() {
  return request('/api/shop')
}

export function buyItem(itemId, qty = 1) {
  return request('/api/shop/buy', {
    method: 'POST',
    body: JSON.stringify({ itemId, qty }),
  })
}

export function getFurniture(){
  return request('/api/furniture')
}

export function buyFurniture(furnitureId) {
  return request('/api/furniture/buy', {
    method: 'POST',
    body: JSON.stringify({ furnitureId }),
  })
}

export function getAvatar() {
  return request('/api/avatar')
}

export function buyAvatarPart(partId) {
  return request('/api/avatar/buy', {
    method: 'POST',
    body: JSON.stringify({ partId }),
  })
}

export function equipAvatarPart(category, partId) {
  return request('/api/avatar/equip', {
    method: 'POST',
    body: JSON.stringify({ category, partId }),
  })
}

export function receiveTradeApi(tradeId) {
  return request(`/api/trades/${tradeId}/receive`, { method: 'POST' })
}

// ── 관리자: 가구 카탈로그 ──
export function getAdminFurniture() {
  return request('/api/admin/furniture')
}
export function createFurnitureCatalog(payload) {
  return request('/api/admin/furniture', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateFurnitureCatalog(id, payload) {
  return request(`/api/admin/furniture/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteFurnitureCatalog(id) {
  return request(`/api/admin/furniture/${id}`, { method: 'DELETE' })
}

// ── 관리자: 아바타 파츠 ──
export function getAdminAvatarParts() {
  return request('/api/admin/avatar-parts')
}
export function createAvatarPart(payload) {
  return request('/api/admin/avatar-parts', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateAvatarPart(id, payload) {
  return request(`/api/admin/avatar-parts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteAvatarPart(id) {
  return request(`/api/admin/avatar-parts/${id}`, { method: 'DELETE' })
}