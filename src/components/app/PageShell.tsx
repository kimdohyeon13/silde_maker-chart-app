"use client";

import type { ReactNode } from "react";
import { getTheme, type ThemeMode } from "@/lib/theme/toss-theme";

interface PageShellProps {
  title: string;
  description: string;
  themeMode: ThemeMode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function PageShell({
  title,
  description,
  themeMode,
  actions,
  children,
}: PageShellProps) {
  const theme = getTheme(themeMode);
  const { colors, typography } = theme;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 24px",
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: typography.fontFamily.sans,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: colors.textPrimary,
              margin: 0,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              margin: "4px 0 0",
            }}
          >
            {description}
          </p>
        </div>

        {actions && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            {actions}
          </div>
        )}
      </header>

      {children}
    </main>
  );
}
