"use client";

import type { ReactNode } from "react";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";

export interface ProjectSelectOption {
  value: string;
  label: string;
}

interface ProjectSelectBarProps {
  themeMode: ThemeMode;
  value: string;
  options: ProjectSelectOption[];
  onChange: (value: string) => void;
  label?: string;
  trailingContent?: ReactNode;
}

export default function ProjectSelectBar({
  themeMode,
  value,
  options,
  onChange,
  label = "프로젝트",
  trailingContent,
}: ProjectSelectBarProps) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
        padding: "12px 16px",
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          flex: 1,
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: colors.background,
          color: colors.textPrimary,
          fontSize: 13,
          fontFamily: typography.fontFamily.mono,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {trailingContent}
    </div>
  );
}
