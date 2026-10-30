import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import ProtectedRoute from './components/ProtectedRoute'
import RetroWindow from './components/RetroWindow'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import FriendsPage from './pages/FriendsPage'
import WeeklyPage from './pages/WeeklyPage'
import TradePage from './pages/TradePage'
import DiaryWritePage from './pages/DiaryWritePage'
import ProfilePage from './pages/ProfilePage'
import ItemResultPage from './pages/ItemResultPage'
import SettingsPage from './pages/SettingsPage'
import ShopPage from './pages/ShopPage'
import RoomEditPage from './pages/RoomEditPage'
import CustomizePage from './pages/CustomizePage'
import BgmPlayer from './components/BgmPlayer'
import AdminPage from './pages/AdminPage'


/** 앱 셸 — 세로 플렉스. 본문만 스크롤되고 탭바는 항상 바닥에.
 *  withWindow=false → 레트로윈도우 없이 본문만
 *  windowBare=true  → 창 크기/테두리만 쓰고 타이틀바·메뉴탭은 없음 (상점)
 *  whiteBg=true     → 셸 배경을 흰색으로 (교환·주간평가)
 *  mainFlush=true   → 본문 여백 0, 배경이 창 끝까지 (상점·방 편집) */
function Shell({
  withTabBar = true,
  withWindow = true,
  windowBare = false,
  whiteBg = false,
  mainFlush = false,
  windowBg = null
}) {
  return (
    <div className={`shell${whiteBg ? ' shell-plain' : ''}`}>
      {withWindow ? (
        <RetroWindow bare={windowBare}  bg={windowBg}>
          <main className={`shell-main${(windowBare || mainFlush) ? ' shell-main-flush' : ''}`}>
            <Outlet />
          </main>
        </RetroWindow>
      ) : (
        <main className="shell-main">
          <Outlet />
        </main>
      )}

      {withTabBar ? (
        <TabBar />
      ) : (
        /* 탭바 없는 페이지도 창 위치가 같게 — 같은 크기의 빈 자리만 차지 */
        <div className="tabbar" style={{ visibility: 'hidden' }} aria-hidden="true" />
      )}
    </div>
  )
}

/** 탭바 O + 창 O */
function TabLayout() {
  return (
    <ProtectedRoute>
      <Shell />
    </ProtectedRoute>
  )
}

/** 탭바 O + 창 X + 흰 배경 (교환·주간평가) */
function TabLayoutNoWindow() {
  return (
    <ProtectedRoute>
      <Shell withWindow={false} whiteBg />
    </ProtectedRoute>
  )
}

/** 탭바 X + 창 크기만 (상점) */
function BareLayout() {
  return (
    <ProtectedRoute>
      <Shell withTabBar={false} windowBare />
    </ProtectedRoute>
  )
}

/** 탭바 X + 창 O + 본문 여백 0 (방 편집) */
function FlushLayout() {
  return (
    <ProtectedRoute>
      <Shell withTabBar={false} mainFlush windowBg="/assets/ui/RoomSetting_Bg.png" />
    </ProtectedRoute>
  )
}

/** 탭바 X + 창 X + 우주 배경 (프로필·커스터마이징) */
function SpaceLayout() {
  return (
    <ProtectedRoute>
      <Shell withTabBar={false} withWindow={false} />
    </ProtectedRoute>
  )
}

/** 탭바 X + 창 O (몰입형 화면) */
function FullLayout() {
  return (
    <ProtectedRoute>
      <Shell withTabBar={false} />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
     <BgmPlayer />
      <Routes>
        {/* 비로그인 */}
        <Route element={<Shell withTabBar={false} />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* 탭바 있는 주요 화면 (레트로윈도우 O) */}
        <Route element={<TabLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* 탭바 있는 화면 (레트로윈도우 X · 흰 배경) */}
        <Route element={<TabLayoutNoWindow />}>
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/trade" element={<TradePage />} />
        </Route>

        {/* 창 크기만 쓰는 화면 */}
        <Route element={<BareLayout />}>
          <Route path="/shop" element={<ShopPage />} />
        </Route>

        {/* 창 O · 본문 여백 0 */}
        <Route element={<FlushLayout />}>
          <Route path="/room" element={<RoomEditPage />} />
        </Route>

        {/* 우주 배경 화면 */}
        <Route element={<SpaceLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/customize" element={<CustomizePage />} />
        </Route>

        {/* 탭바 없는 화면 */}
        <Route element={<FullLayout />}>
          <Route path="/write" element={<DiaryWritePage />} />
          <Route path="/item/:itemId" element={<ItemResultPage />} />
        </Route>

        
        {/* 관리자 전용 화면 — 폰 프레임 제약 없이 전체 화면 */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
/>

      </Routes>
    </BrowserRouter>
  )
}