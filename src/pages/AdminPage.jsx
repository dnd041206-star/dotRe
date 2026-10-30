import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isDevAccount } from '../lib/devAccounts'
import { uploadCatalogImage } from '../lib/adminService'
import {
  getAdminFurniture, createFurnitureCatalog, updateFurnitureCatalog, deleteFurnitureCatalog,
  getAdminAvatarParts, createAvatarPart, updateAvatarPart, deleteAvatarPart,
} from '../lib/api'

const FURNITURE_CATEGORIES = [
  { key: 'desk', label: '책상' },
  { key: 'chair', label: '의자' },
  { key: 'storage', label: '수납' },
  { key: 'misc', label: '기타' },
  { key: 'background', label: '배경' },
]

const AVATAR_CATEGORIES = [
  { key: 'face', label: '얼굴' },
  { key: 'hair', label: '헤어' },
  { key: 'outfit', label: '의상' },
]

const emptyForm = { category: '', name: '', price: '', is_default: false }

function CatalogManager({ categories, hasDefaultFlag, load, create, update, remove }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = () => {
    setLoading(true)
    load().then((r) => setItems(r.items)).finally(() => setLoading(false))
  }
  useEffect(refresh, [])

  const resetForm = () => {
    setForm(emptyForm)
    setFile(null)
    setPreview(null)
    setEditingId(null)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({
      category: item.category,
      name: item.name,
      price: String(item.price ?? ''),
      is_default: !!item.is_default,
    })
    setFile(null)
    setPreview(item.image_url)
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.name.trim()) {
      alert('카테고리와 이름을 입력해주세요')
      return
    }
    if (!editingId && !file) {
      alert('이미지를 선택해주세요')
      return
    }
    setBusy(true)
    try {
      let image_url
      if (file) image_url = await uploadCatalogImage(file)

      const payload = {
        category: form.category,
        name: form.name.trim(),
        price: Number(form.price) || 0,
        ...(image_url ? { image_url } : {}),
        ...(hasDefaultFlag ? { is_default: form.is_default } : {}),
      }

      if (editingId) {
        await update(editingId, payload)
      } else {
        await create(payload)
      }
      resetForm()
      refresh()
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('삭제할까요?')) return
    try {
      await remove(id)
      if (editingId === id) resetForm()
      refresh()
    } catch (err) {
      alert('삭제 실패: ' + err.message)
    }
  }

  return (
    <div className="min-h-screen flex flex-col overflow-y-auto bg-white p-5 text-black">
      {/* ── 입력 폼 ── */}
      <form onSubmit={handleSubmit} className="flex w-full flex-none flex-col gap-3 rounded-lg border p-4 md:w-72">
        <h3 className="font-bold">{editingId ? '항목 수정' : '새로 추가'}</h3>

        <label className="flex flex-col gap-1 text-sm">
          카테고리
          <select value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="rounded border px-2 py-1">
            <option value="">선택</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          이름
          <input value={form.name}
                 onChange={(e) => setForm({ ...form, name: e.target.value })}
                 className="rounded border px-2 py-1" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          가격 (너트)
          <input type="number" min="0" value={form.price}
                 onChange={(e) => setForm({ ...form, price: e.target.value })}
                 className="rounded border px-2 py-1" />
        </label>

        {hasDefaultFlag && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_default}
                   onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            기본 제공(무료) 파츠
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          이미지 {editingId && '(비워두면 기존 이미지 유지)'}
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>

        {preview && (
          <img src={preview} alt="미리보기" className="h-20 w-20 rounded border object-contain" />
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={busy}
                  className="flex-1 rounded bg-lime-400 py-1.5 font-bold disabled:opacity-50">
            {busy ? '저장 중...' : editingId ? '수정 저장' : '추가'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
                    className="rounded border px-3 py-1.5 text-sm">
              취소
            </button>
          )}
        </div>
      </form>

      {/* ── 목록 ── */}
      <div className="min-w-0 flex-1">
        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 항목이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 rounded border p-2">
                <img src={it.image_url} alt={it.name} className="h-12 w-12 flex-none rounded border object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {it.name} {hasDefaultFlag && it.is_default && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px] text-gray-500">기본</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {categories.find((c) => c.key === it.category)?.label ?? it.category} · {it.price}너트
                  </p>
                </div>
                <button onClick={() => startEdit(it)}
                        className="flex-none rounded border px-2 py-1 text-xs">
                  수정
                </button>
                <button onClick={() => handleDelete(it.id)}
                        className="flex-none rounded border border-red-300 px-2 py-1 text-xs text-red-500">
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('furniture')

  const allowed = isDevAccount(session?.user?.id)

  if (!allowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-gray-500">관리자만 접근할 수 있는 페이지예요.</p>
        <button onClick={() => navigate('/')} className="rounded border px-4 py-1.5 text-sm">
          홈으로
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white p-5 text-black">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">관리자 모드</h2>
        <button onClick={() => navigate('/')} className="rounded border px-3 py-1 text-xs">홈으로</button>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab('furniture')}
                className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === 'furniture' ? 'bg-lime-400' : 'border'}`}>
          가구
        </button>
        <button onClick={() => setTab('avatar')}
                className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === 'avatar' ? 'bg-lime-400' : 'border'}`}>
          아바타 파츠
        </button>
      </div>

      {tab === 'furniture' ? (
        <CatalogManager
          categories={FURNITURE_CATEGORIES}
          hasDefaultFlag={false}
          load={getAdminFurniture}
          create={createFurnitureCatalog}
          update={updateFurnitureCatalog}
          remove={deleteFurnitureCatalog}
        />
      ) : (
        <CatalogManager
          categories={AVATAR_CATEGORIES}
          hasDefaultFlag={true}
          load={getAdminAvatarParts}
          create={createAvatarPart}
          update={updateAvatarPart}
          remove={deleteAvatarPart}
        />
      )}
    </div>
  )
}