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
	{
		file: 'cloud-exit',
		motif: 'spike',
		kicker: 'Engineering notes',
		title: 'A Bill That Triggered\na Cloud Exit',
		zh: { kicker: '工程筆記', title: '一張帳單\n引發的雲端退場' },
	},
	{
		file: 'factor-research-controls',
		motif: 'gates',
		kicker: 'Engineering notes',
		title: 'Internal Controls\nfor Factor Research',
		zh: { kicker: '工程筆記', title: '因子研究的\n內控制度' },
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
	// a monthly bill spiking, then dropping back to the floor
	spike: () => {
		const BASE = 590; // bar baseline
		return [22, 26, 20, 24, 96, 90, 84, 30, 10, 6]
			.map((h, i) => {
				const height = h * 3.2;
				return `<rect x="${1010 + i * 48}" y="${BASE - height}" width="34" height="${height}" rx="6" fill="#fff" opacity="${h > 80 ? 0.9 : 0.26}"/>`;
			})
			.join('');
	},
	// three gates, the last one still shut — pre-declared checkpoints
	gates: () =>
		[0, 1, 2]
			.map((i) => {
				const x = 1040 + i * 150;
				const open = i < 2;
				const frame = `<rect x="${x}" y="250" width="96" height="300" rx="14" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3"/>`;
				const leaf = `<rect x="${x + 14}" y="268" width="68" height="${open ? 44 : 264}" rx="8" fill="#fff" opacity="${open ? 0.85 : 0.3}"/>`;
				return frame + leaf;
			})
			.join(''),
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
