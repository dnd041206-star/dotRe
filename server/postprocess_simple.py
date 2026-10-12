import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

# ── 조절 상수 ────────────────────────────────────────────────

BG_D          = 60    # 배경 씨앗: 확실한 마젠타
BG_MIN        = 120

BG_WEAK_D     = 30    # 씨앗에서 번져나갈 때의 느슨한 기준
BG_WEAK_MIN   = 70

FRINGE_D      = 25    # 가장자리 잔재 판정 (배경보다 느슨하게)
FRINGE_MIN    = 100
FRINGE_ITERS  = 4     # 깎아낼 최대 겹 수

SHRINK        = 1     # 무조건 깎아낼 겹 수
HOLE_MAX_AREA = 0.12  # 이 비율보다 큰 내부 마젠타 영역은 보존
MIN_PIECE     = 0.02  # 이 비율보다 작은 조각은 제거
PAD           = 12    # 사방 여백 (px)
OUT_SIZE      = None  # 정수로 두면 그 크기로 축소. None이면 원본 유지

FORCE_GRID    = None  # 숫자(예: 72)를 넣으면 '사진 같을 때만' 그 격자로 강제
PHOTO_COLORS  = 6000  # 고유색이 이보다 많으면 사진 같다고 판정


def magenta(f):
    """마젠타 강도 d = min(R,B) - G. R과 B가 둘 다 높아야 마젠타로 본다"""
    r, g, b = f[:, :, 0], f[:, :, 1], f[:, :, 2]
    rb = np.minimum(r, b)
    return rb - g, rb


def background_mask(f):
    """확실한 마젠타를 씨앗으로 잡고, 약한 마젠타(그림자)로 번져나가며 배경을 확장"""
    d, rb = magenta(f)
    strong = (d >= BG_D) & (rb >= BG_MIN)
    weak   = (d >= BG_WEAK_D) & (rb >= BG_WEAK_MIN)

    lbl, n = ndimage.label(strong)
    border = set(lbl[0, :]) | set(lbl[-1, :]) | set(lbl[:, 0]) | set(lbl[:, -1])
    border.discard(0)
    seeds = np.isin(lbl, list(border))

    # 테두리 배경에서 출발해 약한 마젠타를 따라 번진다
    bg = ndimage.binary_propagation(seeds, mask=(weak | seeds))

    # 머그 손잡이 구멍처럼 물체 안에 갇힌 배경
    for i in range(1, n + 1):
        if i in border:
            continue
        comp = lbl == i
        if comp.sum() / lbl.size > HOLE_MAX_AREA:
            continue
        bg |= ndimage.binary_propagation(comp, mask=(weak | comp))

    return bg


def defringe(alpha, f):
    """가장자리에 남은 보라빛 잔재를 한 겹씩 제거 — 물체 색에서 멈춘다"""
    d, rb = magenta(f)
    tinted = (d >= FRINGE_D) & (rb >= FRINGE_MIN)

    cross = ndimage.generate_binary_structure(2, 1)
    a = alpha.copy()
    for _ in range(FRINGE_ITERS):
        solid = a > 0
        edge = solid & ~ndimage.binary_erosion(solid, cross)
        kill = edge & tinted
        if not kill.any():
            break
        a[kill] = 0
    return a


def keep_main(alpha):
    """분리된 작은 조각 제거"""
    solid = alpha > 0
    lbl, n = ndimage.label(solid)
    if n <= 1:
        return alpha
    sizes = ndimage.sum(solid, lbl, range(1, n + 1))
    keep = {i + 1 for i, s in enumerate(sizes) if s / solid.size >= MIN_PIECE}
    if not keep:
        keep = {int(np.argmax(sizes)) + 1}
    alpha = alpha.copy()
    alpha[~np.isin(lbl, list(keep))] = 0
    return alpha


def trim_and_center(img):
    """여백 잘라내고 정사각형 가운데 정렬"""
    bbox = img.getbbox()
    if not bbox:
        return img
    obj = img.crop(bbox)
    side = max(obj.width, obj.height) + PAD * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2))
    return canvas


def color_count(rgb, alpha):
    vis = rgb[alpha > 0]
    if vis.size == 0:
        return 0
    q = (vis // 8).astype(np.uint8)
    return int(len(np.unique(q.reshape(-1, 3), axis=0)))


def force_grid(img, n):
    w, h = img.size
    return img.resize((n, n), Image.BOX).resize((w, h), Image.NEAREST)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: postprocess_simple.py <input> <output>", file=sys.stderr)
        sys.exit(2)

    src_path, dst_path = sys.argv[1], sys.argv[2]

    try:
        # 마젠타 배경에서는 화이트밸런스를 걸면 색이 틀어진다 — 원본 RGB 그대로
        f = np.array(Image.open(src_path).convert("RGB")).astype(np.float64)

        bg = background_mask(f)
        keyed = bool(bg.mean() > 0.05)   # 마젠타 배경이 실제로 잡혔는가

        alpha = np.where(bg, 0, 255).astype(np.uint8)
        alpha = defringe(alpha, f)

        if SHRINK:
            cross = ndimage.generate_binary_structure(2, 1)
            alpha = np.where(
                ndimage.binary_erosion(alpha > 0, cross, iterations=SHRINK),
                alpha, 0)

        alpha = keep_main(alpha)

        rgb = f.astype(np.uint8)
        rgb[alpha == 0] = 0                       # 투명부는 검게 (헤일로 방지)
        img = trim_and_center(Image.fromarray(np.dstack([rgb, alpha]), "RGBA"))

        if OUT_SIZE:
            img = img.resize((OUT_SIZE, OUT_SIZE), Image.BOX)

        opaque = float((np.array(img)[:, :, 3] > 0).mean())
        colors = color_count(rgb, alpha)

        forced = False
        if FORCE_GRID and colors > PHOTO_COLORS:
            img = force_grid(img, FORCE_GRID)
            forced = True

        if not keyed:
            print("NO_MAGENTA_BG", file=sys.stderr)   # 생성이 흰 배경으로 나온 경우
        if opaque < 0.02:
            print("EMPTY_RESULT", file=sys.stderr)
            sys.exit(3)

        img.save(dst_path)
        print(json.dumps({"size": img.width, "fill": round(opaque, 3),
                          "keyed": keyed, "colors": colors, "forced": forced}))
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)