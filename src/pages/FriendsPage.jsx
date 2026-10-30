import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  searchUserByEmail,
  sendFriendRequest,
  getReceivedRequests,
  acceptFriendRequest,
  getMyFriends,
  removeFriend
} from '../lib/friendService'

import { getProfileFull } from '../lib/profileService'
import ProfileCard from '../components/ProfileCard'

/** MiniWindowBar.png의 세로 비율 (1610×143) */
const WINDOWBAR_RATIO = 143 / 1610

/** 'YYYY-MM-DD' → '11월 27일' */
const fmtBirthday = (b) => {
  if (!b) return '미설정'
  const [, m, d] = String(b).slice(0, 10).split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/** 정보 캡슐 한 줄 — 프로필 페이지와 같은 에셋 */
function InfoBar({ label, value }) {
  return (
    <div className="relative w-full">
      <img src="/assets/ui/ProfileBar.png" alt="" className="block w-full select-none" draggable={false} />
      <div className="absolute inset-x-[5%] inset-y-0 flex items-center justify-between">
        <span className="font-galmuri11 text-[14px] text-ink">{label}</span>
        <span className="truncate pl-2 font-galmuri11 text-[12px] text-ink-dim">{value}</span>
      </div>
    </div>
  )
}

export default function FriendsPage() {
  const { session } = useAuth()
  const myId = session?.user.id
  const navigate = useNavigate()

  const [keyword, setKeyword] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [requests, setRequests] = useState([])
  const [friends, setFriends] = useState([])
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(null)

  const [showFinder, setShowFinder] = useState(false)
  const [finderTab, setFinderTab] = useState('search')   // search | requests

  const refresh = async () => {
    if (!myId) return
    const [reqs, fr] = await Promise.all([
      getReceivedRequests(myId),
      getMyFriends(myId),
    ])
    setRequests(reqs)
    setFriends(fr)
  }

  useEffect(() => { refresh() }, [myId])

  const handleSearch = async () => {
    const q = keyword.trim()
    if (!q) return
    setBusy(true)
    try {
      const user = await searchUserByEmail(q)
      setSearchResult(user ?? 'none')
    } catch (err) {
      alert('검색 오류: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSendRequest = async () => {
    setBusy(true)
    try {
      const result = await sendFriendRequest(myId, searchResult.id)
      const messages = {
        self: '자기 자신에게는 신청할 수 없습니다.',
        already_friend: '이미 친구입니다.',
        already_pending: '이미 신청을 보냈거나 받은 상태입니다.',
      }
      if (result.ok) {
        alert('친구 신청을 보냈습니다.')
        setSearchResult(null)
        setKeyword('')
      } else {
        alert(messages[result.reason] ?? '신청할 수 없습니다.')
      }
    } catch (err) {
      alert('신청 오류: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleAccept = async (requestId) => {
    setBusy(true)
    try {
      const result = await acceptFriendRequest(requestId)
      if (!result || result.length === 0) {
        alert('이미 처리된 요청입니다.')
      }
      await refresh()
    } catch (err) {
      alert('수락 오류: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = (p) => p?.nickname ?? p?.full_name ?? p?.email ?? '알 수 없음'

  const closeFinder = () => {
    setShowFinder(false)
    setKeyword('')
    setSearchResult(null)
  }

    return (
    <div className="flex h-full flex-col px-[3.5%] py-[3%]">
      {/* ── 상단 탭 ── */}
      <div className="relative z-10 flex-none">
        {showFinder ? (
          <>
            <img
              src={finderTab === 'search' ? '/assets/ui/FriendFind.png' : '/assets/ui/FriendRequest.png'}
              alt={finderTab === 'search' ? '친구 찾기' : '친구 요청'}
              className="block w-full select-none"
              draggable={false}
            />
            <button onClick={() => setFinderTab('search')} aria-label="친구 찾기"
                    className="btn-icon absolute inset-y-0 left-0 w-1/2" />
            <button onClick={() => setFinderTab('requests')} aria-label="친구 요청"
                    className="btn-icon absolute inset-y-0 right-0 w-1/2">
              {requests.length > 0 && (
                <span className="absolute right-[6%] top-[10%] flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-accent-2 px-1 font-galmuri9 text-[8px] text-white">
                  {requests.length}
                </span>
              )}
            </button>
          </>
        ) : (
          <img src="/assets/ui/FriendCatalog.png" alt="친구 목록"
               className="block w-full select-none" draggable={false} />
        )}
      </div>

      {/* ── 내용 박스 ── */}
      <div className="no-scrollbar mt-[-3%] min-h-0 flex-1 overflow-y-auto rounded-[6px] border-2 border-border bg-surface px-[3%] pb-[3%] pt-[7%]">
        {!showFinder ? (
          /* 친구 목록 */
          friends.length === 0 ? (
            <p className="mt-8 text-center font-galmuri11 text-[10px] text-ink-dim">
              아직 친구가 없어요.<br />아래 친구 추가에서 닉네임으로 검색해보세요.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {friends.map((f) => (
                <button
                  key={f.relationId}
                  onClick={async () => {
                    const d = await getProfileFull(f.id)
                    setViewing({ relationId: f.relationId, ...d })
                  }}
                  className="flex w-full items-center gap-2 rounded-[6px] bg-surface-2 p-1.5 text-left"
                >
                  <img src="/assets/char/Portrait.png" alt=""
                       className="h-10 w-10 flex-none rounded-full border-1 border-border bg-white object-cover"
                       draggable={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-galmuri9 text-[11px] font-bold text-ink">{label(f)}</p>
                    <p className="mt-0.5 truncate rounded-[4px] bg-white px-2 py-0.5 font-galmuri11 text-[9px] text-ink-dim">
                      {f.bio || '한 줄 소개가 없어요'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : finderTab === 'search' ? (
          /* 친구 찾기 */
          <div>
            <div className="flex items-center gap-2 rounded-full border-2 border-border bg-surface-2 px-3 py-1">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="친구 닉네임 입력"
                className="min-w-0 flex-1 bg-transparent font-galmuri11 outline-none placeholder:text-ink-dim"
              />
              <button onClick={handleSearch} disabled={busy} aria-label="검색"
                      className="btn-icon flex-none px-1 disabled:opacity-50">
                <img src="/assets/icons/search.png" alt="" className="pixel h-5 w-5" draggable={false} />
              </button>
            </div>

            {searchResult === 'none' && (
              <p className="mt-4 text-center font-galmuri11 text-[10px] text-ink-dim">
                해당 닉네임의 사용자를 찾을 수 없습니다.
              </p>
            )}

            {searchResult && searchResult !== 'none' && (
              <>
                <div className="mt-3 flex items-center gap-3 rounded-[6px] bg-surface-2 p-2">
                  <img src="/assets/char/Portrait.png" alt=""
                       className="h-12 w-12 flex-none rounded-full border-2 border-border bg-white object-cover"
                       draggable={false} />
                  <span className="truncate font-galmuri9 text-[12px] font-bold text-ink">
                    {label(searchResult)}
                  </span>
                </div>

                <div className="mt-3 flex justify-center">
                  <button onClick={handleSendRequest} disabled={busy}
                          className="btn-icon w-[22%] min-w-[80px] disabled:opacity-50">
                    <img src="/assets/ui/FriendApplication.png" alt="친구 신청"
                         className="block h-auto w-full select-none" draggable={false} />
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* 친구 요청 */
          requests.length === 0 ? (
            <p className="mt-8 text-center font-galmuri11 text-[10px] text-ink-dim">
              받은 요청이 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 rounded-[6px] bg-surface-2 p-2">
                  <img src="/assets/char/Portrait.png" alt=""
                       className="h-12 w-12 flex-none rounded-full border-2 border-border bg-white object-cover"
                       draggable={false} />
                  <span className="min-w-0 flex-1 truncate font-galmuri9 text-[12px] font-bold text-ink">
                    {label(req.requester)}
                  </span>
                  <button onClick={() => handleAccept(req.id)} disabled={busy}
                          className="flex-none rounded-full border-2 border-line bg-accent px-3 py-1.5 font-galmuri9 text-[11px] font-bold text-accent-ink disabled:opacity-50">
                    수락
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="mt-[3%] flex flex-none items-center justify-between">
        <button
          onClick={() => (showFinder ? closeFinder() : navigate('/'))}
          aria-label={showFinder ? '친구 목록으로' : '홈으로'}
          className="btn-icon w-[13%]"
        >
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>

        {!showFinder && (
          <button onClick={() => setShowFinder(true)}
                  className="btn-icon relative w-[20%] min-w-[110px] flex-none">
            <img src="/assets/ui/FriendAdd.png" alt="친구 추가"
                 className="block h-auto w-full select-none" draggable={false} />
            {requests.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-accent-2 px-1 font-galmuri9 text-[8px] text-white">
                {requests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── 친구 상세 모달 ── */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
             onClick={() => setViewing(null)}>
          <div className="relative flex max-h-[80dvh] w-full max-w-[340px] flex-col overflow-hidden rounded-[10px] border-2 border-border bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
               onClick={(e) => e.stopPropagation()}>

            {/* 타이틀바 높이만큼 자리 확보 */}
            <div className="flex-none"
                 style={{ paddingTop: `${(WINDOWBAR_RATIO * 100).toFixed(2)}%` }}
                 aria-hidden="true" />

            {/* 본문 */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-[5%]">
              {/* 한 줄 소개 */}
              <p className="text-center font-galmuri11 text-[13px] text-ink-dim">
                “{viewing.profile.bio || '한 줄 소개가 없어요'}”
              </p>

              {/* 정보 캡슐 */}
              <div className="mt-[6%] flex flex-col gap-2">
                <InfoBar label="닉네임"
                         value={viewing.profile.nickname ?? viewing.profile.full_name ?? '-'} />
                <InfoBar label="생일" value={fmtBirthday(viewing.profile.birthday)} />
                <InfoBar label="일기 작성 횟수" value={`${viewing.diaryCount ?? 0}회`} />
              </div>

              {/* 대표 아이템 */}
              <div className="relative mt-[8%] w-[40%]">
                <img src="/assets/ui/Profile_ItemBar.png" alt=""
                     className="block w-full select-none" draggable={false} />
                <span className="absolute inset-x-0 bottom-[12%] top-0 flex items-center justify-center font-galmuri9 text-[14px] text-ink">
                  대표 아이템
                </span>
              </div>

              <div className="mt-[4%] flex gap-[8%]">
                {[0, 1, 2].map((i) => {
                  const it = viewing.repItems?.[i] ?? null
                  return (
                    <div key={i} className="relative w-[28%]">
                      <img src="/assets/ui/ProfileItem.png" alt=""
                           className="block w-full select-none" draggable={false} />
                      {it && (
                        <img src={it.image_url} alt={it.name}
                             className="pixel absolute inset-[14%] h-[72%] w-[72%] object-contain"
                             draggable={false} />
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={async () => {
                  if (!confirm('친구를 삭제할까요?')) return
                  await removeFriend(viewing.relationId)
                  setViewing(null)
                  await refresh()
                }}
                className="mt-[8%] w-full rounded-full border-2 border-accent-2 bg-white py-2 font-galmuri9 text-[12px] font-bold text-accent-2">
                친구 삭제
              </button>
            </div>

            {/* 타이틀바 — 본문 위에 겹쳐 그림 */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <img src="/assets/ui/MiniWindowBar.png" alt=""
                   className="block w-full select-none" draggable={false} />
              <span className="absolute inset-y-0 left-[10%] right-[9%] flex items-center truncate font-galmuri9 text-[13px] font-normal text-ink">
                {viewing.profile.nickname ?? viewing.profile.full_name}
              </span>
              <button onClick={() => setViewing(null)} aria-label="닫기"
                      className="btn-icon pointer-events-auto absolute inset-y-0 right-[1.4%] w-[6%]" />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}