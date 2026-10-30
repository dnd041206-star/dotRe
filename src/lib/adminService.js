import { supabase } from './supabaseClient'

/** 관리자 페이지에서 이미지 업로드 → public URL 반환 */
export async function uploadCatalogImage(file) {
  const ext = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('catalog-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('catalog-images').getPublicUrl(path)
  return data.publicUrl
}