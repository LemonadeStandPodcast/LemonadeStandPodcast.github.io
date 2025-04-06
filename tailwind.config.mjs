/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				lemonade: {
					DEFAULT: '#fbd335',
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fbd335',
					400: '#f6b305',
					500: '#e69004',
					600: '#ca6a03',
					700: '#9a4f05',
					800: '#7c3f0a',
					900: '#66340c',
					950: '#3d1d07',
				},
				lime: {
					DEFAULT: '#00894c',
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#00894c',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
					950: '#052e16',
				},
			},
			typography: {
				DEFAULT: {
					css: {
						'code::before': {
							content: '""',
						},
						'code::after': {
							content: '""',
						},
					},
				},
			},
		},
	},
	plugins: [
		require('@tailwindcss/typography'),
	],
}