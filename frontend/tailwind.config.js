/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(222 47% 11%)",
        card: "hsl(223 47% 15%)",
        border: "hsl(217 32% 17%)",
        primary: "hsl(217 91% 60%)",
        critical: "hsl(0 84% 60%)",
        warning: "hsl(38 92% 50%)",
        info: "hsl(200 95% 48%)",
        success: "hsl(142 76% 45%)"
      }
    },
  },
  plugins: [],
}
