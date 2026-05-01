"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";

type ActionButtonVariant = "primary" | "secondary";

interface ActionButtonProps {
  children: ReactNode;
  themeMode: ThemeMode;
  variant?: ActionButtonVariant;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  style?: CSSProperties;
}

export default function ActionButton({
  children,
  themeMode,
  variant = "secondary",
  href,
  onClick,
  disabled = false,
  style,
}: ActionButtonProps) {
  const theme = getTheme(themeMode);
  const { colors } = theme;

  const baseStyle: CSSProperties = {
    padding: "8px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: variant === "primary" ? 700 : 500,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
  };

  const variantStyle: CSSProperties =
    variant === "primary"
      ? {
          border: "none",
          background: disabled ? colors.surfaceActive : colors.accent,
          color: disabled ? colors.textTertiary : "#FFFFFF",
        }
      : {
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.textPrimary,
        };

  const mergedStyle = {
    ...baseStyle,
    ...variantStyle,
    ...style,
  };

  if (href) {
    return (
      <Link href={href} style={mergedStyle}>
        {children}
      </Link>
    );
  }

  return (
    <button disabled={disabled} onClick={onClick} style={mergedStyle}>
      {children}
    </button>
  );
}
