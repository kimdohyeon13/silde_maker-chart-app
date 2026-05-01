"use client";

import type { ReactNode } from "react";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";

interface StatusPanelProps {
  themeMode: ThemeMode;
  children: ReactNode;
  dashed?: boolean;
}

export default function StatusPanel({
  themeMode,
  children,
  dashed = false,
}: StatusPanelProps) {
  const theme = getTheme(themeMode);
  const { colors } = theme;

  return (
    <div
      style={{
        textAlign: "center",
        padding: 48,
        borderRadius: 12,
        border: dashed ? `1px dashed ${colors.border}` : undefined,
        color: colors.textSecondary,
      }}
    >
      {children}
    </div>
  );
}
