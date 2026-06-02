/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050816",
        card: "#0B1020",
        border: "rgba(255, 255, 255, 0.06)",
        primary: "#A855F7", // Purple Accent
        secondary: "#38BDF8", // Cyan Accent
        success: "#22C55E",
        warning: "#F59E0B",
        critical: "#EF4444",
        navyDark: "#050816",
        navyMid: "#0B1020",
        navyLight: "#121B35",
      }
    },
  },
  plugins: [],
}
