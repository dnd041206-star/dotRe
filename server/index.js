import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./lib/auth.js";
import { enqueue } from "./lib/queue.js";
import { generateItem } from "./pipeline/generateItem.js";
import { supabaseAdmin } from "./lib/supabaseAdmin.js";
import { weekStartOf, toKey, getBonusCategory, evaluate } from "./game/weekly.js";
import { priceOf } from "./game/shop.js";
import { FURNITURE_CATEGORY_KEYS, FURNITURE_CATEGORY_LABELS } from "./game/furniture.js";
import { AVATAR_CATEGORY_KEYS, AVATAR_CATEGORY_LABELS } from "./game/avatar.js";

const DEV_IDS = new Set(
  (process.env.DEV_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

// ⚠️ 시연용 임시 플래그 — 주간평가 요일 제한(일요일만) 해제.
// 시연 끝나면 false로 되돌릴 것.
const DEMO_FORCE_SUNDAY = true;

/** 오늘 00:00 (서버 로컬 기준) */
function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 오늘 이미 아이템을 만들었는지 확인.
 * failed 상태는 세지 않는다 — 실패로 하루를 날리면 안 되니까.
 */
async function madeItemToday(userId) {
  if (DEV_IDS.has(userId)) return false;

  const { data, error } = await supabaseAdmin
    .from("items")
    .select("id")
    .eq("creator_id", userId)
    .eq("owner_id", userId)
    .neq("meta_status", "failed")
    .gte("created_at", todayStart().toISOString())
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}


// server/index.js

async function wroteDiaryToday(userId) {
  if (DEV_IDS.has(userId)) return false;

  const { data, error } = await supabaseAdmin
    .from("diaries")
    .select("id")
    .eq("user_id", userId)
    .eq("diary_date", todayStr()) // 'YYYY-MM-DD' — 프론트와 동일한 기준으로
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}


const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

/** 아이템 생성 요청 — 즉시 응답하고 생성은 백그라운드에서 */
app.post("/api/items", requireAuth, async (req, res) => {
  const { diaryId, streakDays = 0 } = req.body;
  if (!diaryId) return res.status(400).json({ error: "diaryId가 필요합니다" });

  // 1. 일기 확인 (본인 것인지, 사진이 있는지)
  const { data: diary, error: dErr } = await supabaseAdmin
    .from("diaries")
    .select("id, user_id, content, photo_url")
    .eq("id", diaryId)
    .single();

  if (dErr || !diary) return res.status(404).json({ error: "일기를 찾을 수 없습니다" });
  if (diary.user_id !== req.user.id) return res.status(403).json({ error: "권한이 없습니다" });
  if (!diary.photo_url) return res.status(400).json({ error: "사진이 없습니다" });

  // 2. 이미 만든 아이템이 있으면 그것을 돌려줌 (중복 생성 방지)
  const { data: existing } = await supabaseAdmin
    .from("items")
    .select("id")
    .eq("diary_id", diaryId)
    .eq("creator_id", req.user.id)
    .maybeSingle();

  if (existing) return res.json({ itemId: existing.id, reused: true });
  if (await madeItemToday(req.user.id)) {
    return res.status(429).json({
      error: "오늘은 이미 아이템을 만들었어요. 내일 다시 만나요!",
    });
  }

  // 3. 빈 껍데기 생성 (프론트는 이 id로 Realtime 구독)
  const { data: item, error: iErr } = await supabaseAdmin
    .from("items")
    .insert({
      diary_id: diaryId,
      owner_id: req.user.id,
      creator_id: req.user.id,
      meta_status: "pending"
    })
    .select("id")
    .single();

  if (iErr) return res.status(500).json({ error: iErr.message });

  // 4. 큐에 투입 (기다리지 않음)
  enqueue(diaryId, () =>
    generateItem({
      itemId: item.id,
      userId: req.user.id,
      photoUrl: diary.photo_url,
      textLength: (diary.content || "").length,
      streakDays
    })
  );

  res.json({ itemId: item.id });
});

/** 다시 생성 — 같은 사진으로 한 번 더 */
app.post("/api/items/:itemId/regenerate", requireAuth, async (req, res) => {
    const { itemId } = req.params;

  const { data: item, error: itemErr } = await supabaseAdmin
    .from("items")
    .select("id, diary_id, owner_id, creator_id, meta_status")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr) {
    console.error("[regenerate] 조회 실패", itemId, itemErr);
    return res.status(500).json({ error: itemErr.message });
  }
  if (!item) {
    console.error("[regenerate] 아이템 없음", itemId);
    return res.status(404).json({ error: "아이템을 찾을 수 없습니다" });
  }

  if (item.creator_id !== req.user.id) return res.status(403).json({ error: "권한이 없습니다" });

  const { data: regen } = await supabaseAdmin
    .from("items")
    .select("id")
    .eq("id", itemId)
    .gte("regenerated_at", todayStart().toISOString())
    .maybeSingle();

  if (regen && item.meta_status !== "failed" && !DEV_IDS.has(req.user.id)) {
    return res.status(429).json({
      error: "다시 뽑기는 하루에 한 번만 가능해요.",
    });
  }

  const { data: diary } = await supabaseAdmin
    .from("diaries")
    .select("content, photo_url")
    .eq("id", item.diary_id)
    .single();

  if (!diary?.photo_url) return res.status(400).json({ error: "사진이 없습니다" });

  await supabaseAdmin.from("items")
    .update({ meta_status: "pending", error_msg: null, regenerated_at: new Date().toISOString() })
    .eq("id", itemId);

  enqueue(`regen-${itemId}`, () =>
    generateItem({
      itemId,
      userId: req.user.id,
      photoUrl: diary.photo_url,
      textLength: (diary.content || "").length,
      streakDays: req.body.streakDays || 0
    })
  );

  res.json({ itemId });
});


//주간평가
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS_SHOWN = 4;

/** 한 주 치를 계산해서 돌려준다 */
async function buildWeek(userId, start, claimedMap) {
  const end = new Date(start.getTime() + 7 * DAY_MS);
  const bonus = getBonusCategory(start);

  const { data: items, error } = await supabaseAdmin
    .from("items")
    .select("id, name, category, image_url, rarity")
    .eq("creator_id", userId)
    .eq("owner_id", userId)
    .eq("meta_status", "done")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const result = evaluate(items, bonus.key);
  const key = toKey(start);
  const isCurrent = key === toKey(weekStartOf());
  // const isSunday = new Date().getDay() === 0;
  const isSunday = DEMO_FORCE_SUNDAY || new Date().getDay() === 0;

  return {
    weekStart: key,
    bonusCategory: bonus.key,
    bonusLabel: bonus.label,
    ...result,
    items: items.slice(0, 7),
    claimed: !!claimedMap[key],
    claimable: !claimedMap[key] && result.reward > 0 && (!isCurrent || isSunday),
    isCurrent,
    isSunday,
  };
}

/** 최근 4주 평가 현황 */
app.get("/api/weekly", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();

    const { data: claims } = await supabaseAdmin
      .from("weekly_evaluations").select("week_start").eq("user_id", req.user.id);

    const claimedMap = Object.fromEntries((claims || []).map((c) => [c.week_start, true]));

    const base = weekStartOf();
    const weeks = [];
    for (let i = 0; i < WEEKS_SHOWN; i++) {
      const start = new Date(base.getTime() - i * 7 * DAY_MS);
      weeks.push(await buildWeek(req.user.id, start, claimedMap));
    }

    res.json({ nuts: profile?.nuts ?? 0, weeks });
  } catch (err) {
    console.error("[weekly]", err);
    res.status(500).json({ error: "평가 정보를 불러오지 못했습니다" });
  }
});

/** 보상 수령 */
app.post("/api/weekly/claim", requireAuth, async (req, res) => {
  const { weekStart } = req.body;
  if (!weekStart) return res.status(400).json({ error: "weekStart가 필요합니다" });

  try {
    const start = new Date(`${weekStart}T00:00:00`);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "잘못된 날짜입니다" });
    }

    const week = await buildWeek(req.user.id, start, {});
    if (week.reward <= 0) return res.status(400).json({ error: "받을 보상이 없습니다" });

    const isCurrent = weekStart === toKey(weekStartOf());
    // if (isCurrent && new Date().getDay() !== 0) {
    if (isCurrent && !DEMO_FORCE_SUNDAY && new Date().getDay() !== 0) {
      return res.status(400).json({ error: "평가는 일요일에 열려요" });
    }

    // unique 제약이 중복 수령을 막는다
    const { error: insErr } = await supabaseAdmin.from("weekly_evaluations").insert({
      user_id: req.user.id,
      week_start: weekStart,
      item_count: week.itemCount,
      bonus_category: week.bonusCategory,
      bonus_count: week.bonusCount,
      total_count: week.totalCount,
      grade: week.grade,
      reward: week.reward,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(400).json({ error: "이미 수령한 주간 평가입니다" });
      }
      throw insErr;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();
    const nuts = (profile?.nuts ?? 0) + week.reward;

    await supabaseAdmin.from("profiles").update({ nuts }).eq("id", req.user.id);

    res.json({ ok: true, grade: week.grade, reward: week.reward, nuts });
  } catch (err) {
    console.error("[weekly/claim]", err);
    res.status(500).json({ error: "보상 수령에 실패했습니다" });
  }
});

const PORT = process.env.PORT || 3001;

/** 상점 목록 — 내 아이템 + 가격 + 구매 여부 */
app.get("/api/shop", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();

    const { data: items, error } = await supabaseAdmin
      .from("items")
      .select("id, name, image_url, rarity, category, creator_id, created_at")
      .eq("owner_id", req.user.id)
      .eq("meta_status", "done")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: owned } = await supabaseAdmin
      .from("room_items").select("item_id").eq("user_id", req.user.id);
    const ownedCounts = {};
    for (const r of owned || []) ownedCounts[r.item_id] = (ownedCounts[r.item_id] || 0) + 1;

    res.json({
      nuts: profile?.nuts ?? 0,
      items: items.map((it) => ({
        ...it,
        price: priceOf(it.rarity),
        ownedCount: ownedCounts[it.id] || 0,
        maxedOut: (ownedCounts[it.id] || 0) >= 5,
        fromFriend: it.creator_id !== req.user.id,
      })),
    });
  } catch (err) {
    console.error("[shop]", err);
    res.status(500).json({ error: "상점 정보를 불러오지 못했습니다" });
  }
});

/** 구매 — 아이템은 수량 선택 가능(최대 5개), 이미 보유한 개수와 합쳐서 5개를 넘을 수 없음 */
app.post("/api/shop/buy", requireAuth, async (req, res) => {
  const { itemId, qty = 1 } = req.body;
  if (!itemId) return res.status(400).json({ error: "itemId가 필요합니다" });

  const quantity = Number(qty);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5) {
    return res.status(400).json({ error: "구매 개수는 1~5개 사이여야 해요" });
  }

  try {
    const { data: item } = await supabaseAdmin
      .from("items")
      .select("id, rarity, owner_id, meta_status")
      .eq("id", itemId)
      .maybeSingle();

    if (!item || item.owner_id !== req.user.id) {
      return res.status(404).json({ error: "아이템을 찾을 수 없습니다" });
    }
    if (item.meta_status !== "done") {
      return res.status(400).json({ error: "아직 생성 중인 아이템이에요" });
    }

    const { count: ownedCount, error: countErr } = await supabaseAdmin
      .from("room_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("item_id", itemId);
    if (countErr) throw countErr;

    if ((ownedCount ?? 0) + quantity > 5) {
      return res.status(400).json({
        error: `이 아이템은 최대 5개까지 보유할 수 있어요 (현재 ${ownedCount ?? 0}개 보유 중)`,
      });
    }

    const unitPrice = priceOf(item.rarity);
    const totalPrice = unitPrice * quantity;

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();
    const nuts = profile?.nuts ?? 0;

    if (nuts < totalPrice) {
      return res.status(400).json({ error: `너트가 부족해요 (${totalPrice} 필요)` });
    }

    const rows = Array.from({ length: quantity }, () => ({
      user_id: req.user.id,
      item_id: itemId,
      price: unitPrice,
    }));

    const { error: insErr } = await supabaseAdmin.from("room_items").insert(rows);
    if (insErr) throw insErr;

    await supabaseAdmin.from("profiles")
      .update({ nuts: nuts - totalPrice }).eq("id", req.user.id);

    res.json({ ok: true, qty: quantity, unitPrice, totalPrice, nuts: nuts - totalPrice });
  } catch (err) {
    console.error("[shop/buy]", err);
    res.status(500).json({ error: "구매에 실패했습니다" });
  }
});

/** 가구 목록 — 카테고리와 함께 반환 */
app.get("/api/furniture", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();

    const { data: catalog, error } = await supabaseAdmin
      .from("furniture_catalog")
      .select("id, category, name, image_url, price")
      .order("category", { ascending: true });
    if (error) throw error;

    const { data: owned } = await supabaseAdmin
      .from("room_furniture").select("furniture_id").eq("user_id", req.user.id);
    const ownedSet = new Set((owned || []).map((r) => r.furniture_id));

    res.json({
      nuts: profile?.nuts ?? 0,
      categories: FURNITURE_CATEGORY_KEYS.map((key) => ({
        key, label: FURNITURE_CATEGORY_LABELS[key],
      })),
      items: catalog.map((f) => ({ ...f, owned: ownedSet.has(f.id) })),
    });
  } catch (err) {
    console.error("[furniture]", err);
    res.status(500).json({ error: "가구 목록을 불러오지 못했습니다" });
  }
});

/** 가구 구매 — 종류당 1개 제한 */
app.post("/api/furniture/buy", requireAuth, async (req, res) => {
  const { furnitureId } = req.body;
  if (!furnitureId) return res.status(400).json({ error: "furnitureId가 필요합니다" });

  try {
    const { data: furniture } = await supabaseAdmin
      .from("furniture_catalog")
      .select("id, price")
      .eq("id", furnitureId)
      .maybeSingle();
    if (!furniture) return res.status(404).json({ error: "가구를 찾을 수 없습니다" });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();
    const nuts = profile?.nuts ?? 0;

    if (nuts < furniture.price) {
      return res.status(400).json({ error: `너트가 부족해요 (${furniture.price} 필요)` });
    }

    const { error: insErr } = await supabaseAdmin.from("room_furniture").insert({
      user_id: req.user.id,
      furniture_id: furnitureId,
      price: furniture.price,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(400).json({ error: "이미 보유한 가구예요" });
      }
      throw insErr;
    }

    await supabaseAdmin.from("profiles")
      .update({ nuts: nuts - furniture.price }).eq("id", req.user.id);

    res.json({ ok: true, nuts: nuts - furniture.price });
  } catch (err) {
    console.error("[furniture/buy]", err);
    res.status(500).json({ error: "구매에 실패했습니다" });
  }
});

const EQUIP_COLUMN = { face: "equipped_face_id", hair: "equipped_hair_id", outfit: "equipped_outfit_id" };

/** 아바타 파츠 카탈로그 + 보유 여부 + 장착 상태 */
app.get("/api/avatar", requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("nuts, equipped_face_id, equipped_hair_id, equipped_outfit_id")
      .eq("id", req.user.id).single();

    const { data: catalog, error } = await supabaseAdmin
      .from("avatar_parts")
      .select("id, category, name, image_url, price, is_default")
      .order("category", { ascending: true });
    if (error) throw error;

    const { data: owned } = await supabaseAdmin
      .from("user_avatar_parts").select("part_id").eq("user_id", req.user.id);
    const ownedSet = new Set((owned || []).map((r) => r.part_id));

    const equipped = {
      face: profile?.equipped_face_id ?? null,
      hair: profile?.equipped_hair_id ?? null,
      outfit: profile?.equipped_outfit_id ?? null,
    };

    res.json({
      nuts: profile?.nuts ?? 0,
      categories: AVATAR_CATEGORY_KEYS.map((key) => ({ key, label: AVATAR_CATEGORY_LABELS[key] })),
      equipped,
      items: catalog.map((p) => ({ ...p, owned: p.is_default || ownedSet.has(p.id) })),
    });
  } catch (err) {
    console.error("[avatar]", err);
    res.status(500).json({ error: "커스터마이징 정보를 불러오지 못했습니다" });
  }
});

/** 파츠 구매 (기본 제공 파츠는 구매 불필요) */
app.post("/api/avatar/buy", requireAuth, async (req, res) => {
  const { partId } = req.body;
  if (!partId) return res.status(400).json({ error: "partId가 필요합니다" });

  try {
    const { data: part } = await supabaseAdmin
      .from("avatar_parts").select("id, price, is_default").eq("id", partId).maybeSingle();
    if (!part) return res.status(404).json({ error: "파츠를 찾을 수 없습니다" });
    if (part.is_default) return res.status(400).json({ error: "이미 기본으로 보유한 파츠예요" });

    const { data: profile } = await supabaseAdmin
      .from("profiles").select("nuts").eq("id", req.user.id).single();
    const nuts = profile?.nuts ?? 0;

    if (nuts < part.price) {
      return res.status(400).json({ error: `너트가 부족해요 (${part.price} 필요)` });
    }

    const { error: insErr } = await supabaseAdmin.from("user_avatar_parts").insert({
      user_id: req.user.id,
      part_id: partId,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return res.status(400).json({ error: "이미 보유한 파츠예요" });
      }
      throw insErr;
    }

    await supabaseAdmin.from("profiles")
      .update({ nuts: nuts - part.price }).eq("id", req.user.id);

    res.json({ ok: true, nuts: nuts - part.price });
  } catch (err) {
    console.error("[avatar/buy]", err);
    res.status(500).json({ error: "구매에 실패했습니다" });
  }
});

/** 파츠 장착 — 보유(또는 기본 제공)한 파츠만 장착 가능. partId가 null이면 해제 */
app.post("/api/avatar/equip", requireAuth, async (req, res) => {
  const { category, partId } = req.body;
  const column = EQUIP_COLUMN[category];
  if (!column) return res.status(400).json({ error: "잘못된 카테고리입니다" });

  try {
    if (partId) {
      const { data: part } = await supabaseAdmin
        .from("avatar_parts").select("id, category, is_default").eq("id", partId).maybeSingle();
      if (!part || part.category !== category) {
        return res.status(400).json({ error: "잘못된 파츠입니다" });
      }
      if (!part.is_default) {
        const { data: owned } = await supabaseAdmin
          .from("user_avatar_parts")
          .select("id").eq("user_id", req.user.id).eq("part_id", partId).maybeSingle();
        if (!owned) return res.status(403).json({ error: "보유하지 않은 파츠예요" });
      }
    }

    await supabaseAdmin.from("profiles")
      .update({ [column]: partId ?? null }).eq("id", req.user.id);

    res.json({ ok: true });
  } catch (err) {
    console.error("[avatar/equip]", err);
    res.status(500).json({ error: "장착에 실패했습니다" });
  }
});


/** 교환 수령 — 복사본 생성을 서버에서 처리 (클라이언트 items INSERT 차단용) */
app.post("/api/trades/:tradeId/receive", requireAuth, async (req, res) => {
  const { tradeId } = req.params;

  try {
    const { data: trade, error: tErr } = await supabaseAdmin
      .from("item_trades")
      .select("id, item_id, to_user, status")
      .eq("id", tradeId)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!trade) return res.json({ ok: false, reason: "not_found" });
    if (trade.to_user !== req.user.id) {
      return res.status(403).json({ error: "권한이 없습니다" });
    }
    if (trade.status !== "pending") return res.json({ ok: false, reason: "not_pending" });

    const { data: original, error: oErr } = await supabaseAdmin
      .from("items").select("*").eq("id", trade.item_id).maybeSingle();
    if (oErr) throw oErr;
    if (!original) return res.json({ ok: false, reason: "original_missing" });

    // 원자적 선점 — 중복 수령 방지
    const { data: claimed, error: cErr } = await supabaseAdmin
      .from("item_trades")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("id", tradeId)
      .eq("status", "pending")
      .select("id");
    if (cErr) throw cErr;
    if (!claimed?.length) return res.json({ ok: false, reason: "not_pending" });

    const { data: copied, error: copyErr } = await supabaseAdmin
      .from("items")
      .insert({
        owner_id:    trade.to_user,
        creator_id:  original.creator_id,
        diary_id:    original.diary_id,
        name:        original.name,
        description: original.description,
        image_url:   original.image_url,
        category:    original.category,
        rarity:      original.rarity,
        stats:       original.stats,
        power:       original.power,
        diary_score: original.diary_score,
        meta_status: "done",
      })
      .select("id");

    if (copyErr || !copied?.length) {
      await supabaseAdmin.from("item_trades")
        .update({ status: "pending", received_at: null }).eq("id", tradeId);
      console.error("[trades/receive] 복사 실패", tradeId, copyErr);
      return res.json({ ok: false, reason: "copy_blocked" });
    }

    res.json({ ok: true, itemId: copied[0].id });
  } catch (err) {
    console.error("[trades/receive]", err);
    res.status(500).json({ error: "수령에 실패했습니다" });
  }
});

app.listen(PORT, () => console.log(`서버 실행 중 → http://localhost:${PORT}`));