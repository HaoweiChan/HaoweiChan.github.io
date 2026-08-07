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
			// 'base' is the only theme that honours themeVariables — the named
			// themes ignore them. Values mirror src/styles/global.css so diagrams
			// read as part of the page instead of a pasted-in screenshot.
			theme: 'base',
			mermaidConfig: {
				fontFamily: 'var(--font-atkinson), sans-serif',
				flowchart: { curve: 'basis', padding: 16, nodeSpacing: 40, rankSpacing: 52 },
				themeVariables: {
					fontSize: '14px',
					// nodes
					primaryColor: '#ffffff',
					primaryBorderColor: '#246b5a',
					primaryTextColor: '#0f1219',
					nodeBorder: '#246b5a',
					mainBkg: '#ffffff',
					// subgraph containers — quiet, so the nodes carry the colour
					clusterBkg: '#f7f9fb',
					clusterBorder: '#e5e9f0',
					// edges and labels
					lineColor: '#60739f',
					edgeLabelBackground: '#ffffff',
					titleColor: '#222939',
					textColor: '#222939',
				},
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
