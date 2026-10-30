import { supabaseAdmin } from "./supabaseAdmin.js";

const ADMIN_IDS = new Set(
  (process.env.DEV_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다" });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: "세션이 만료되었습니다" });
  }

  req.user = data.user;
  next();
}

/** requireAuth 다음에 붙여서 쓰는 관리자 전용 체크 */
export function requireAdmin(req, res, next) {
  if (!ADMIN_IDS.has(req.user?.id)) {
    return res.status(403).json({ error: "관리자 권한이 없습니다" });
  }
  next();
}