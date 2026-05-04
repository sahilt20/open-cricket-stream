import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Willow CC brand colours — easy to override per-club via CSS vars.
        willow: {
          green: '#0b5c3b',
          gold: '#c8a955',
          night: '#06281b',
        },
      },
      fontFamily: {
        // System UI stack — fast, no web font load on a flaky 4G connection.
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
