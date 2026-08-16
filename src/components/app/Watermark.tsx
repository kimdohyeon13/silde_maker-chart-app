"use client";

const WATERMARK_TEXT = "@wltechrsrch";

interface WatermarkProps {
  color: string;
}

// NEXT_PUBLIC_HIDE_WATERMARK=1 로 실행하면 워터마크를 숨긴다.
// 워터마크 없는 납품본이 필요한 프로젝트에서만 쓰고, 기본값은 노출이다.
const HIDDEN = process.env.NEXT_PUBLIC_HIDE_WATERMARK === "1";

export default function Watermark({ color }: WatermarkProps) {
  if (HIDDEN) return null;
  return (
    <span
      data-watermark="wltechrsrch"
      aria-label={WATERMARK_TEXT}
      style={{
        position: "absolute",
        right: 12,
        bottom: 8,
        zIndex: 10,
        color,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.02em",
        opacity: 0.62,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {WATERMARK_TEXT}
    </span>
  );
}
