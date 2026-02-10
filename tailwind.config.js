/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        progress: 'progress 2s infinite linear',
      },
      keyframes: {
        progress: {
          '0%': { left: '-100%' },
          '100%': { left: '100%' },
        }
      }
    },
  },
  plugins: [],
}