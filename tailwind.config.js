/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: { inter: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      /*
       * Две темы. «white» в классах сайта — это не белый цвет, а «чернила»:
       * в тёмной теме белые, в светлой почти чёрные (переменная --tk-ink,
       * src/index.css). Поэтому `text-white/40` в светлой теме — серый текст
       * на светлом фоне, `bg-white/5` — лёгкая тень, `border-white/10` — линия.
       * Где белый нужен буквально в обеих темах (текст на фиолетовой кнопке,
       * подложка под скриншотом), — цвет `snow`.
       *
       * Прозрачность текста в светлой теме приподнята (--tk-ta, --tk-tb):
       * text-white/20 на тёмном фоне — тихая подпись, а та же прозрачность
       * тёмного текста на светлом фоне не читается. В тёмной теме множители
       * 1 и 0 — цвета ровно прежние.
       */
      textColor: {
        white: 'rgb(var(--tk-ink) / calc(<alpha-value> * var(--tk-ta) + var(--tk-tb)))',
        // Подписи text-primary/60 на светлом фоне тоже бледнеют — тот же подъём.
        primary: {
          DEFAULT: 'hsl(var(--primary) / calc(<alpha-value> * var(--tk-ta) + var(--tk-tb)))',
          foreground: 'hsl(var(--primary-foreground))',
        },
      },
      placeholderColor: {
        white: 'rgb(var(--tk-ink) / calc(<alpha-value> * var(--tk-ta) + var(--tk-tb)))',
      },
      backgroundColor: {
        white: 'rgb(var(--tk-ink) / calc(<alpha-value> * var(--tk-ba)))',
      },
      colors: {
        white: 'rgb(var(--tk-ink) / <alpha-value>)',
        snow: 'rgb(255 255 255 / <alpha-value>)',
        // Светлые оттенки палитры (…-400) на светлом фоне не читаются:
        // в светлой теме переменные подменяют их на тёмные (…-600/700).
        emerald: { 400: 'rgb(var(--tk-emerald-400) / <alpha-value>)', 500: 'rgb(var(--tk-emerald-500) / <alpha-value>)' },
        sky: { 400: 'rgb(var(--tk-sky-400) / <alpha-value>)', 500: 'rgb(var(--tk-sky-500) / <alpha-value>)' },
        red: { 300: 'rgb(var(--tk-red-300) / <alpha-value>)', 400: 'rgb(var(--tk-red-400) / <alpha-value>)' },
        pink: { 400: 'rgb(var(--tk-pink-400) / <alpha-value>)', 500: 'rgb(var(--tk-pink-500) / <alpha-value>)' },
        violet: 'hsl(var(--violet))',
        cyan: { 400: 'rgb(var(--tk-cyan-400) / <alpha-value>)' },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        'violet-dim': 'hsl(var(--violet-dim))',
        gold: 'hsl(var(--gold))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        'surface-3': 'hsl(var(--surface-3))',
        line: 'hsl(var(--line))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: { '1': 'hsl(var(--violet))', '2': 'hsl(var(--gold))', '3': 'hsl(252 60% 58%)', '4': 'hsl(280 60% 60%)', '5': 'hsl(340 70% 55%)' },
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
