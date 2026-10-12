import "dotenv/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";
import Replicate from "replicate";

const run = promisify(execFile);
const replicate = new Replicate();

const PY = process.env.PYTHON_BIN;
const SCRIPT = process.env.POSTPROCESS_PY;

/** 분석 결과로 Kontext 프롬프트를 조립 */
export function buildPrompt({ subject_phrase: s, distractors = [], has_face }) {
  const removal = distractors.length
    ? `Remove only these separate things around it: ${distractors.join(", ")}.`
    : "";

  return [
    `Redraw ${s} as a low-resolution pixel art game item sprite.`,
    "Large chunky square pixels on a coarse grid about 64 pixels wide,",
    "flat limited color palette, hard aliased edges, thick dark outline,",
    "no gradients, no soft shading, no photographic texture, no fine detail.",
    `Treat ${s} as one whole object — keep everything inside it or attached to it,`,
    "including all contents, toppings, fillings, clothing, accessories and parts.",
    "Never pick out one piece and discard the rest.",
    "Keep the physical object itself; never replace it with a character, logo or label printed on its surface.",
    removal,
    "Isolated cutout sticker with nothing beneath it, no shadow.",
    "Flat solid magenta background, RGB 255 0 255, completely uniform.",
    "Fit the whole object inside the frame with a small margin on every side.",
    has_face ? "Keep the face expression clear and readable." : "",
    `Keep ${s} the same object with the same shape, proportions and viewing angle.`,
  ].filter(Boolean).join(" ");
}

/** 원본 사진 버퍼 + 분석 결과 → 후처리까지 끝난 투명 PNG 버퍼 */
export async function makeSprite(photoBuffer, info, mimeType = "image/jpeg", keepRaw = null) {
  const id = randomUUID();
  const rawPath = path.join(tmpdir(), `dotre_${id}_raw.png`);
  const outPath = path.join(tmpdir(), `dotre_${id}.png`);

  try {
    const result = await replicate.run("black-forest-labs/flux-kontext-pro", {
      input: {
        input_image: new Blob([photoBuffer], { type: mimeType }),
        prompt: buildPrompt(info),
        output_format: "png",
        aspect_ratio: "1:1"
      }
    });

    const url = Array.isArray(result) ? String(result[0]) : String(result);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`DOWNLOAD_FAILED_${res.status}`);
    await writeFile(rawPath, Buffer.from(await res.arrayBuffer()));

    const { stdout } = await run(PY, [SCRIPT, rawPath, outPath], { timeout: 90_000 });
    const meta = JSON.parse(stdout.trim());

    return { sprite: await readFile(outPath), meta };
  } finally {
    if (keepRaw) {
      await writeFile(keepRaw, await readFile(rawPath).catch(() => Buffer.alloc(0)));
    }
    await Promise.allSettled([unlink(rawPath), unlink(outPath)]);
  }
}