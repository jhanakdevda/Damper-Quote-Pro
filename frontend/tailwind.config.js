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
        pastel: {
          canvas: '#F9F7F2',
          surface: '#FFFFFF',
          'surface-warm': '#F5F1E8',
          'surface-muted': '#EFEBE1',
          border: '#E8E3D8',
          'border-subtle': '#F0ECE3',
          sage: '#3D6353',
          'sage-hover': '#325244',
          'sage-light': '#EEF5F1',
          'sage-border': '#D0E2D7',
          terracotta: '#C46346',
          'terracotta-hover': '#B05337',
          'terracotta-light': '#FDF1EB',
          'terracotta-border': '#F7D5C8',
          sky: '#476885',
          'sky-light': '#EFF5FA',
          'sky-border': '#D5E4F2',
          honey: '#B8832E',
          'honey-light': '#FEF7EB',
          'honey-border': '#F8E3C0',
          mauve: '#6B5C7B',
          'mauve-light': '#F6F1F8',
          'mauve-border': '#E5DAEA',
          charcoal: '#242826',
          muted: '#5C6460',
          subtle: '#88918C',
        },
        cincom: {
          blue: '#3D6353',
          'blue-dark': '#325244',
          'blue-light': '#EEF5F1',
          orange: '#C46346',
          'orange-hover': '#B05337',
          navy: '#476885',
          charcoal: '#242826',
          muted: '#5C6460',
          border: '#E8E3D8',
        },
        brand: {
          50: '#EEF5F1',
          100: '#DDECE2',
          500: '#3D6353',
          600: '#345547',
          700: '#2B463A',
          800: '#23382F',
          900: '#1B2C24',
          950: '#121E18',
        }
      }
    },
  },
  plugins: [],
}
