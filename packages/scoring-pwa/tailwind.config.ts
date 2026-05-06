import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          bg:      '#070e0a',
          surface: '#0f1e15',
          raised:  '#162b1d',
          border:  '#1e3a27',
          muted:   '#2d5c3c',
        },
        accent: {
          green:       '#22c55e',
          'green-dim': '#16a34a',
          gold:        '#f59e0b',
          'gold-dim':  '#d97706',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim:     '#dc2626',
        },
        extras: {
          wide: '#f59e0b',
          bye:  '#94a3b8',
        },
        // Legacy aliases — existing components compile without changes
        willow: {
          green: '#22c55e',
          gold:  '#f59e0b',
          night: '#070e0a',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'score-xl': ['6rem',   { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '900' }],
        'score-lg': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
        overs:      ['2rem',   { lineHeight: '1', fontWeight: '700' }],
      },
      borderRadius: { btn: '14px' },
      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pop:   { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
        flash: { '0%, 100%': { backgroundColor: 'transparent' }, '50%': { backgroundColor: 'rgba(245,158,11,0.15)' } },
        'score-flash': {
          '0%':   { color: '#f59e0b', transform: 'scale(1.04)' },
          '100%': { color: 'inherit', transform: 'scale(1)' },
        },
        'btn-press': {
          '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(0.93)' }, '100%': { transform: 'scale(1)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 150ms ease-out',
        'slide-up':   'slide-up 220ms cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slide-down 150ms ease-out',
        pop:          'pop 220ms ease-out',
        flash:        'flash 600ms ease-out',
        'score-flash':'score-flash 400ms ease-out',
        'btn-press':  'btn-press 120ms ease-out',
        'sheet-up':   'sheet-up 300ms cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
