/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        surface: {
          DEFAULT: '#0F172A',
          card:    '#1E293B',
          border:  '#334155',
          muted:   '#475569',
        },
        trust: {
          low:  '#EF4444',
          mid:  '#F59E0B',
          high: '#10B981',
        },
        verified: '#10B981',
        badge:    '#6366F1',
      },
      fontFamily: {
        sans:     ['Inter_400Regular'],
        medium:   ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold:     ['Inter_700Bold'],
      },
    },
  },
  plugins: [],
}
