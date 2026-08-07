import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SERIES_IDS } from './series';
import { TAGS } from './tags';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			lang: z.enum(['en', 'zh-tw']).default('en'),
			translationOf: z.string().optional(),
			// Controlled vocabulary (src/tags.ts). Max 2: needing a third means
			// the post is unfocused or the vocabulary is too fine-grained.
			tags: z.array(z.enum(TAGS)).min(1).max(2),
			// Controlled vocabulary (src/series.ts). Reading order comes from
			// pubDate, so there is no part number to keep in sync here.
			series: z.enum(SERIES_IDS).optional(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
