/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0f2744',
          800: '#16365c',
          700: '#1b4b7a',
        },
        gold: {
          400: '#e3b23c',
          500: '#d4a017',
        },
      },
    },
  },
  plugins: [],
};
