import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: '#09080E',
          card: '#131118',
          elevated: '#1E1B2A',
          muted: '#2A2638',
          border: '#3D3850',
          'border-strong': '#564F6A',
        },
        brand: {
          200: '#FFD8CE',
          300: '#FFAB97',
          400: '#FF8264',
          500: '#FF6240',
          600: '#D9451E',
          800: '#7C2210',
          DEFAULT: '#FF6240',
        },
        teal: {
          400: '#3EFFE0',
          500: '#0DD4C3',
          600: '#00A89A',
          900: '#08332F',
          DEFAULT: '#0DD4C3',
        },
        admin: {
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7',
          600: '#9333EA',
          800: '#581C87',
          900: '#2E1065',
          DEFAULT: '#A855F7',
        },
        trust: {
          high: '#22C55E',
          'high-bg': '#052E16',
          'high-border': '#15803D',
          mid: '#F59E0B',
          'mid-bg': '#2D1B00',
          'mid-border': '#92400E',
          low: '#EF4444',
          'low-bg': '#2D0E0E',
          'low-border': '#991B1B',
        },
        text: {
          primary: '#FFFFFF',
          body: '#E2E8F0',
          secondary: '#94A3B8',
          muted: '#475569',
          disabled: '#334155',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#0DD4C3',
        gold: '#F59E0B',
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
}

export default config
