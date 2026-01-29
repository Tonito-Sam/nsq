/** @type {import('tailwindcss').Config} */
// Neutral minimal config to avoid being picked up by root Tailwind during dev
module.exports = {
  content: [
    "./index.html",
  ],
  theme: { extend: {} },
  plugins: [],
};
