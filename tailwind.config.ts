import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 판정 색상
        'review-pass': '#22c55e',
        'review-fail': '#ef4444',
        'review-check': '#f59e0b',
        // 인허가 색상
        'permit-required': '#22c55e',
        'permit-conditional': '#f59e0b',
        'permit-scale': '#3b82f6',
        'permit-na': '#9ca3af',
        // UI 색상
        'panel-bg': '#f8fafc',
        'panel-border': '#e2e8f0',
      },
      width: {
        'file-panel': '240px',
        'law-panel': '280px',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
};

export default config;
