/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Tokens Figma aprobados por el cliente (Sección 8.1 - prevalece sobre uni-noche)
        primary: {
          DEFAULT: '#0A2540',
          dark: '#061729',
          light: '#133961',
        },
        secondary: {
          DEFAULT: '#D97706',
          dark: '#B45309',
          light: '#F59E0B',
        },
        app: {
          bg: '#F8FAFC',
          surface: '#FFFFFF',
        },
        status: {
          success: '#16A34A',
          danger: '#DC2626',
          warning: '#EA580C',
        },
        // Alias de compatibilidad
        'uni-primario': '#0A2540',
        'uni-acento': '#D97706',
        'uni-fondo': '#F8FAFC',
        'uni-superficie': '#FFFFFF',
        'uni-exito': '#16A34A',
        'uni-error': '#DC2626',
        'uni-alerta': '#EA580C',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        cardHover: '0 10px 15px -3px rgba(10, 37, 64, 0.08), 0 4px 6px -4px rgba(10, 37, 64, 0.04)',
        modal: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
