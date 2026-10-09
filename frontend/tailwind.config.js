/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        cincom: {
          blue: '#005daa',
          'blue-dark': '#004785',
          'blue-light': '#eff8fe',
          orange: '#f89030',
          'orange-hover': '#e67f22',
          navy: '#3b475d',
          charcoal: '#212529',
          muted: '#64748b',
          border: '#e2e8f0',
        },
        brand: {
          50: '#eff8fe',
          100: '#dbeafe',
          500: '#005daa',
          600: '#004f91',
          700: '#004177',
          800: '#00345e',
          900: '#002645',
          950: '#00192e',
        }
      }
    },
  },
  plugins: [],
}
