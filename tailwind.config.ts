import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [forms()],
} satisfies Config
