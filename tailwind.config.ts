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
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.92)", opacity: "0.18" },
          "85%": { opacity: "0" },
          "100%": { transform: "scale(1.08)", opacity: "0" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 4.5s ease-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
