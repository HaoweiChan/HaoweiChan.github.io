import type { CollectionEntry } from 'astro:content';

// Controlled vocabulary, same deal as tags.ts: content.config.ts turns the keys
// into a zod enum, so a typo'd series id fails the build instead of quietly
// orphaning a post into a series of one.
export const SERIES = {
	'agentic-ingestion': {
		en: 'Designing a Reliable Agentic Ingestion Pipeline',
		'zh-tw': '可靠的 Agentic Ingestion Pipeline',
	},
	'cloud-exit': {
		en: 'A Bill That Triggered a Cloud Exit',
		'zh-tw': '一張帳單引發的雲端退場',
	},
	'resident-assistant': {
		en: 'A Resident Personal Assistant',
		'zh-tw': '個人常駐助理',
	},
} as const;

export type SeriesId = keyof typeof SERIES;

export const SERIES_IDS = Object.keys(SERIES) as [SeriesId, ...SeriesId[]];

type Post = CollectionEntry<'blog'>;

/** The public URL of a post, which differs by locale. */
export function postHref(post: Post): string {
	return post.data.lang === 'zh-tw'
		? `/zh-tw/blog/${post.data.translationOf ?? post.id.replace(/^zh-tw\//, '')}/`
		: `/blog/${post.id}/`;
}

/**
 * Position of `post` within its series, plus its neighbours.
 * Reading order is pubDate ascending — deliberately derived rather than stored,
 * so there is no part number that can drift out of sync with the dates.
 */
export function seriesNav(post: Post, all: Post[]) {
	const id = post.data.series;
	if (!id) return null;

	const siblings = all
		.filter((entry) => entry.data.series === id && entry.data.lang === post.data.lang)
		.sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());

	const index = siblings.findIndex((entry) => entry.id === post.id);
	if (index === -1 || siblings.length < 2) return null;

	const link = (entry: Post) => ({ href: postHref(entry), title: entry.data.title });

	return {
		title: SERIES[id][post.data.lang],
		part: index + 1,
		total: siblings.length,
		prev: index > 0 ? link(siblings[index - 1]) : null,
		next: index < siblings.length - 1 ? link(siblings[index + 1]) : null,
	};
}
