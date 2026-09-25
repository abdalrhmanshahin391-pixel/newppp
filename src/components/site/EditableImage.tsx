import { useSiteImage } from "@/lib/site-images";

type Props = {
  /** Stable identifier for this picture, e.g. "home.ipad". */
  imageKey: string;
  /** Built-in artwork used when no replacement has been uploaded. */
  fallback: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  /** Retained for compatibility with existing call sites. */
  wrapperClassName?: string;
};

/** A site picture with an optional previously selected override. */
export function EditableImage({
  imageKey,
  fallback,
  alt,
  className,
  width,
  height,
  loading = "lazy",
  fetchPriority = "auto",
  wrapperClassName: _wrapperClassName,
}: Props) {
  const src = useSiteImage(imageKey, fallback);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      {...(width ? { width } : {})}
      {...(height ? { height } : {})}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
    />
  );
}
