/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./note.html",
    "./renderer.js",
    "./note-renderer.js",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf6',
          100: '#dffcee',
          200: '#c1f9de',
          300: '#8ef5c1',
          400: '#55ea9b',
          500: '#38e07b',
          600: '#25c062',
          700: '#1e984f',
          800: '#1a7840',
          900: '#156235',
          950: '#0a361c',
        }
      }
    },
  },
  plugins: [],
}
