import type { CSSProperties } from "react";

export const theme = {
  colors: {
    canvas: "#f4f7f2",
    ink: "#19241c",
    muted: "#5a695f",
    brand: "#176b3a",
    brandStrong: "#0f522c",
    brandSoft: "#e5f3e9",
    surface: "#ffffff",
    border: "#d5dfd6",
    focus: "#236fd1",
  },
  radii: {
    small: "0.5rem",
    medium: "0.875rem",
    large: "1.25rem",
  },
  shadows: {
    card: "0 1rem 2.5rem rgb(25 36 28 / 9%)",
  },
} as const;

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export const themeStyle: ThemeStyle = {
  "--color-canvas": theme.colors.canvas,
  "--color-ink": theme.colors.ink,
  "--color-muted": theme.colors.muted,
  "--color-brand": theme.colors.brand,
  "--color-brand-strong": theme.colors.brandStrong,
  "--color-brand-soft": theme.colors.brandSoft,
  "--color-surface": theme.colors.surface,
  "--color-border": theme.colors.border,
  "--color-focus": theme.colors.focus,
  "--shadow-card": theme.shadows.card,
  "--radius-sm": theme.radii.small,
  "--radius-md": theme.radii.medium,
  "--radius-lg": theme.radii.large,
};
