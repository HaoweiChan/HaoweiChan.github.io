import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BLOG_DIR = new URL('../src/content/blog', import.meta.url).pathname;
const OUT_DIR = new URL('../public/diagrams', import.meta.url).pathname;
const CONFIG_PATH = new URL('./mermaid-config.json', import.meta.url).pathname;
const CACHE_FILE = join(OUT_DIR, '.cache.json');
const MANIFEST_FILE = join(OUT_DIR, 'manifest.json');

async function getMarkdownFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await getMarkdownFiles(fullPath, relPath)));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

async function main() {
  console.log('🔍 Scanning markdown files for Mermaid diagrams...');
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(join(OUT_DIR, 'en'), { recursive: true });
  await mkdir(join(OUT_DIR, 'zh-tw'), { recursive: true });

  let cache = {};
  if (existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
    } catch {
      cache = {};
    }
  }

  const manifest = {};
  const files = await getMarkdownFiles(BLOG_DIR);
  let totalDiagrams = 0;
  let renderedCount = 0;
  let skippedCount = 0;

  for (const { fullPath, relPath } of files) {
    const content = await readFile(fullPath, 'utf8');
    const isZhTw = relPath.startsWith('zh-tw/');
    const lang = isZhTw ? 'zh-tw' : 'en';
    const filename = relPath.split('/').pop().replace(/\.mdx?$/, '');
    const slug = filename;

    // Match all ```mermaid blocks
    const mermaidRegex = /```mermaid\r?\n([\s\S]*?)\r?\n```/g;
    let match;
    let index = 1;

    while ((match = mermaidRegex.exec(content)) !== null) {
      totalDiagrams++;
      const mermaidCode = match[1].trim();
      const diagramKey = `${lang}/${slug}/${index}`;
      const outFilename = `${slug}-diagram-${index}.png`;
      const outPath = join(OUT_DIR, lang, outFilename);
      const publicPath = `/diagrams/${lang}/${outFilename}`;

      manifest[diagramKey] = publicPath;

      const hash = createHash('md5').update(`${mermaidCode}:::v1`).digest('hex');

      if (existsSync(outPath) && (cache[diagramKey] === hash || !process.env.FORCE_RENDER)) {
        skippedCount++;
        index++;
        continue;
      }

      console.log(`  ⚙️ Rendering [${lang}] ${slug} diagram #${index}...`);
      const tmpInput = join(tmpdir(), `mmdc-${Date.now()}-${index}.mmd`);
      await writeFile(tmpInput, mermaidCode, 'utf8');

      try {
        await execFileAsync('npx', [
          '-y',
          '@mermaid-js/mermaid-cli',
          '-i', tmpInput,
          '-o', outPath,
          '-c', CONFIG_PATH,
          '-b', '#ffffff',
          '-s', '2'
        ]);
        cache[diagramKey] = hash;
        renderedCount++;
      } catch (err) {
        console.error(`  ❌ Failed to render diagram for ${slug} #${index}:`, err.message);
      }
      index++;
    }
  }

  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n✨ Diagram rendering finished:`);
  console.log(`   Total found: ${totalDiagrams}`);
  console.log(`   Rendered:    ${renderedCount}`);
  console.log(`   Skipped:     ${skippedCount} (cached)`);
  console.log(`   Manifest:    public/diagrams/manifest.json\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
