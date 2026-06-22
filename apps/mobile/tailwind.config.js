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
        // ── Surface layers ─────────────────────────────────────────────────
        // Deep Obsidian: not pure black, warm near-black with a purple tint
        surface:            '#09080E', // bg-surface — every screen background
        'surface-card':     '#131118', // bg-surface-card — cards, panels, inputs
        'surface-elevated': '#1E1B2A', // modals, bottom sheets, dropdowns
        'surface-muted':    '#2A2638', // hover, pressed, selected rows
        'surface-border':   '#3D3850', // bg-surface-border, border-surface-border — dividers
        'border-strong':    '#564F6A', // focused inputs, active tabs

        // ── Brand Primary: Coral Orange ─────────────────────────────────────
        // Nigerian energy. Lagos sunsets. Opportunity and urgency.
        // No major recruitment platform uses this — it is uniquely Workstation.
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
        // All existing screens that use bg-primary-500, text-primary-400 etc.
        // will automatically show coral orange instead of indigo.
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
        // Precision. Verification. Ice-cool technology.
        // Complementary to coral on the colour wheel — creates visual tension.
        teal: {
          400:     '#3EFFE0',
          500:     '#0DD4C3',
          600:     '#00A89A',
          900:     '#08332F',
          DEFAULT: '#0DD4C3',
        },

        // ── Trust Score ─────────────────────────────────────────────────────
        // Non-negotiable. These exact colours must appear on every trust-
        // related element across all 98 screens without variation.
        trust: {
          high:          '#22C55E', // 70–100: verified, safe
          'high-bg':     '#052E16',
          'high-border': '#15803D',
          mid:           '#F59E0B', // 40–69: partial / pending
          'mid-bg':      '#2D1B00',
          'mid-border':  '#92400E',
          low:           '#EF4444', // 0–39: unverified, flagged
          'low-bg':      '#2D0E0E',
          'low-border':  '#991B1B',
        },

        // ── Semantic ────────────────────────────────────────────────────────
        success:        '#22C55E',
        warning:        '#F59E0B',
        error:          '#EF4444',
        info:           '#0DD4C3',
        gold:           '#F59E0B',
        'admin-accent': '#A855F7',
      },

      fontFamily: {
        // Plus Jakarta Sans — all headlines, display text, screen titles (20px+)
        display:  ['PlusJakartaSans_700Bold', 'sans-serif'],
        // Inter — all body copy, UI labels, buttons, inputs, captions
        sans:     ['Inter_400Regular', 'sans-serif'],
        medium:   ['Inter_500Medium', 'sans-serif'],
        semibold: ['Inter_600SemiBold', 'sans-serif'],
        bold:     ['Inter_700Bold', 'sans-serif'],
        // JetBrains Mono — NIN, RC numbers, OTP, trust scores, reference codes
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
