import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getProfileFull, updateProfile, setRepItems, deleteMyAccount } from '../lib/profileService'
import { getMyItems } from '../lib/diaryService'
import { RARITY_TABLE } from '../game/statSystem'

/** 'YYYY-MM-DD' → '11월 27일' */
const fmtBirthday = (b) => {
  if (!b) return '미설정'
  const [, m, d] = String(b).slice(0, 10).split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/** 정보 캡슐 한 줄 */
function InfoBar({ label, value }) {
  return (
    <div className="translate-y-[10px] relative w-full">
      <img src="/assets/ui/ProfileBar.png" alt="" className="block w-full select-none" draggable={false} />
      <div className="absolute inset-x-[5%] inset-y-0 flex items-center justify-between">
        <span className="font-galmuri11 text-[15px] text-ink">{label}</span>
        <span className="truncate pl-2 font-galmuri11 text-[13px] text-ink-dim">{value}</span>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { session, signOut } = useAuth()
  const myId = session?.user.id
  const navigate = useNavigate()

  const [info, setInfo] = useState(null)
  const [showSettings, setShowSettings] = useState(false)   // 내 정보 변경 모달
  const [editField, setEditField] = useState(null)          // 'nickname' | 'birthday' | 'bio'
  const [draft, setDraft] = useState('')
  const [slotIndex, setSlotIndex] = useState(null)
  const [myItems, setMyItems] = useState([])
  const [busy, setBusy] = useState(false)

  const load = () => {
    if (!myId) return
    getProfileFull(myId).then(setInfo)
  }
  useEffect(load, [myId])

  const openSlot = async (i) => {
    setSlotIndex(i)
    if (myItems.length === 0) {
      const items = await getMyItems(myId)
      setMyItems(items.filter((it) => it.meta_status === 'done'))
    }
  }

  const pickItem = async (item) => {
    const ids = [...(info.profile.rep_item_ids || [])]
    while (ids.length < 3) ids.push(null)
    ids[slotIndex] = item ? item.id : null
    await setRepItems(myId, ids.filter(Boolean))
    setSlotIndex(null)
    load()
  }

  const startEdit = (field) => {
    setEditField(field)
    if (field === 'nickname') setDraft(info.profile.nickname ?? '')
    else if (field === 'birthday') setDraft(info.profile.birthday ? String(info.profile.birthday).slice(0, 10) : '')
    else setDraft(info.profile.bio ?? '')
  }

  const saveField = async () => {
    setBusy(true)
    try {
      const fields =
        editField === 'nickname' ? { nickname: draft.trim() || null } :
        editField === 'birthday' ? { birthday: draft || null } :
        { bio: draft.trim() || null }
      const r = await updateProfile(myId, fields)
      if (!r.ok && r.reason === 'duplicate') {
        alert('이미 사용 중인 닉네임입니다.')
        return
      }
      setEditField(null)
      load()
    } catch (err) {
      alert('저장 실패: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) await signOut()
  }

  const handleDeleteAccount = async () => {
    const ok = confirm('정말 회원탈퇴 하시겠습니까?\n작성한 모든 일기와 아이템, 친구 관계가 삭제되며 되돌릴 수 없습니다.')
    if (!ok) return
    try {
      await deleteMyAccount(myId)
      alert('회원탈퇴가 완료되었습니다.')
      await signOut()
    } catch (err) {
      alert('탈퇴 처리 중 오류: ' + err.message)
    }
  }

  if (!info) {
    return (
      <div className="flex h-full items-center justify-center font-galmuri11 text-[11px] text-white">
        불러오는 중...
      </div>
    )
  }

  const nickname = info.profile.nickname ?? info.profile.full_name ?? '이름 없음'
  const repSlots = [0, 1, 2].map((i) => info.repItems?.[i] ?? null)

  return (
    <div className="relative flex h-full flex-col px-[5%] py-[4%]">

      {/* ── 닉네임 ── */}
     <p className="absolute left-0 right-0 top-[17%] flex-none text-center font-galmuri9 text-[18px] text-black text-outline"
         style={{ '--outline': '#FFFF' }}>
        {nickname}
      </p>

      {/* ── 아바타 + 좌측 버튼 ── */}
      <div className="relative mt-[8%] flex flex-none justify-center">
        {/* 좌측 세로 버튼 — 커스텀 / 프로필 설정 */}
        <div className="absolute left-2 top-35 flex flex-col gap-[14%]">
          <button onClick={() => navigate('/customize')} aria-label="아바타 꾸미기"
                  className="btn-icon w-[46px]">
            <img src="/assets/ui/ProfileCustom.png" alt="" className="block w-full select-none" draggable={false} />
          </button>
          <button onClick={() => setShowSettings(true)} aria-label="내 정보 변경"
                  className="btn-icon absolute top-14 w-[46px]">
            <img src="/assets/ui/ProfileSetting.png" alt="" className="block w-full select-none" draggable={false} />
          </button>
        </div>

        {/* 임시 아바타 — 단상 에셋 나오면 아래에 깔면 됨 */}
        <img src="/assets/char/Avatar.png" alt=""
             className="pixel absolute top-35 w-[35%] select-none" draggable={false} />
      </div>

      {/* ── 정보 카드 ── */}
      <div className="mt-auto translate-y-[-15px] flex-none rounded-[12px] border-2 border-border bg-surface p-[4%]">
        <div className="flex flex-col gap-2">
          <InfoBar label="플레이어 ID" value={info.profile.email ?? session?.user?.email ?? '-'} />
          <InfoBar label="생일" value={fmtBirthday(info.profile.birthday)} />
          <InfoBar label="일기작성 횟수" value={`${info.diaryCount ?? 0}회`} />
        </div>

        {/* 대표 아이템 */}
        <div className="relative translate-y-[-12px] mt-[15%] w-[35%]">
          <img src="/assets/ui/Profile_ItemBar.png" alt=""
               className="block w-full select-none" draggable={false} />
          <span className="absolute inset-x-0 bottom-[12%] top-0 flex items-center justify-center font-galmuri9 text-[15px] text-ink">
            대표 아이템
          </span>
        </div>

        <div className="translate-y-[-15px] mt-[5%] flex gap-[8%]">
          {repSlots.map((it, i) => (
            <button key={i} onClick={() => openSlot(i)} aria-label={`대표 아이템 ${i + 1}`}
                    className="btn-icon relative w-[28%]">
              <img src="/assets/ui/ProfileItem.png" alt=""
                   className="block w-full select-none" draggable={false} />
              {it && (
                <img src={it.image_url} alt={it.name}
                     className="pixel absolute inset-[14%] h-[72%] w-[72%] object-contain"
                     draggable={false} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 뒤로가기 ── */}
      <div className="translate-y-[30px] mt-[-6%] flex flex-none items-center">
        <button onClick={() => navigate('/')} aria-label="홈으로" className="btn-icon w-[15%]">
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>
      </div>

      {/* ── 내 정보 변경 모달 ── */}
      {showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-[6%] backdrop-blur-sm"
             onClick={() => { setShowSettings(false); setEditField(null) }}>
          <div className="relative w-full rounded-[10px] border-2 border-border bg-surface px-[7%] py-[12%] shadow-[3px_3px_0_rgba(0,0,0,0.25)]"
               onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setShowSettings(false); setEditField(null) }} aria-label="닫기"
                    className="btn-icon absolute right-[3%] top-[3%] w-[8%]">
              <img src="/assets/ui/XButton.png" alt="" className="block w-full" draggable={false} />
            </button>

            <h3 className="text-center font-galmuri9 text-[24px] text-white text-outline"
                style={{ '--outline': '#1f241a' }}>
              내 정보 변경
            </h3>
            <div className="mt-[6%] border-b-2 border-border" />

            {editField === null ? (
              <div className="mt-[9%] flex flex-col gap-[5%]">
                <button onClick={() => startEdit('nickname')}
                        className="btn-icon flex items-center justify-between py-4">
                  <span className="font-galmuri11 text-[16px] text-ink">닉네임</span>
                  <span className="flex items-center gap-2 font-galmuri11 text-[14px] text-ink-dim">
                    {info.profile.nickname ?? '미설정'} <span className="text-[13px]">›</span>
                  </span>
                </button>

                <button onClick={() => startEdit('birthday')}
                        className="btn-icon flex items-center justify-between py-1">
                  <span className="font-galmuri11 text-[16px] text-ink">생일</span>
                  <span className="flex items-center gap-2 font-galmuri11 text-[14px] text-ink-dim">
                    {fmtBirthday(info.profile.birthday)} <span className="text-[13px]">›</span>
                  </span>
                </button>

                <button onClick={() => startEdit('bio')}
                        className="btn-icon flex items-center justify-between py-1">
                  <span className="font-galmuri11 text-[16px] text-ink">한 줄 소개</span>
                  <span className="flex items-center gap-2 font-galmuri11 text-[14px] text-ink-dim">
                    <span className="max-w-[120px] truncate">{info.profile.bio || '미설정'}</span>
                    <span className="text-[13px]">›</span>
                  </span>
                </button>

                <p className="mt-[20%] text-center font-galmuri11 text-[11px] text-ink-dim">
                  정보 변경 후 바로 프로필에 적용됩니다.
                </p>

                {/* 계정 관리 — 목업엔 없지만 들어갈 자리가 여기뿐이라 묶어둠 */}
                <div className="translate-y-[14px] mt-[6%] flex gap-2 border-t border-border pt-[5%]">
                  <button onClick={handleLogout}
                          className="flex-1 rounded-full border-2 border-border py-2 font-galmuri9 text-[14px] text-ink-dim">
                    로그아웃
                  </button>
                  <button onClick={handleDeleteAccount}
                          className="flex-1 rounded-full border-2 border-accent-2 py-2 font-galmuri9 text-[14px] text-accent-2">
                    회원탈퇴
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-[6%]">
                <p className="font-galmuri11 text-[11px] text-ink">
                  {editField === 'nickname' ? '닉네임' : editField === 'birthday' ? '생일' : '한 줄 소개'}
                </p>
                {editField === 'nickname' ? (
                  <input value={draft} maxLength={12}
                         onChange={(e) => setDraft(e.target.value)}
                         className="mt-2 w-full rounded-[6px] border-2 border-border px-2 py-1 font-galmuri11" />
                ) : editField === 'birthday' ? (
                  <input type="date" value={draft}
                         onChange={(e) => setDraft(e.target.value)}
                         className="mt-2 w-full rounded-[6px] border-2 border-border px-2 py-1 font-galmuri11" />
                ) : (
                  <input value={draft} maxLength={30}
                         placeholder="안녕하세요."
                         onChange={(e) => setDraft(e.target.value)}
                         className="mt-2 w-full rounded-[6px] border-2 border-border px-2 py-1 font-galmuri11" />
                )}

                <div className="mt-[6%] flex gap-2">
                  <button onClick={saveField} disabled={busy}
                          className="flex-1 rounded-full border-2 border-line py-2 font-galmuri9 text-[11px] font-bold text-ink disabled:opacity-50"
                          style={{ backgroundColor: '#E1FF96' }}>
                    확인
                  </button>
                  <button onClick={() => setEditField(null)}
                          className="flex-1 rounded-full border-2 border-border py-2 font-galmuri9 text-[11px] text-ink-dim">
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 대표 아이템 선택 모달 ── */}
      {slotIndex !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-[6%] backdrop-blur-sm"
             onClick={() => setSlotIndex(null)}>
          <div className="max-h-[85%] w-full overflow-hidden rounded-[10px] border-2 border-border bg-surface"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-border px-4 py-4">
              <h3 className="font-galmuri9 text-[18px]  text-ink">대표 아이템 선택</h3>
              <button onClick={() => pickItem(null)}
                      className="btn-icon font-galmuri11 text-[12px] text-ink-dim underline">
                비우기
              </button>
            </div>

            <div className="no-scrollbar max-h-[55dvh] overflow-y-auto p-3">
              {myItems.length === 0 ? (
                <p className="py-8 text-center font-galmuri11 text-[12px] text-ink-dim">아이템이 없어요.</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {myItems.map((it) => {
                    const rarity = RARITY_TABLE[it.rarity] || RARITY_TABLE.normal
                    return (
                      <button key={it.id} onClick={() => pickItem(it)}
                              className="btn-icon flex flex-col items-center">
                        <img src={it.image_url} alt={it.name}
                             className="pixel h-16 w-16 rounded-[5px] border-2 border-border"
                             style={{ backgroundColor: rarity.color + '22' }} />
                        <span className="mt-1 line-clamp-1 font-galmuri11 text-[10px] text-ink">{it.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}