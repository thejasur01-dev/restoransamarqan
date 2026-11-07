import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Poster storage on the local disk (UPLOAD_DIR, default ./uploads), served by /media/[name].
 * With several app servers this directory must be shared storage (or swapped for S3-like
 * object storage); file names are content hashes, so any storage works as a drop-in.
 */
// turbopackIgnore: a dynamic path from process.cwd() would make Next trace the whole project into the server bundle
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(/* turbopackIgnore: true */ process.cwd(), "uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPES = [
  { ext: "jpg", mime: "image/jpeg", test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

/** Identifies the image by its bytes, never by the file name or the browser's claim. */
export function detectImage(bytes: Buffer) {
  return TYPES.find((t) => t.test(bytes)) ?? null;
}

export async function saveImage(bytes: Buffer) {
  const type = detectImage(bytes);
  if (!type) throw new Error("unsupported");
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${type.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, name), bytes);
  return `/media/${name}`;
}

const NAME = /^[0-9a-f]{32}\.(jpg|png|webp)$/;

export async function readImage(name: string) {
  if (!NAME.test(name)) return null;
  try {
    const bytes = await readFile(join(/* turbopackIgnore: true */ UPLOAD_DIR, name));
    return { bytes, mime: TYPES.find((t) => name.endsWith(`.${t.ext}`))!.mime };
  } catch {
    return null;
  }
}
