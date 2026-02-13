import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    { pattern: /^(bg|text|border)-resolve-(bg|panel|border|text|muted|accent)/ },
    { pattern: /^(bg|text|border)-cinema-(success|danger)/ },
  ],
  theme: {
    extend: {
      colors: {
        /* DaVinci Resolve–inspired: dark grey with slight blue cast */
        resolve: {
          bg: '#0d0d0f',
          panel: '#1a1a1e',
          'panel-hover': '#222226',
          border: '#2e2e32',
          'border-light': '#3a3a3e',
          text: '#e8e8ec',
          muted: '#8e8e93',
          accent: '#5c7c99',
          'accent-hover': '#6b8fad',
        },
        cinema: {
          bg: '#0d0d0f',
          card: '#1a1a1e',
          amber: '#b8a035',
          'amber-dim': '#9a8630',
          success: '#2d8a5e',
          danger: '#c94a4a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        mono: ['var(--font-mono)', 'Consolas', 'monospace'],
      },
      borderRadius: {
        resolve: '3px',
        'resolve-sm': '2px',
      },
    },
  },
  plugins: [],
}
export default config
