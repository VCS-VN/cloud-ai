/**
 * Tailwind theme — Lumen design system (neutral ink + warm paper).
 * Tokens mirror tokens.json (Tokens Studio for Figma).
 *
 * Khi đổi brand: chỉ sửa CSS variables trong app/styles/tokens.css — toàn bộ
 * utilities ở đây tự động đọc theo, không cần rebuild config.
 */
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        chalk: 'rgb(var(--color-chalk) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)',
        'hairline-soft': 'rgb(var(--color-hairline-soft) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        deep: 'rgb(var(--color-deep) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        subtle: 'rgb(var(--color-subtle) / <alpha-value>)',

        success: {
          bg: 'rgb(var(--color-success-bg) / <alpha-value>)',
          fg: 'rgb(var(--color-success-fg) / <alpha-value>)',
          dot: 'rgb(var(--color-success-dot) / <alpha-value>)',
        },
        warning: {
          bg: 'rgb(var(--color-warning-bg) / <alpha-value>)',
          fg: 'rgb(var(--color-warning-fg) / <alpha-value>)',
          dot: 'rgb(var(--color-warning-dot) / <alpha-value>)',
        },
        danger: {
          bg: 'rgb(var(--color-danger-bg) / <alpha-value>)',
          fg: 'rgb(var(--color-danger-fg) / <alpha-value>)',
          dot: 'rgb(var(--color-danger-dot) / <alpha-value>)',
        },
      },

      fontFamily: {
        sans: 'var(--font-sans)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },

      fontSize: {
        eyebrow: ['11px', { lineHeight: '1.5', letterSpacing: '0.18em' }],
        caption: ['12px', { lineHeight: '1.5' }],
        'ui-sm': ['13px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.5' }],
        'body-lead': ['16px', { lineHeight: '1.65' }],
        'card-title': ['18px', { lineHeight: '1.2' }],
        'section-title': ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h3: ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h2: ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        h1: ['40px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-compact': ['52px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        display: ['56px', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
      },

      letterSpacing: {
        'display-tight': '-0.03em',
        wide: '0.18em',
      },

      spacing: {
        topbar: '56px',
        'prompt-max': '760px',
        'container-max': '1440px',
        'control-sm': '32px',
        'control-md': '36px',
        'control-lg': '40px',
      },

      maxWidth: {
        prompt: '760px',
        container: '1440px',
      },

      borderRadius: {
        input: '8px',
        button: '8px',
        card: '12px',
        modal: '16px',
        pill: '9999px',
      },

      borderWidth: {
        hairline: '1px',
      },

      boxShadow: {
        card: '0 1px 2px 0 rgb(15 15 16 / 0.04), 0 4px 12px 0 rgb(15 15 16 / 0.03)',
        'card-hover': '0 1px 2px 0 rgb(15 15 16 / 0.04), 0 12px 32px 0 rgb(15 15 16 / 0.08)',
        focus: '0 0 0 3px rgb(15 15 16 / 0.08)',
      },

      transitionDuration: {
        fast: '120ms',
        base: '180ms',
        slow: '320ms',
      },

      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },

      animation: {
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
        'spin-slow': 'spin 1.4s linear infinite',
      },

      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
