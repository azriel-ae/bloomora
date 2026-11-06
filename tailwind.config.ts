import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#f7f2ea',
        paper: '#fffdf9',
        ink: '#25241f',
        rose: '#c98f86',
        blush: '#eed8d1',
        moss: '#66745d',
        sage: '#dfe6d8',
        line: '#e6ded2',
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      boxShadow: {
        paper: '0 24px 70px rgba(58, 47, 37, .10)',
        soft: '0 12px 32px rgba(58, 47, 37, .08)',
      },
    },
  },
  plugins: [],
};

export default config;
