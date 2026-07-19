import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from "react";
import { THEMES } from "../constants/colors.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme = "dark" }) {
  const [theme, setTheme] = useState(initialTheme);

  const colors = useMemo(() => THEMES[theme], [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  // Add/remove class on root element for light/dark CSS targeting
  useEffect(() => {
    const root = document.querySelector(".smapp");
    if (root) {
      root.classList.toggle("light", theme === "light");
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, colors }),
    [theme, setTheme, toggleTheme, colors]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
