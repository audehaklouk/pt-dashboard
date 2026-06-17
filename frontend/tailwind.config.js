/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F4F7FC',
          surface: '#FFFFFF',
          'surface-2': '#F8FAFF',
          border: '#E6ECF5',
          primary: '#2D5BFF',
          'primary-hover': '#1E40C8',
          'primary-100': '#E8EEFF',
          accent: '#FFC629',
          'accent-ink': '#1A2A4F',
          success: '#22C55E',
          danger: '#EF4444',
          text: '#0F1B3D',
          'text-secondary': '#5B6B8C',
          'text-muted': '#94A3B8',
        },
        chart: {
          blue: '#2D5BFF',
          teal: '#22C7B8',
          amber: '#FFC629',
          violet: '#7C5CFC',
          rose: '#FF7A8A',
          green: '#34D399',
          grey: '#64748B',
        },
      },
      borderRadius: {
        card: '16px',
        btn: '10px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.04)',
        'card-hover': '0 4px 6px rgba(16,24,40,.07), 0 2px 4px rgba(16,24,40,.05)',
      },
      fontFamily: {
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
