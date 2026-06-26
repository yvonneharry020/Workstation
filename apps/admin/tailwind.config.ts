import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Semantic tokens — resolve via CSS variables (dark/light aware) ── */
        surface: {
          base:           'var(--bg-base)',
          card:           'var(--bg-card)',
          elevated:       'var(--bg-elevated)',
          muted:          'var(--bg-surface)',
          border:         'var(--border)',
          'border-strong':'var(--border-strong)',
        },
        text: {
          primary:  'var(--tx-1)',
          body:     'var(--tx-1)',
          secondary:'var(--tx-2)',
          muted:    'var(--tx-3)',
          disabled: 'var(--tx-3)',
        },

        /* ── Room accent palettes (static hex — used with opacity modifiers) ── */
        admin: {
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          800: '#3730A3',
          900: '#1E1B4B',
          DEFAULT: '#6366F1',
        },
        tech: {
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          800: '#155E75',
          900: '#0C3B4A',
          DEFAULT: '#06B6D4',
        },
        finance: {
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          800: '#065F46',
          900: '#023930',
          DEFAULT: '#10B981',
        },
        ops: {
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          800: '#92400E',
          900: '#3B1E06',
          DEFAULT: '#F59E0B',
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
        trust: {
          high:         '#22C55E',
          'high-bg':    '#052E16',
          'high-border':'#15803D',
          mid:          '#F59E0B',
          'mid-bg':     '#2D1B00',
          'mid-border': '#92400E',
          low:          '#EF4444',
          'low-bg':     '#2D0E0E',
          'low-border': '#991B1B',
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error:   '#EF4444',
        info:    '#06B6D4',
        gold:    '#F59E0B',
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        sans:    ['var(--font-inter)', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        sm:    '6px',
        DEFAULT:'8px',
        md:    '10px',
        lg:    '12px',
        xl:    '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        sm:   'var(--shadow-sm)',
        md:   'var(--shadow-md)',
        lg:   'var(--shadow-lg)',
        card: 'var(--shadow-card)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
