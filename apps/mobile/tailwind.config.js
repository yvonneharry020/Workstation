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
        // ── Surface layers — eggshell light theme ──────────────────────────
        surface:            '#F5F0E8', // bg-surface — every screen background
        'surface-card':     '#EDE7DB', // bg-surface-card — cards, panels, inputs
        'surface-elevated': '#E5DFD3', // modals, bottom sheets, dropdowns
        'surface-muted':    '#D4CCBE', // hover, pressed, selected rows
        'surface-border':   '#C8BFB0', // bg-surface-border, border-surface-border — dividers
        'border-strong':    '#9A8FA6', // focused inputs, active tabs

        // ── Brand Primary: Coral Orange ─────────────────────────────────────
        brand: {
          200:     '#FFD8CE',
          300:     '#FFAB97',
          400:     '#FF8264',
          500:     '#FF6240',
          600:     '#D9451E',
          800:     '#7C2210',
          DEFAULT: '#FF6240',
        },

        // ── primary: backward-compat alias → maps to Coral Orange ──────────
        primary: {
          200:     '#FFD8CE',
          300:     '#FFAB97',
          400:     '#FF8264',
          500:     '#FF6240',
          600:     '#D9451E',
          700:     '#D9451E',
          800:     '#7C2210',
          DEFAULT: '#FF6240',
        },

        // ── Secondary: Electric Teal ────────────────────────────────────────
        teal: {
          400:     '#3EFFE0',
          500:     '#0DD4C3',
          600:     '#00A89A',
          900:     '#08332F',
          DEFAULT: '#0DD4C3',
        },

        // ── Trust Score ─────────────────────────────────────────────────────
        trust: {
          high:          '#22C55E',
          'high-bg':     '#DCFCE7', // light green tint for light theme
          'high-border': '#15803D',
          mid:           '#F59E0B',
          'mid-bg':      '#FEF3C7', // light amber tint for light theme
          'mid-border':  '#92400E',
          low:           '#EF4444',
          'low-bg':      '#FEE2E2', // light red tint for light theme
          'low-border':  '#991B1B',
        },

        // ── Semantic ────────────────────────────────────────────────────────
        success:        '#22C55E',
        warning:        '#F59E0B',
        error:          '#EF4444',
        info:           '#0DD4C3',
        gold:           '#F59E0B',
        'admin-accent': '#A855F7',

        // ── Slate overrides — darken light greys for readability on eggshell
        slate: {
          300: '#2D2640', // was #CBD5E1 (too light on eggshell)
          400: '#5A4F6E', // was #94A3B8 (too light on eggshell)
          // 500–900 are dark enough, kept at Tailwind defaults
        },
      },

      fontFamily: {
        display:  ['PlusJakartaSans_700Bold', 'sans-serif'],
        sans:     ['Inter_400Regular', 'sans-serif'],
        medium:   ['Inter_500Medium', 'sans-serif'],
        semibold: ['Inter_600SemiBold', 'sans-serif'],
        bold:     ['Inter_700Bold', 'sans-serif'],
        mono:     ['JetBrainsMono_400Regular', 'monospace'],
        'mono-bold': ['JetBrainsMono_700Bold', 'monospace'],
      },

      fontSize: {
        display:  ['48px', { lineHeight: '56px', fontWeight: '800' }],
        '4xl':    ['36px', { lineHeight: '44px', fontWeight: '700' }],
        '3xl':    ['30px', { lineHeight: '38px', fontWeight: '700' }],
        '2xl':    ['24px', { lineHeight: '32px', fontWeight: '700' }],
        xl:       ['20px', { lineHeight: '28px', fontWeight: '600' }],
        lg:       ['18px', { lineHeight: '26px', fontWeight: '600' }],
        base:     ['16px', { lineHeight: '24px' }],
        md:       ['15px', { lineHeight: '22px' }],
        sm:       ['13px', { lineHeight: '18px' }],
        xs:       ['11px', { lineHeight: '16px', fontWeight: '500' }],
        mono:     ['14px', { lineHeight: '20px', fontWeight: '700' }],
        'mono-sm':['12px', { lineHeight: '16px' }],
      },

      borderRadius: {
        sm:      '6px',
        DEFAULT: '8px',
        md:      '10px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
        '3xl':   '24px',
        full:    '9999px',
      },
    },
  },
  plugins: [],
}
