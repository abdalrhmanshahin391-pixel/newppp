// Pure rules for a lesson's resources (PDF, link, video). No server or browser
// imports so the rules can be unit tested with node.
import { z } from "zod";

export const RESOURCE_KINDS = ["pdf", "link", "video"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const MAX_RESOURCES = 12;
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const RESOURCES_BUCKET = "rita-lesson-resources";

export type Resource = {
  id: string;
  lesson_id: string;
  kind: ResourceKind;
  title: string;
  note: string;
  url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  position: number;
};

/** What the learner gets: the stored path never leaves the server, only a link that opens. */
export type LearnerResource = {
  id: string;
  kind: ResourceKind;
  title: string;
  note: string;
  href: string;
  host: string;
  size: number | null;
};

const text = (max: number) => z.string().trim().max(max);

/**
 * Returns a safe https address, or null. Adds https:// when the scheme is
 * missing, so "youtube.com/watch?v=x" works; anything else (javascript:, data:,
 * http:, file:, an address with a login) is refused.
 */
export function normaliseUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > 2000 || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "loom.com"];

/** True for addresses that are clearly a video page, so the form can suggest the right type. */
export function looksLikeVideo(url: string): boolean {
  const host = hostLabel(url);
  return VIDEO_HOSTS.some((video) => host === video || host.endsWith(`.${video}`));
}

/** A readable title from a file name: "week-3_summary.pdf" becomes "week 3 summary". */
export function titleFromFileName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function titleFromUrl(url: string): string {
  return hostLabel(url).slice(0, 160);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** First problem with a PDF the admin picked, or null. Checked again on the server. */
export function pdfProblem(file: { name: string; size: number; type: string }): string | null {
  const named = /\.pdf$/i.test(file.name);
  if (!named && file.type !== "application/pdf") return "الملف ليس PDF.";
  if (file.size <= 0) return "الملف فارغ.";
  if (file.size > MAX_PDF_BYTES) {
    return `الملف كبير (${formatBytes(file.size)}). الحد الأقصى ${formatBytes(MAX_PDF_BYTES)}.`;
  }
  return null;
}

/** A real PDF starts with "%PDF-"; a renamed image or page does not. */
export function hasPdfSignature(head: Uint8Array): boolean {
  const mark = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return mark.every((byte, index) => head[index] === byte);
}

export function canAddResource(count: number): boolean {
  return count < MAX_RESOURCES;
}

/** Where a lesson's PDF is stored. The id keeps names unique and never reuses the user's file name. */
export function pdfStoragePath(lessonId: string, fileId: string): string {
  return `lessons/${lessonId}/${fileId}.pdf`;
}

/** The server only accepts a stored path that sits under the lesson it is being added to. */
export function isPdfPathFor(lessonId: string, path: string): boolean {
  return new RegExp(`^lessons/${lessonId}/[0-9a-f-]{36}\\.pdf$`, "i").test(path);
}

const resourceFields = {
  title: text(160).min(1, "العنوان مطلوب"),
  note: text(300).default(""),
};

export const NewLinkSchema = z.object({
  kind: z.enum(["link", "video"]),
  url: z.string().transform((value, ctx) => {
    const url = normaliseUrl(value);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "الرابط يجب أن يبدأ بـ https وأن يكون صحيحًا" });
      return z.NEVER;
    }
    return url;
  }),
  ...resourceFields,
});

export const NewPdfSchema = z.object({
  kind: z.literal("pdf"),
  file_path: text(300).min(1),
  file_name: text(200).min(1),
  file_size: z.number().int().min(1).max(MAX_PDF_BYTES),
  ...resourceFields,
});

export const NewResourceSchema = z.discriminatedUnion("kind", [NewLinkSchema, NewPdfSchema]);
export type NewResource = z.infer<typeof NewResourceSchema>;

export const ResourceEditSchema = z.object({ ...resourceFields });

/** Moves one resource up or down and renumbers positions from 0. Same list when it cannot move. */
export function moveResource<T extends { id: string; position: number }>(
  list: T[],
  id: string,
  direction: "up" | "down",
): T[] {
  const ordered = sortResources(list);
  const from = ordered.findIndex((item) => item.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ordered.length) return list;
  const next = ordered.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next.map((item, index) => ({ ...item, position: index }));
}

export function sortResources<T extends { position: number }>(list: T[]): T[] {
  return list.slice().sort((a, b) => a.position - b.position);
}

/** The position a new resource takes: the end of the list. */
export function nextPosition(list: { position: number }[]): number {
  return list.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

/** A reorder is valid only if it names exactly the lesson's resources, once each. */
export function isCompleteOrder(currentIds: string[], orderedIds: string[]): boolean {
  if (currentIds.length !== orderedIds.length) return false;
  const wanted = new Set(currentIds);
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!wanted.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

export const KIND_LABEL_AR: Record<ResourceKind, string> = {
  pdf: "ملف PDF",
  link: "رابط",
  video: "فيديو",
};
