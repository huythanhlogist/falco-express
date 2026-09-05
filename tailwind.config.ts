import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1140px",
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        navy: {
          50: "#eef2f8",
          100: "#d7e0ee",
          200: "#aec0dd",
          300: "#7f9bc6",
          400: "#4f74a9",
          500: "#2f5588",
          600: "#1f3f6b",
          700: "#183456",
          800: "#122844",
          900: "#0c1c31",
          950: "#08121f",
        },
        flame: {
          50: "#fff4ed",
          100: "#ffe4d3",
          200: "#ffc4a3",
          300: "#ff9c66",
          400: "#fc7a3a",
          500: "#f7941d",
          600: "#e85d0e",
          700: "#c8410e",
          800: "#a03212",
          900: "#832c13",
          950: "#471306",
        },
        ink: "#131a24",
        paper: "#fbfbfa",
        mist: "#f3f5f9",
        line: "#e3e8f0",
      },
      fontFamily: {
        display: ["var(--font-be-vietnam)", "sans-serif"],
        body: ["var(--font-be-vietnam)", "sans-serif"],
      },
      backgroundImage: {
        "falco-gradient": "linear-gradient(90deg, #f7941d 0%, #ed1c24 100%)",
        "falco-gradient-diag": "linear-gradient(135deg, #f7941d 0%, #ed1c24 100%)",
        "navy-gradient": "linear-gradient(180deg, #183456 0%, #0c1c31 100%)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,28,49,0.04), 0 8px 24px -8px rgba(12,28,49,0.12)",
        "card-hover": "0 4px 8px rgba(12,28,49,0.06), 0 16px 40px -12px rgba(12,28,49,0.18)",
        brand: "0 10px 30px -8px rgba(237,28,36,0.35)",
      },
      maxWidth: {
        content: "1280px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
