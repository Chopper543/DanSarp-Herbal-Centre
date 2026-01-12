"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Use startTransition to make theme initialization non-blocking
    startTransition(() => {
      setMounted(true);
      // Check if theme was already set by inline script
      const root = document.documentElement;
      const hasDarkClass = root.classList.contains("dark");
      const savedTheme = localStorage.getItem("theme") as Theme | null;
      
      if (savedTheme) {
        setTheme(savedTheme);
      } else if (hasDarkClass) {
        setTheme("dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      }
    });
  }, []);

  useEffect(() => {
    if (mounted) {
      // DOM updates must be immediate to prevent flicker
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      // Use requestIdleCallback for localStorage to avoid blocking
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        requestIdleCallback(() => {
          localStorage.setItem("theme", theme);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          localStorage.setItem("theme", theme);
        }, 0);
      }
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values during SSR or when provider is not available
    return {
      theme: "light" as Theme,
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
