// The controlled vocabulary for post tags.
// Adding a tag here is the ONLY way to introduce one — content.config.ts turns
// this list into a zod enum, so an unknown tag fails the build instead of
// quietly creating a one-post category.
// ponytail: add a tag only when at least two posts need it.
export const TAGS = ['agents', 'engineering', 'quant'] as const;

export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<'en' | 'zh-tw', Record<Tag, string>> = {
	en: {
		agents: 'Agents',
		engineering: 'Engineering',
		quant: 'Quant',
	},
	'zh-tw': {
		agents: 'Agent 系統',
		engineering: '軟體工程',
		quant: '量化研究',
	},
};

export const ALL_LABEL: Record<'en' | 'zh-tw', string> = {
	en: 'All',
	'zh-tw': '全部',
};
