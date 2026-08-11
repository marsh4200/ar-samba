/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Surfaces: layered deep-navy, never flat black ───────────── */
        abyss:    '#070A12',   // app background
        hull:     '#0B0F1A',   // sidebar / rails
        panel:    '#111726',   // cards
        raised:   '#161E2F',   // hover / inset wells
        line:     '#212B3D',   // hairline borders

        /* ── Brand: cyan → azure signal ramp ─────────────────────────── */
        signal: {
          DEFAULT: '#0EA5E9',
          50:  '#ECFBFF',
          200: '#A5E8FF',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          900: '#0C4A6E',
        },

        /* ── Semantic ────────────────────────────────────────────────── */
        ok:    { DEFAULT: '#34D399', dim: '#059669' },
        warn:  { DEFAULT: '#FBBF24', dim: '#D97706' },
        crit:  { DEFAULT: '#F87171', dim: '#DC2626' },
        info:  { DEFAULT: '#818CF8', dim: '#6366F1' },

        /* ── Text ramp ───────────────────────────────────────────────── */
        /* Contrast-checked against `panel` (#111726):
           muted 8.0:1 · faint 5.4:1 · ghost 3.7:1 (decorative / disabled only) */
        ink: {
          DEFAULT: '#E8EDF5',   // primary text
          muted:   '#AEBACB',   // secondary
          faint:   '#8494A8',   // tertiary / captions
          ghost:   '#6A7A91',   // disabled / decorative
        },
      },

      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px — eyebrows, badges
      },

      borderRadius: {
        '4xl': '1.75rem',
      },

      boxShadow: {
        panel:  '0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)',
        lift:   '0 2px 4px rgba(0,0,0,.4), 0 16px 40px -16px rgba(0,0,0,.7)',
        float:  '0 24px 64px -20px rgba(0,0,0,.85)',
        signal: '0 0 0 1px rgba(14,165,233,.35), 0 8px 28px -10px rgba(14,165,233,.45)',
        inset:  'inset 0 1px 0 0 rgba(255,255,255,.05)',
      },

      transitionTimingFunction: {
        out: 'cubic-bezier(.16,1,.3,1)',
      },

      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        riseIn:   { from: { opacity: 0, transform: 'translateY(10px)' },
                    to:   { opacity: 1, transform: 'translateY(0)' } },
        popIn:    { from: { opacity: 0, transform: 'translate(-50%,-48%) scale(.97)' },
                    to:   { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' } },
        slideInR: { from: { opacity: 0, transform: 'translateX(16px)' },
                    to:   { opacity: 1, transform: 'translateX(0)' } },
        sweep:    { '0%': { backgroundPosition: '-150% 0' },
                    '100%': { backgroundPosition: '250% 0' } },
        breathe:  { '0%,100%': { opacity: 1 }, '50%': { opacity: .45 } },
      },
      animation: {
        'fade-in':  'fadeIn .2s ease-out both',
        'rise-in':  'riseIn .32s cubic-bezier(.16,1,.3,1) both',
        'pop-in':   'popIn .22s cubic-bezier(.16,1,.3,1) both',
        'slide-in': 'slideInR .28s cubic-bezier(.16,1,.3,1) both',
        'sweep':    'sweep 1.8s linear infinite',
        'breathe':  'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
