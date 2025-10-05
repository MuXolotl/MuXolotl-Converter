/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { purple: '#8b5cf6', pink: '#ec4899' },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        'gradient-primary': 'linear-gradient(90deg, #8b5cf6 0%, #ec4899 100%)',
      },
      backdropBlur: { glass: '10px' },
    },
  },
  plugins: [],
};
