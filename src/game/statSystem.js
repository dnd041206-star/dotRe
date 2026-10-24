// ─────────────────────────────────────────────────────────────
//  Dot-Re — 아이템 스탯 / 등급 시스템
//
//  설계 원칙
//    · AI는 "분류"만 한다. 스탯 수치는 절대 AI가 정하지 않는다.
//    · 사진(카테고리) → 스탯이 어느 쪽으로 치우칠지 (성향)
//    · 일기(분량·연속일) → 등급과 스탯 총량 (강함)
//    · 개별 스탯에는 등급별 상·하한이 걸려 극단 분배가 나오지 않는다.
// ─────────────────────────────────────────────────────────────

export const STAT_KEYS = ["luck", "cool", "energy", "cute"];

export const STAT_LABELS = {
  luck:   { ko: "행운",   icon: "/assets/icons/StatLuck.png",   color: "#22c55e" },
  cool:   { ko: "멋짐",   icon: "/assets/icons/StatCool.png",   color: "#3b82f6" },
  energy: { ko: "활력",   icon: "/assets/icons/StatEnergy.png", color: "#f59e0b" },
  cute:   { ko: "귀여움", icon: "/assets/icons/StatCute.png",   color: "#ec4899" }
};
export const CATEGORY_WEIGHTS = {
  food:       { luck: 2, cool: 2, energy: 5, cute: 4 },
  drink:      { luck: 2, cool: 3, energy: 5, cute: 3 },
  plant:      { luck: 3, cool: 2, energy: 4, cute: 4 },
  toy:        { luck: 3, cool: 2, energy: 2, cute: 5 },
  fashion:    { luck: 2, cool: 5, energy: 2, cute: 3 },
  accessory:  { luck: 4, cool: 4, energy: 1, cute: 3 },
  tech:       { luck: 1, cool: 5, energy: 4, cute: 1 },
  stationery: { luck: 2, cool: 3, energy: 2, cute: 3 },
  tool:       { luck: 2, cool: 4, energy: 3, cute: 1 },
  animal:     { luck: 3, cool: 2, energy: 4, cute: 5 },
  misc:       { luck: 3, cool: 3, energy: 3, cute: 3 }
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_WEIGHTS);

export const CATEGORY_LABELS = {
  food: "음식", drink: "음료", plant: "식물", toy: "장난감",
  fashion: "패션", accessory: "액세서리", tech: "전자기기",
  stationery: "문구", tool: "도구", animal: "동물", misc: "기타"
};

export const RARITY_TABLE = {
  normal: { label: "노멀",   budget: 60,  color: "#9ca3af", order: 0 },
  rare:   { label: "레어",   budget: 110, color: "#3b82f6", order: 1 },
  epic:   { label: "에픽",   budget: 170, color: "#a855f7", order: 2 },
  unique: { label: "유니크", budget: 240, color: "#f59e0b", order: 3 }
};

export const RARITY_KEYS = Object.keys(RARITY_TABLE);

// ── 조절 상수 ────────────────────────────────────────────────

/** 스탯 분배 랜덤 폭. 0=완전 결정론, 1=완전 랜덤 */
export const JITTER = 0.45;

/** luck 추가 랜덤 배율 — 물체 성질과 무관한 스탯이라 폭을 넓게 */
export const LUCK_JITTER_MULT = 1.6;

/** 같은 등급 안에서의 총량 편차(±) */
export const VARIANCE = 0.12;

/** 개별 스탯 하한 비율 (총량 대비) */
export const FLOOR_RATIO = 0.08;

/**
 * 개별 스탯 상한 배율. 상한 = (총량 ÷ 4) × CAP_MULT
 *   1.0 → 네 스탯이 전부 균등해진다 (성향·랜덤 소멸)
 *   1.8 → 성향은 살아있되 몰빵은 막힌다 (권장)
 *   2.5+ → 사실상 상한 없음
 */
export const CAP_MULT = 1.8;

/** 총량으로부터 개별 스탯의 상·하한을 계산 */
export function statBounds(budget) {
  const floor = Math.max(1, Math.round(budget * FLOOR_RATIO));
  const cap   = Math.max(floor, Math.round((budget / STAT_KEYS.length) * CAP_MULT));
  return { floor, cap };
}

/** UI 스탯 바의 100% 기준값 — 이론상 나올 수 있는 최대 단일 스탯 */
export const STAT_BAR_MAX = statBounds(
  Math.round(RARITY_TABLE.unique.budget * (1 + VARIANCE))
).cap;

// ── 1단계: 등급 + 총량 결정 (일기 기반) ───────────────────────

export function rollRarity({ textLength = 0, streakDays = 0 } = {}) {
  const lenScore    = Math.min(50, (Math.max(0, textLength) / 300) * 50);
  const streakScore = Math.min(30, Math.max(0, streakDays) * 3);
  const base        = 20 + lenScore + streakScore; // 20 ~ 100

  const tiers = [
    { key: "normal", w: 100 - base * 0.75 },
    { key: "rare",   w: 25  + base * 0.30 },
    { key: "epic",   w: 4   + base * 0.16 },
    { key: "unique", w: 0.6 + base * 0.05 }
  ].map((t) => ({ ...t, w: Math.max(0.5, t.w) }));

  const total = tiers.reduce((a, t) => a + t.w, 0);
  let r = Math.random() * total;
  const tier = tiers.find((t) => (r -= t.w) <= 0) || tiers[0];

  const budget = Math.round(
    RARITY_TABLE[tier.key].budget * (1 - VARIANCE + Math.random() * VARIANCE * 2)
  );

  return { rarity: tier.key, budget, diaryScore: Math.round(base) };
}

// ── 2단계: 스탯 분배 (사진 카테고리 기반) ─────────────────────

export function rollStats(budget, category, jitter = JITTER) {
  const base = CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.misc;
  const { floor, cap } = statBounds(budget);

  // 1) 성향 가중치 × 랜덤 지터
  const raw = {};
  let sum = 0;
  for (const k of STAT_KEYS) {
    const j = k === "luck" ? Math.min(0.95, jitter * LUCK_JITTER_MULT) : jitter;
    raw[k] = Math.max(0.001, base[k] * (1 - j + Math.random() * j * 2));
    sum += raw[k];
  }

  // 2) 총량에 맞춰 정규화하고 상·하한으로 자름
  const stats = {};
  for (const k of STAT_KEYS) {
    const v = Math.round((raw[k] / sum) * budget);
    stats[k] = Math.min(cap, Math.max(floor, v));
  }

  // 3) 자르면서 생긴 오차를 상·하한을 지키며 재분배
  const total = () => STAT_KEYS.reduce((a, k) => a + stats[k], 0);
  let diff = budget - total();
  let guard = 0;

  while (diff !== 0 && guard++ < 2000) {
    const up   = diff > 0;
    const pool = STAT_KEYS.filter((k) => (up ? stats[k] < cap : stats[k] > floor));
    if (pool.length === 0) break;   // 더 옮길 곳이 없음

    // 올릴 땐 여유 있는 것 중 가장 높은 쪽, 내릴 땐 가장 낮은 쪽
    const target = pool.reduce((a, b) =>
      up ? (stats[a] >= stats[b] ? a : b) : (stats[a] <= stats[b] ? a : b));

    stats[target] += up ? 1 : -1;
    diff += up ? -1 : 1;
  }

  return stats;
}

// ── 통합 진입점 ──────────────────────────────────────────────

/**
 * 아이템 하나의 등급과 스탯을 최종 생성한다.
 *
 * 워커에서 Claude 작명에 등급을 미리 알려주려면,
 * rollRarity()를 먼저 호출한 뒤 그 결과를 preRolled로 넘겨라.
 * 그래야 등급이 두 번 굴러가 어긋나는 일이 없다.
 */
export function generateItemStats({
  category, textLength = 0, streakDays = 0, preRolled = null
} = {}) {
  const { rarity, budget, diaryScore } =
    preRolled || rollRarity({ textLength, streakDays });

  const stats = rollStats(budget, category);
  const info  = RARITY_TABLE[rarity];

  return {
    rarity,
    rarityLabel: info.label,
    rarityColor: info.color,
    rarityOrder: info.order,
    stats,
    power: STAT_KEYS.reduce((a, k) => a + stats[k], 0),
    diaryScore
  };
}

// ── UI 보조 ──────────────────────────────────────────────────

/** 스탯 값을 0~100 퍼센트로 변환 (스탯 바 렌더링용) */
export function statPercent(value) {
  return Math.min(100, Math.round((value / STAT_BAR_MAX) * 100));
}

/** 등급 판정 근거 문구 */
export function rarityReason({ textLength = 0, streakDays = 0 } = {}) {
  const parts = [];
  if (textLength >= 300) parts.push("정성스러운 기록");
  else if (textLength >= 150) parts.push("충실한 기록");
  if (streakDays >= 3) parts.push(`연속 기록 ${streakDays}일차`);
  return parts.length ? parts.join(" · ") : "오늘의 기록";
}