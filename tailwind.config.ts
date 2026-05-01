import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#ECFBF7",
          100: "#D4F5EB",
          200: "#A7EBD7",
          300: "#6FDBBC",
          400: "#3ECFA5",
          500: "#1FBF92",
          600: "#10A47A",
        },
        coral: {
          100: "#FFE6DE",
          300: "#FFB4A0",
          500: "#FF8364",
          600: "#F26849",
        },
        gray: {
          50: "#F9FAFB",
          100: "#F2F4F6",
          200: "#E5E8EB",
          300: "#D1D6DB",
          400: "#B0B8C1",
          500: "#8B95A1",
          600: "#6B7684",
          700: "#4E5968",
          800: "#333D4B",
          900: "#191F28",
        },
      },
      fontFamily: {
        sans: ["'Pretendard Variable'", "Pretendard", "-apple-system", "system-ui", "sans-serif"],
      },
      fontSize: {
        "title-xl": ["24px", { lineHeight: "1.4", fontWeight: "700" }],
        "title-l": ["20px", { lineHeight: "1.4", fontWeight: "700" }],
        "title-m": ["17px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-m": ["15px", { lineHeight: "1.5", fontWeight: "500" }],
        "body-s": ["13px", { lineHeight: "1.5", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        card: "0 4px 16px rgba(0, 0, 0, 0.04)",
        button: "0 10px 30px rgba(31, 191, 146, 0.35)",
        nav: "0 -2px 20px rgba(0, 0, 0, 0.04)",
        ctrl: "0 8px 24px rgba(0, 0, 0, 0.08)",
        end: "0 12px 28px rgba(255, 131, 100, 0.4)",
        orb: "0 20px 50px rgba(31, 191, 146, 0.25)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.92)", opacity: "0.18" },
          "85%": { opacity: "0" },
          "100%": { transform: "scale(1.08)", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(0.97)" },
          "50%": { transform: "scale(1.05)" },
        },
        halo: {
          "0%, 100%": { transform: "scale(0.95)", opacity: "0.55" },
          "50%": { transform: "scale(1.08)", opacity: "0.85" },
        },
        "dot-blink": {
          "0%, 80%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-3px)" },
        },
        "splash-enter": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "splash-leave": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.02)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 4.5s ease-out infinite",
        breathe: "breathe 3.6s ease-in-out infinite",
        halo: "halo 3.6s ease-in-out infinite",
        "dot-blink": "dot-blink 1.4s ease-in-out infinite",
        "splash-enter": "splash-enter 700ms cubic-bezier(0.22, 0.9, 0.3, 1) forwards",
        "splash-leave": "splash-leave 280ms cubic-bezier(0.4, 0, 1, 1) forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
