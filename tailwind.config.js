/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
  "./index.html",
  "./src/**/*.{js,jsx}",
],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8b5cf6',
          dark: '#7c3aed',
        },
        danger: {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 