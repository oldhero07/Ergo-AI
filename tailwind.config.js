import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        risk: {
          low: "hsl(var(--risk-low))",
          medium: "hsl(var(--risk-medium))",
          high: "hsl(var(--risk-high))",
          veryhigh: "hsl(var(--risk-veryhigh))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px hsl(222 40% 4% / 0.05), 0 4px 16px hsl(222 40% 4% / 0.07)",
        "card-hover": "0 2px 4px hsl(222 40% 4% / 0.07), 0 8px 28px hsl(222 40% 4% / 0.12)",
        glow: "0 0 0 1px hsl(var(--glow-primary) / 0.35), 0 0 24px -4px hsl(var(--glow-primary) / 0.5)",
        "glow-sm": "0 0 0 1px hsl(var(--glow-primary) / 0.25), 0 0 12px -2px hsl(var(--glow-primary) / 0.4)",
        "glow-accent": "0 0 0 1px hsl(var(--glow-accent) / 0.3), 0 0 24px -4px hsl(var(--glow-accent) / 0.45)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 1px hsl(var(--glow-primary) / 0.25), 0 0 12px -2px hsl(var(--glow-primary) / 0.35)" },
          "50%": { boxShadow: "0 0 0 1px hsl(var(--glow-primary) / 0.45), 0 0 28px -2px hsl(var(--glow-primary) / 0.6)" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        scanline: "scanline 4s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
