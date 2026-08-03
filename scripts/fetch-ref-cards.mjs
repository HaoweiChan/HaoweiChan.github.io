// Downloads each reference's own og:image for the article reference cards.
// Run: node scripts/fetch-ref-cards.mjs
// ponytail: fetch + regex + sharp. No scraper library, no headless browser.
// Images belong to the linked sites; every card links back to the source.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const OUT = new URL('../public/refs/', import.meta.url);

// Sites with neither a social card nor a parseable icon: point at the project's own image directly.
const DIRECT = {
	langgraph: 'https://opengraph.githubassets.com/1/langchain-ai/langgraph',
	'python-asyncio': 'https://docs.python.org/3/_static/py.svg',
};

const REFS = [
	['langgraph', 'https://langchain-ai.github.io/langgraph/'],
	['langchain-openai', 'https://python.langchain.com/docs/integrations/chat/openai/'],
	['openrouter', 'https://openrouter.ai/docs'],
	['python-asyncio', 'https://docs.python.org/3/library/asyncio.html'],
	['hermes-docs', 'https://hermes-agent.nousresearch.com/docs/'],
	['hermes-github', 'https://github.com/NousResearch/hermes-agent'],
	['agentskills', 'https://agentskills.io'],
	['obsidian', 'https://obsidian.md'],
	['discord-developers', 'https://discord.com/developers/docs/intro'],
];

const unescape = (s) =>
	s.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d)).replace(/&quot;/g, '"');

const pick = (html, prop) => {
	const hit =
		html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
		html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))?.[1];
	return hit && unescape(hit);
};

// Sites without a social card still have a logo — use it rather than inventing an image.
const pickIcon = (html) => {
	const hit =
		html.match(/<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
		html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+\.(?:png|svg|ico))["']/i)?.[1];
	return hit && unescape(hit);
};

await mkdir(OUT, { recursive: true });
for (const [name, url] of REFS) {
	try {
		const html = DIRECT[name]
			? ''
			: await (await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; blog-ref-cards)' } })).text();
		const img = DIRECT[name] ?? pick(html, 'og:image') ?? pick(html, 'twitter:image') ?? pickIcon(html);
		if (!img) {
			console.log(`${name}: NO og:image and no icon`);
			continue;
		}
		const abs = new URL(img, url).href;
		const buf = Buffer.from(await (await fetch(abs)).arrayBuffer());
		// 2:1 card thumbnail, letterboxed on white so logo-shaped images are not cropped
		const out = await sharp(buf)
			.resize(640, 320, { fit: 'contain', background: '#ffffff' })
			.jpeg({ quality: 82 })
			.toBuffer();
		await writeFile(new URL(`${name}.jpg`, OUT), out);
		console.log(`${name}: ${abs} -> ${name}.jpg (${(out.length / 1024) | 0}kB)`);
	} catch (err) {
		console.log(`${name}: FAILED ${err.message}`);
	}
}
