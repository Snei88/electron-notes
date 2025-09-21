// postcss.config.js
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: [
    // Habilita nesting opcional (puedes quitarlo si no lo usas)
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('autoprefixer'),
    // Minifica solo en producción
    ...(isProd ? [require('cssnano')({ preset: 'default' })] : []),
  ],
};
