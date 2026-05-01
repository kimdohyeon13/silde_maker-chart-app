"use client";

import { useEffect, useState } from "react";
import type { ThemeMode } from "@/lib/theme/toss-theme";

export function useThemeMode(initialMode: ThemeMode = "dark") {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    document.documentElement.classList.toggle("light", themeMode === "light");
  }, [themeMode]);

  function toggleTheme() {
    setThemeMode((currentMode) =>
      currentMode === "dark" ? "light" : "dark"
    );
  }

  return {
    isDark: themeMode === "dark",
    setThemeMode,
    themeMode,
    toggleTheme,
  };
}
