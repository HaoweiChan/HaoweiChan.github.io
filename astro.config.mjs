// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://haoweichan.github.io',
	// mermaid() must precede mdx() so ```mermaid blocks are transformed before MDX compiles.
	integrations: [
		mermaid({
			// autoTheme (on by default) swaps mermaid's 'default' and 'dark' themes
			// whenever data-theme changes, and re-renders. Colours are deliberately
			// NOT overridden here: themeVariables win over the selected theme, so a
			// hardcoded light palette produced white nodes on the dark page. One
			// static config cannot serve both modes, and legible beats on-brand.
			mermaidConfig: {
				fontFamily: 'var(--font-atkinson), sans-serif',
				flowchart: { curve: 'basis', padding: 16, nodeSpacing: 40, rankSpacing: 52 },
				themeVariables: { fontSize: '14px' },
			},
		}),
		mdx(),
		sitemap(),
	],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
