/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#E85D04',
          600: '#d45403',
          700: '#b34503',
          800: '#8c3503',
          900: '#6b2803',
        },
      },
    },
  },
  plugins: [],
};
