/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './note.html',
    './**/*.{html,js,ts,jsx,tsx}',
  ],
  darkMode: 'class', // activa tema oscuro con .dark en html/body
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: {
        // Unificamos a Roboto, que ya importas en styles.css
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
          950: 'rgb(var(--primary-950) / <alpha-value>)',
        },
      },
      borderRadius: { '2xl': '1rem' },
      boxShadow: {
        soft: '0 10px 25px -5px rgb(0 0 0 / 0.07), 0 8px 10px -6px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/line-clamp'),
  ],
  safelist: [
    // Mantiene dinámicos bg/text/border con niveles y opacidad /10, /20, ...
    { pattern: /(bg|text|border)-primary-(50|100|200|300|400|500|600|700|800|900|950)(\/\d{1,3})?/ },
  ],
};
