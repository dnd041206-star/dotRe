const MENU_TABS = ['Exchange', 'Calendar', 'Report', 'Friends']

const WINDOW_MAX_W = '90%' // 창 최대 가로 폭 (세로가 넉넉한 화면에서 과하게 넓어지지 않게)
const WINDOW_RATIO = 1.7   // 명세서 목업 창 비율(세로÷가로)

const WINDOWBAR_RATIO = 318 / 1610 // ≈ 0.1975

/** bare=true → 창 크기/테두리만 쓰고 타이틀바·메뉴탭은 그리지 않음 (상점 등)
 *  bg        → 창 본체 전체 배경 이미지. 타이틀바 뒤까지 덮는다 (방 편집 등) */
export default function RetroWindow({ title = 'Dotre Lab - Report', activeTab = null, bare = false, bg = null, children }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <div
        className="relative flex min-h-0 flex-col shadow-[4px_4px_0_rgba(0,0,0,0.35)]"
        style={{ height: '100%', aspectRatio: `1 / ${WINDOW_RATIO}`, maxWidth: WINDOW_MAX_W }}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border-2 border-border bg-surface text-black"
          style={{ backgroundColor: '#ffffff' }}
        >
          {bg && (
            <img
              src={bg}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
              draggable={false}
            />
          )}

          {!bare && (
            <div
              className="relative flex-none"
              style={{ paddingTop: `${(WINDOWBAR_RATIO * 100).toFixed(2)}%` }}
              aria-hidden="true"
            />
          )}

          <div className="relative flex min-h-0 flex-1 flex-col">
            {children}
          </div>
        </div>

        {!bare && (
          <div className="absolute inset-x-0 top-0">
            <img
              src="/assets/ui/WindowBar.png"
              alt=""
              className="block w-full h-auto select-none"
              draggable={false}
            />
            <span className="absolute left-[10%] top-[6%] font-galmuri9 text-[16px] text-accent-ink">
              {title}
            </span>
            <div
              className="absolute inset-x-0 left-[7%] top-[62%] flex gap-10 overflow-x-auto px-3 font-galmuri9 text-[12px] text-ink-dim"
              aria-hidden="true"
            >
              {MENU_TABS.map((m) => (
                <span
                  key={m}
                  className={`flex-none pb-0.5 ${
                    m === activeTab ? 'border-b-2 border-accent-2 text-ink' : ''
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}