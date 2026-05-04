export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'on-primary': 'var(--color-on-primary)',
        ink: 'var(--color-ink)',
        canvas: 'var(--color-canvas)',
        'inverse-canvas': 'var(--color-inverse-canvas)',
        'inverse-ink': 'var(--color-inverse-ink)',
        'on-inverse-soft': 'var(--color-on-inverse-soft)',
        hairline: 'var(--color-hairline)',
        'hairline-soft': 'var(--color-hairline-soft)',
        'surface-soft': 'var(--color-surface-soft)',
        lime: 'var(--color-block-lime)',
        lilac: 'var(--color-block-lilac)',
        cream: 'var(--color-block-cream)',
        pink: 'var(--color-block-pink)',
        mint: 'var(--color-block-mint)',
        coral: 'var(--color-block-coral)',
        navy: 'var(--color-block-navy)',
        magenta: 'var(--color-accent-magenta)',
        success: 'var(--color-semantic-success)',
        scrim: 'var(--color-overlay-scrim)'
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
        full: 'var(--radius-full)'
      },
      spacing: {
        hair: 'var(--space-hair)',
        xxs: 'var(--space-xxs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        xxl: 'var(--space-xxl)',
        section: 'var(--space-section)'
      },
      fontFamily: {
        sans: ['figmaSans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['figmaMono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        'display-xl': ['86px', { lineHeight: '1', letterSpacing: '-1.72px', fontWeight: '340' }],
        'display-lg': ['64px', { lineHeight: '1.1', letterSpacing: '-0.96px', fontWeight: '340' }],
        headline: ['26px', { lineHeight: '1.35', letterSpacing: '-0.26px', fontWeight: '540' }],
        subhead: ['26px', { lineHeight: '1.35', letterSpacing: '-0.26px', fontWeight: '340' }],
        'card-title': ['24px', { lineHeight: '1.45', fontWeight: '700' }],
        'body-lg': ['20px', { lineHeight: '1.4', letterSpacing: '-0.14px', fontWeight: '330' }],
        body: ['18px', { lineHeight: '1.45', letterSpacing: '-0.26px', fontWeight: '320' }],
        'body-sm': ['16px', { lineHeight: '1.45', letterSpacing: '-0.14px', fontWeight: '330' }],
        link: ['20px', { lineHeight: '1.4', letterSpacing: '-0.1px', fontWeight: '480' }],
        button: ['20px', { lineHeight: '1.4', letterSpacing: '-0.1px', fontWeight: '480' }],
        eyebrow: ['18px', { lineHeight: '1.3', letterSpacing: '0.54px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1', letterSpacing: '0.6px', fontWeight: '400' }]
      },
      boxShadow: {
        editorial: '0 24px 80px rgb(0 0 0 / 0.08)',
        panel: '0 12px 40px rgb(0 0 0 / 0.06)'
      }
    }
  }
}
