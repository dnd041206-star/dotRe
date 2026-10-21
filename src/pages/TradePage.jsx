import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'
import { getMyFriends } from '../lib/friendService'
import {
  getTradableItems, tradeItem,
  getPendingTrades, receiveTrade, discardTrade,
  getReceivedItems, getPendingTradeCount,
} from '../lib/tradeService'
import { RARITY_TABLE, STAT_KEYS, STAT_LABELS, statPercent } from '../game/statSystem'
import { useNavigate } from 'react-router-dom'
import { gradeIcon } from '../game/gradeIcons'

const FAIL_MESSAGES = {
  not_pending: '이미 처리된 아이템이에요.',
  not_found: '거래 정보를 찾을 수 없어요.',
  original_missing: '원본 아이템을 불러올 수 없어요. (items SELECT 권한 확인 필요)',
  copy_blocked: '아이템을 보관함에 넣지 못했어요. (items INSERT 권한 확인 필요)',
}
/** MiniWindowBar.png의 세로 비율 (1610×143) */
const WINDOWBAR_RATIO = 143 / 1610

export default function TradePage() {
  const { session } = useAuth()
  const myId = session?.user.id
  const navigate = useNavigate()
  const [friends, setFriends] = useState([])
  const [items, setItems] = useState([])
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  const [picker, setPicker] = useState(null)       // 'item' | 'friend' | null

  const [showBox, setShowBox] = useState(false)
  const [boxTab, setBoxTab] = useState('pending')   // pending | received
  const [pending, setPending] = useState([])
  const [received, setReceived] = useState([])
  const [boxLoading, setBoxLoading] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!myId) return
    const [fr, it, pc] = await Promise.all([
      getMyFriends(myId),
      getTradableItems(myId),
      getPendingTradeCount(myId),
    ])
    setFriends(fr)
    setItems(it)
    setPendingCount(pc)
  }

  useEffect(() => { refresh() }, [myId])

  const openBox = async () => {
    setShowBox(true)
    setBoxLoading(true)
    try {
      const [pd, rc] = await Promise.all([
        getPendingTrades(myId),
        getReceivedItems(myId),
      ])
      setPending(pd)
      setReceived(rc)
    } catch (err) {
      alert('보관함을 불러오지 못했습니다: ' + err.message)
    } finally {
      setBoxLoading(false)
    }
  }

   const handleReceive = async (tradeId) => {
    setDecidingId(tradeId)
    try {
      const r = await receiveTrade(tradeId)
      if (!r.ok) {
        alert(FAIL_MESSAGES[r.reason] ?? `수령 실패 (${r.reason})`)
        setPending(await getPendingTrades(myId))
        return
      }
      setPending((p) => p.filter((t) => t.tradeId !== tradeId))
      setReceived(await getReceivedItems(myId))
      setPendingCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error('[receive] 예외:', err)
      alert('수령 오류: ' + err.message)
    } finally {
      setDecidingId(null)
    }
  }

  const handleDiscard = async (tradeId) => {
    if (!confirm('이 아이템을 받지 않고 버릴까요?')) return
    setDecidingId(tradeId)
    try {
      const r = await discardTrade(tradeId)
      if (!r.ok) {
        alert(FAIL_MESSAGES[r.reason] ?? `폐기 실패 (${r.reason})`)
        setPending(await getPendingTrades(myId))
        return
      }
      setPending((p) => p.filter((t) => t.tradeId !== tradeId))
      setPendingCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error('[discard] 예외:', err)
      alert('폐기 오류: ' + err.message)
    } finally {
      setDecidingId(null)
    }
  }

  const handleTrade = async () => {
    if (!selectedFriend || !selectedItem) return
    setBusy(true)
    try {
      const result = await tradeItem({
        myId,
        friendId: selectedFriend.id,
        myItemId: selectedItem.id,
      })
      const messages = {
        not_owner: '교환할 수 없는 아이템입니다.',
        not_ready: '아직 생성 중인 아이템이에요.',
      }
      if (result.ok) {
        alert('아이템을 보냈습니다!')
        setSelectedItem(null)
        setSelectedFriend(null)
      } else {
        alert(messages[result.reason] ?? '교환에 실패했습니다.')
      }
    } catch (err) {
      alert('교환 오류: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = (p) => p?.nickname ?? p?.full_name ?? p?.email ?? '알 수 없음'

  return (
    <div className="flex h-full flex-col px-[5%] py-[4%]">

      {/* ── 제목 ── */}
      <h2 className="mt-[20%] flex-none text-center font-galmuri9 text-[26px] font-bold text-accent-2 [text-shadow:_-1.5px_0_white,_0_1.5px_white,_1.5px_0_white,_0_-1.5px_white]"
          style={{ '--outline': '#ffffff' }}>
        교환소
      </h2>

      {/* ── 교환 카드 ── */}
      <div className="mt-[23%] flex-none rounded-[16px] bg-surface p-[6%] shadow-[3px_3px_0_rgba(0,0,0,0.15)]">
        <div className="flex items-start justify-between">

          {/* 아이템 슬롯 */}
          <button onClick={() => setPicker('item')} aria-label="아이템 선택"
                  className="btn-icon flex w-[34%] flex-col items-center">
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-2 p-[12%]">
              {selectedItem && (
                <img src={selectedItem.image_url} alt={selectedItem.name}
                     className="pixel max-h-full max-w-full object-contain" draggable={false} />
              )}
            </div>

            <span className="relative mt-[12%] block w-full">
              <img src="/assets/ui/SelectItem.png" alt=""
                   className="block w-full select-none" draggable={false} />
              <span className="absolute inset-x-[8%] inset-y-0 flex items-center justify-center">
                <span className={`w-full truncate text-center font-galmuri11 text-[14px] ${
                  selectedItem ? 'text-ink' : 'text-ink-dim'
                }`}>
                  {selectedItem ? selectedItem.name : '아이템 선택'}
                </span>
              </span>
            </span>
          </button>

          {/* 화살표 — 에셋 나오면 <img>로 교체 */}
          <span className="mt-[16%] font-galmuri9 text-[22px] text-ink">▶</span>

          {/* 친구 슬롯 */}
          <button onClick={() => setPicker('friend')} aria-label="친구 선택"
                  className="btn-icon flex w-[34%] flex-col items-center">
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-2 p-[12%]">
              {selectedFriend && (
                <img src="/assets/char/Portrait.png" alt=""
                     className="h-full w-full rounded-full object-cover" draggable={false} />
              )}
            </div>

            <span className="relative mt-[12%] block w-full">
              <img src="/assets/ui/SelectFriend.png" alt=""
                   className="block w-full select-none" draggable={false} />
              <span className="absolute inset-x-[8%] inset-y-0 flex items-center justify-center">
                <span className={`w-full truncate text-center font-galmuri11 text-[14px] ${
                  selectedFriend ? 'text-ink' : 'text-ink-dim'
                }`}>
                  {selectedFriend ? label(selectedFriend) : '친구 선택'}
                </span>
              </span>
            </span>
          </button>
        </div>

        {/* 전송 버튼 */}
        <button onClick={handleTrade}
                disabled={!selectedFriend || !selectedItem || busy}
                aria-label="전송"
                className="btn-icon mx-auto mt-[9%] block w-[48%] disabled:opacity-40">
          <img src="/assets/ui/Send.png" alt="전송"
               className="block w-full select-none" draggable={false} />
        </button>
      </div>


      {/* ── 박사 + 말풍선 ── */}
      <div className="mt-[5%] flex flex-none items-start">
        <img src="/assets/char/hakase_test.png" alt=""
             className="pixel w-[28%] flex-none select-none" draggable={false} />

        <div className="relative mt-[6%] w-[60%]">
          <img src="/assets/ui/TestBubble.png" alt=""
               className="block w-full select-none" draggable={false} />
          <div className="absolute inset-x-0 bottom-[14%] left-[16%] top-0 flex items-center justify-center pr-[6%]">
            <p className="text-center font-galmuri11 text-[13px] leading-relaxed text-ink">
              우주는 참 넓지않나<br />.......<br />오늘은 누구와 교환할건가?
            </p>
          </div>
        </div>
      </div>

      {/* ── 하단: 뒤로가기 / 보관함 ── */}
      <div className="mt-auto flex flex-none items-center justify-between pt-[4%]">
        <button onClick={() => navigate('/')} aria-label="홈으로" className="w-[13%]">
          <img src="/assets/ui/Back.png" alt="" className="block w-full select-none" draggable={false} />
        </button>

        <button onClick={openBox} aria-label="보관함"
                className="btn-icon relative w-[30%] min-w-[110px]">
          <img src="/assets/ui/StorageBox.png" alt="보관함"
               className="block h-auto w-full select-none" draggable={false} />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-accent-2 px-1 font-galmuri9 text-[8px] text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </div>



      {/* ── 아이템 / 친구 선택 창 ── */}
      {picker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4"
             onClick={() => setPicker(null)}>
          <div className="relative flex h-[66dvh] w-full max-w-[340px] flex-col overflow-hidden rounded-[10px] border-2 border-border bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
               onClick={(e) => e.stopPropagation()}>

            {/* 타이틀바 높이만큼 자리 확보 */}
            <div className="flex-none"
                 style={{ paddingTop: `${(WINDOWBAR_RATIO * 100).toFixed(2)}%` }}
                 aria-hidden="true" />

            {/* 본문 */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-[4%]">
              {picker === 'item' ? (
                items.length === 0 ? (
                  <p className="py-8 text-center font-galmuri11 text-[11px] text-ink-dim">
                    아직 만든 아이템이 없어요.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((it) => {
                      const rarity = RARITY_TABLE[it.rarity] || RARITY_TABLE.normal
                      return (
                        <button key={it.id}
                                onClick={() => { setSelectedItem(it); setPicker(null) }}
                                className="btn-icon flex flex-col items-center">
                          <img src={it.image_url} alt={it.name}
                               className={`pixel h-16 w-16 rounded-[4px] border-2 ${
                                 selectedItem?.id === it.id ? 'border-accent-2' : 'border-border'
                               }`}
                               style={{ backgroundColor: rarity.color + '22' }} />
                          <span className="mt-1 line-clamp-1 font-galmuri11 text-[10px] text-ink">{it.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              ) : (
                friends.length === 0 ? (
                  <p className="py-8 text-center font-galmuri11 text-[11px] text-ink-dim">
                    친구가 없어요. 먼저 친구를 맺어보세요.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {friends.map((f) => (
                      <button key={f.id}
                              onClick={() => { setSelectedFriend(f); setPicker(null) }}
                              className={`flex w-full items-center gap-3 rounded-[6px] border-2 p-2 text-left ${
                                selectedFriend?.id === f.id
                                  ? 'border-accent-2 bg-surface-2'
                                  : 'border-border bg-surface-2'
                              }`}>
                        <img src="/assets/char/Portrait.png" alt=""
                             className="h-12 w-12 flex-none rounded-full border-2 border-border bg-white object-cover"
                             draggable={false} />
                        <span className="min-w-0 flex-1 truncate font-galmuri9 text-[12px] font-bold text-ink">
                          {label(f)}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* 타이틀바 — 본문 위에 겹쳐 그림 */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <img src="/assets/ui/MiniWindowBar.png" alt=""
                   className="block w-full select-none" draggable={false} />
              <span className="absolute inset-y-0 left-[10%] flex items-center font-galmuri9 text-[13px] font-regular text-ink">
                {picker === 'item' ? '보낼 아이템' : '보낼 친구'}
              </span>
              <button onClick={() => setPicker(null)} aria-label="닫기"
                      className="btn-icon pointer-events-auto absolute inset-y-0 right-[1.4%] w-[6%]" />
            </div>
          </div>
        </div>
      )}

      {showBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
             onClick={() => setShowBox(false)}>
          <div className="relative flex h-[72dvh] w-full max-w-[360px] flex-col overflow-hidden rounded-[10px] border-2 border-border bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
               onClick={(e) => e.stopPropagation()}>

            {/* 타이틀바 높이만큼 자리 확보 */}
            <div className="flex-none"
                 style={{ paddingTop: `${(WINDOWBAR_RATIO * 100).toFixed(2)}%` }}
                 aria-hidden="true" />

            {/* 본문 */}
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-[4%]">
              {/* 탭 — 이미지 1장을 상태별로 통째 교체, 좌우 절반이 클릭 영역 */}
               <div className="relative mx-auto w-[76%]">
                <img
                  src={boxTab === 'pending'
                    ? '/assets/ui/BoxTabList.png'
                    : '/assets/ui/BoxTabReceived.png'}
                  alt={boxTab === 'pending' ? '목록' : '수령 기록'}
                  className="block w-full  select-none"
                  draggable={false}
                />
                <button onClick={() => setBoxTab('pending')} aria-label="목록"
                        className="btn-icon absolute inset-y-0 left-0 w-1/2">
                  {pending.length > 0 && (
                    <span className="absolute right-[8%] top-[10%] flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-accent-2 px-1 font-galmuri9 text-[8px] text-white">
                      {pending.length}
                    </span>
                  )}
                </button>
                <button onClick={() => setBoxTab('received')} aria-label="수령 기록"
                        className="btn-icon absolute inset-y-0 right-0 w-1/2" />
              </div>

              <div className="mt-[4%]">
                {boxLoading ? (
                  <p className="py-8 text-center font-galmuri11 text-[11px] text-ink-dim">불러오는 중...</p>
                ) : boxTab === 'pending' ? (
                  pending.length === 0 ? (
                    <p className="py-8 text-center font-galmuri11 text-[11px] text-ink-dim">
                      새로 도착한 아이템이 없어요.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pending.map((t) => {
                        const it = t.item
                        const rarity = it ? (RARITY_TABLE[it.rarity] || RARITY_TABLE.normal) : RARITY_TABLE.normal
                        const deciding = decidingId === t.tradeId
                        return (
                          <div key={t.tradeId}
                               className="flex items-center gap-3 rounded-[6px] border-2 border-border bg-surface-2 p-2">
                            {it ? (
                              <img src={it.image_url} alt={it.name}
                                   className="pixel h-14 w-14 flex-none rounded-[4px] border-2 border-border"
                                   style={{ backgroundColor: rarity.color + '22' }} />
                            ) : (
                              <div className="h-14 w-14 flex-none rounded-[4px] border-2 border-border bg-white" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 font-galmuri9 text-[12px] font-bold text-ink">
                                {it?.name ?? '알 수 없는 아이템'}
                              </p>
                              <p className="mt-0.5 line-clamp-1 font-galmuri11 text-[10px] text-ink-dim">
                                {t.sender?.nickname ?? t.sender?.full_name ?? '알 수 없음'} 님이 보냄
                              </p>
                            </div>
                            <div className="flex flex-none flex-col gap-1">
                              <button onClick={() => handleReceive(t.tradeId)} disabled={deciding}
                                      className="btn-icon rounded-full border-1 border-line bg-accent-2 px-3 py-1 font-galmuri9 text-[10px] font-regular text-white disabled:opacity-50">
                                수령
                              </button>
                              <button onClick={() => handleDiscard(t.tradeId)} disabled={deciding}
                                      className="btn-icon rounded-full border-1 border-border bg-white px-3 py-1 font-galmuri9 text-[10px] text-ink-dim disabled:opacity-50">
                                폐기
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  received.length === 0 ? (
                    <p className="py-8 text-center font-galmuri11 text-[11px] text-ink-dim">
                      아직 수령한 아이템이 없어요.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {received.map((it) => {
                        const rarity = RARITY_TABLE[it.rarity] || RARITY_TABLE.normal
                        return (
                          <button key={it.id} onClick={() => setDetail(it)}
                                  className="btn-icon flex flex-col items-center">
                            <img src={it.image_url} alt={it.name}
                                 className="pixel h-16 w-16 rounded-[4px] border-2 border-border"
                                 style={{ backgroundColor: rarity.color + '22' }} />
                            <span className="mt-1 line-clamp-1 font-galmuri11 text-[10px] text-ink">{it.name}</span>
                            <span className="line-clamp-1 font-galmuri11 text-[9px] text-ink-dim">
                              {it.sender?.nickname ?? it.sender?.full_name ?? '?'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* 타이틀바 — 본문 위에 겹쳐 그림 */}
            <div className="pointer-events-none absolute inset-x-0 top-0">
              <img src="/assets/ui/MiniWindowBar.png" alt=""
                   className="block w-full select-none" draggable={false} />
              <span className="absolute inset-y-0 left-[10%] flex items-center font-galmuri9 text-[13px] font-regular text-ink">
                보관함
              </span>
              {/* 에셋에 그려진 X 위에 얹는 투명 클릭 영역 */}
              <button onClick={() => setShowBox(false)} aria-label="닫기"
                      className="btn-icon pointer-events-auto absolute inset-y-0 right-[1.4%] w-[6%]" />
            </div>
          </div>
        </div>
      )}

      {detail && (() => {
        const rarity = RARITY_TABLE[detail.rarity] || RARITY_TABLE.normal
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
               onClick={() => setDetail(null)}>
            <div className="relative flex max-h-[80dvh] w-full max-w-[340px] flex-col overflow-hidden rounded-[10px] border-2 border-border bg-surface shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
                 onClick={(e) => e.stopPropagation()}>

              {/* 타이틀바 높이만큼 자리 확보 */}
              <div className="flex-none"
                   style={{ paddingTop: `${(WINDOWBAR_RATIO * 100).toFixed(2)}%` }}
                   aria-hidden="true" />

              {/* 본문 */}
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-[4%]">
                <div className="flex flex-col items-center">
                  <img src={detail.image_url} alt={detail.name}
                       className="pixel h-28 w-28 rounded-[6px] border-2 border-border"
                       style={{ backgroundColor: rarity.color + '22' }} />
                  <img src={gradeIcon(detail.rarity)} alt={rarity.label}
                       className="mt-2 w-[18%] select-none" draggable={false} />
                  <p className="mt-2 whitespace-pre-line text-center font-galmuri11 text-[11px] leading-relaxed text-ink-dim">
                    {detail.description}
                  </p>
                </div>

                {detail.sender && (
                  <div className="mt-[4%] rounded-[6px] border-2 border-border bg-surface-2 p-2 text-center">
                    <p className="font-galmuri11 text-[9px] text-ink-dim">보낸 사람</p>
                    <p className="mt-0.5 font-galmuri9 text-[12px] font-bold text-ink">
                      {detail.sender.nickname ?? detail.sender.full_name}
                    </p>
                    {detail.sender.bio && (
                      <p className="mt-0.5 font-galmuri11 text-[10px] text-ink-dim">“{detail.sender.bio}”</p>
                    )}
                    <p className="mt-1 font-galmuri11 text-[9px] text-ink-dim">
                      {String(detail.created_at).slice(0, 10)} 도착
                    </p>
                  </div>
                )}

                <div className="mt-[4%] rounded-[6px] border-2 border-border bg-surface-2 p-2">
                  {STAT_KEYS.map((k) => (
                    <div key={k} className="mb-2 flex items-center gap-2 last:mb-0">
                      <span className="flex w-16 flex-none items-center gap-1 font-galmuri11 text-[11px] text-ink">
                        <img src={STAT_LABELS[k].icon} alt=""
                             className="pixel h-4 w-4 flex-none" draggable={false} />
                        {STAT_LABELS[k].ko}
                      </span>
                      <div className="h-2 flex-1 rounded-full border border-border bg-white">
                        <div className="h-full rounded-full"
                             style={{ width: `${statPercent(detail.stats?.[k] ?? 0)}%`,
                                      backgroundColor: STAT_LABELS[k].color }} />
                      </div>
                      <span className="w-7 text-right font-galmuri9 text-[10px] font-bold text-ink">
                        {detail.stats?.[k] ?? 0}
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 text-right font-galmuri11 text-[9px] text-ink-dim">
                    아이템 종합치 {detail.power}
                  </p>
                </div>
              </div>

              {/* 타이틀바 — 본문 위에 겹쳐 그림 */}
              <div className="pointer-events-none absolute inset-x-0 top-0">
                <img src="/assets/ui/MiniWindowBar.png" alt=""
                     className="block w-full select-none" draggable={false} />
                <span className="absolute inset-y-0 left-[10%] right-[9%] flex items-center truncate font-galmuri9 text-[13px] font-regular text-ink">
                  {detail.name}
                </span>
                <button onClick={() => setDetail(null)} aria-label="닫기"
                        className="btn-icon pointer-events-auto absolute inset-y-0 right-[1.4%] w-[6%]" />
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}