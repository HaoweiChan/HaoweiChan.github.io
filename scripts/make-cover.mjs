// Generates the 2:1 cover images used as post heroImage / list thumbnails.
// Run: node scripts/make-cover.mjs
// ponytail: SVG string -> sharp (already a dependency). No design tooling, no AI art.
// Each cover is emitted twice: <file>.png (en) and <file>.zh.png (zh-tw).
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const W = 1600;
const H = 800;
const OUT = new URL('../src/assets/blog/covers/', import.meta.url);

const LATIN = 'Helvetica, Arial, sans-serif';
const CJK = '"PingFang TC", "Heiti TC", "Noto Sans CJK TC", sans-serif';

const COVERS = [
	{
		file: 'agentic-ingestion-pipeline',
		motif: 'pipeline',
		kicker: 'Engineering notes',
		title: 'Agentic\nIngestion Pipeline',
		zh: { kicker: '工程筆記', title: 'Agentic\n資料處理管線' },
	},
	{
		file: 'resident-personal-assistant',
		motif: 'schedule',
		kicker: 'Engineering notes',
		title: 'A Resident\nPersonal Assistant',
		zh: { kicker: '工程筆記', title: '常駐型\n個人助理' },
	},
];

const motifs = {
	// three lanes with checkpoints — the recoverable pipeline
	pipeline: () =>
		[0, 1, 2]
			.map((lane) => {
				const y = 250 + lane * 150;
				const nodes = [0, 1, 2, 3]
					.map((i) => `<circle cx="${1010 + i * 150}" cy="${y}" r="${i === 3 ? 14 : 9}" fill="#fff" opacity="${0.25 + i * 0.2}"/>`)
					.join('');
				return `<line x1="1010" y1="${y}" x2="1460" y2="${y}" stroke="#fff" stroke-opacity="0.28" stroke-width="3"/>${nodes}`;
			})
			.join(''),
	// a week of scheduled slots, most of them silent
	schedule: () =>
		Array.from({ length: 35 }, (_, i) => {
			const x = 1000 + (i % 7) * 70;
			const y = 240 + Math.floor(i / 7) * 70;
			const on = [3, 9, 16, 22, 31].includes(i);
			return `<rect x="${x}" y="${y}" width="44" height="44" rx="10" fill="#fff" opacity="${on ? 0.9 : 0.16}"/>`;
		}).join(''),
	dots: () =>
		Array.from({ length: 36 }, (_, i) => {
			const x = 1020 + (i % 6) * 80;
			const y = 260 + Math.floor(i / 6) * 80;
			return `<circle cx="${x}" cy="${y}" r="7" fill="#fff" opacity="${0.15 + (i % 6) * 0.12}"/>`;
		}).join(''),
};

const svg = ({ kicker, title, motif }, isZh) => {
	const font = isZh ? CJK : LATIN;
	const lines = title.split('\n');
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#246b5a"/>
      <stop offset="100%" stop-color="#12352c"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g>${motifs[motif]()}</g>
  <text x="110" y="235" fill="#ffffff" fill-opacity="0.72" font-family='${font}' font-size="30" letter-spacing="6">${isZh ? kicker : kicker.toUpperCase()}</text>
  ${lines
		.map(
			(line, i) =>
				`<text x="110" y="${340 + i * 92}" fill="#ffffff" font-family='${font}' font-size="76" font-weight="bold">${line}</text>`,
		)
		.join('\n  ')}
  <text x="110" y="690" fill="#ffffff" fill-opacity="0.6" font-family="${LATIN}" font-size="26">haoweichan.github.io</text>
</svg>`;
};

await mkdir(OUT, { recursive: true });
for (const cover of COVERS) {
	for (const [suffix, spec, isZh] of [
		['', cover, false],
		['.zh', { ...cover, ...cover.zh }, true],
	]) {
		const path = new URL(`${cover.file}${suffix}.png`, OUT);
		await sharp(Buffer.from(svg(spec, isZh))).png().toFile(path.pathname);
		console.log('wrote', path.pathname);
	}
}
