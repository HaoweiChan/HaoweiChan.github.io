import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const SESSION_FILE = new URL('../.medium-session.json', import.meta.url).pathname;
const STATE_FILE = new URL('./medium-state.json', import.meta.url).pathname;

// 6-week editorial roadmap (slot 1 to 11)
const ROADMAP = [
  {
    slot: 1,
    slug: 'resident-personal-assistant',
    title: '我的個人助理不是 chatbot',
    series: 'resident-assistant',
    suggestedDate: 'Week 1 (二)',
    tags: ['Artificial Intelligence', 'Software Engineering', 'Agents']
  },
  {
    slot: 2,
    slug: 'broker-reports-and-portfolio-automation',
    title: '從對帳單 PDF 到多帳戶權益數：自動化資產與研報追蹤系統',
    series: 'resident-assistant',
    suggestedDate: 'Week 1 (五)',
    tags: ['Data Engineering', 'Python', 'Finance']
  },
  {
    slot: 3,
    slug: 'factor-research-internal-controls',
    title: '我如何用「預先聲明 + 三道閘門」建立因子研究的內控制度',
    series: 'quant',
    suggestedDate: 'Week 2 (二)',
    tags: ['Quantitative Finance', 'Trading', 'System Architecture']
  },
  {
    slot: 4,
    slug: 'agentic-ingestion-pipeline-part1',
    title: '如何設計一條可靠的 Agentic Ingestion Pipeline (上)',
    series: 'agentic-ingestion',
    suggestedDate: 'Week 2 (五)',
    tags: ['Artificial Intelligence', 'LangGraph', 'Software Architecture']
  },
  {
    slot: 5,
    slug: 'agentic-ingestion-pipeline-part2',
    title: '如何設計一條可靠的 Agentic Ingestion Pipeline (下)',
    series: 'agentic-ingestion',
    suggestedDate: 'Week 3 (二)',
    tags: ['Artificial Intelligence', 'LLM', 'System Design']
  },
  {
    slot: 6,
    slug: 'when-every-node-succeeds',
    title: '每個節點都回報成功，成品還是錯的：內容 Pipeline 的局部成功偵查',
    series: 'agentic-ingestion',
    suggestedDate: 'Week 3 (五)',
    tags: ['Data Pipelines', 'Debugging', 'Software Engineering']
  },
  {
    slot: 7,
    slug: 'cloud-bill-forensics',
    title: '當雲端帳單一夜暴漲二十倍：一次資料庫流量失血的完整偵查紀錄',
    series: 'cloud-exit',
    suggestedDate: 'Week 4 (二)',
    tags: ['Cloud Computing', 'Database', 'DevOps']
  },
  {
    slot: 8,
    slug: 'document-db-to-postgres-migration',
    title: '從文件資料庫搬回 PostgreSQL：我的六階段資料層退場方法論',
    series: 'cloud-exit',
    suggestedDate: 'Week 4 (五)',
    tags: ['PostgreSQL', 'Database Migration', 'Backend']
  },
  {
    slot: 9,
    slug: 'media-secrets-cloud-exit',
    title: '雲端退場最後一哩：把 140GB 媒體檔和所有 Secrets 搬回自己的 VPS',
    series: 'cloud-exit',
    suggestedDate: 'Week 5 (二)',
    tags: ['Self Hosted', 'VPS', 'Infrastructure']
  },
  {
    slot: 10,
    slug: 'fastapi-redis-tiered-cache-design',
    title: 'FastAPI + Redis：高讀取量 API 的快取分層設計',
    series: 'backend',
    suggestedDate: 'Week 5 (五)',
    tags: ['FastAPI', 'Redis', 'Python']
  },
  {
    slot: 11,
    slug: 'dev-staging-prod-environments',
    title: 'Dev / Staging / Production：小團隊也需要的環境分層策略',
    series: 'engineering',
    suggestedDate: 'Week 6 (二)',
    tags: ['DevOps', 'CI CD', 'Software Development']
  }
];

async function loadState() {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(await readFile(STATE_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

async function saveState(state) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function printStatus(state) {
  console.log('\n📊 Medium 排程與發布進度總覽 (一週兩發 6 週計畫):');
  console.log('-------------------------------------------------------------------------------------');
  console.log('Slot | 時程建議   | 狀態        | 文章 Slug / 標題');
  console.log('-------------------------------------------------------------------------------------');
  ROADMAP.forEach(item => {
    const s = state[item.slug] || { status: 'PENDING' };
    const icon = s.status === 'IMPORTED' ? '📝 [草稿已建立]' : s.status === 'PUBLISHED' ? '✅ [已發布]' : '⏳ [待發布]';
    console.log(` #${item.slot.toString().padEnd(2)} | ${item.suggestedDate.padEnd(10)} | ${icon.padEnd(11)} | ${item.title} (${item.slug})`);
    if (s.mediumUrl) {
      console.log(`     ↳ Medium 草稿連結: ${s.mediumUrl}`);
    }
  });
  console.log('-------------------------------------------------------------------------------------\n');
}

async function main() {
  const args = process.argv.slice(2);
  const state = await loadState();

  if (args.includes('--status')) {
    printStatus(state);
    return;
  }

  if (!existsSync(SESSION_FILE)) {
    console.error('\n❌ 找不到 .medium-session.json！');
    console.error('👉 請先執行以下指令登入 Medium:');
    console.error('   npm run medium:login\n');
    process.exit(1);
  }

  const isHeadless = !args.includes('--headful');
  const lang = args.includes('--en') ? 'en' : 'zh-tw';

  let targetSlug = null;
  const slugArgIdx = args.indexOf('--slug');
  if (slugArgIdx !== -1 && args[slugArgIdx + 1]) {
    targetSlug = args[slugArgIdx + 1];
  } else if (args.includes('--next')) {
    // Pick the first pending article in roadmap
    const pendingItem = ROADMAP.find(item => !state[item.slug] || state[item.slug].status === 'PENDING');
    if (!pendingItem) {
      console.log('🎉 所有 11 篇文章皆已完成匯入！');
      return;
    }
    targetSlug = pendingItem.slug;
  } else {
    printStatus(state);
    console.log('💡 使用說明:');
    console.log('   node scripts/publish-to-medium.mjs --status      (查看所有排程狀態)');
    console.log('   node scripts/publish-to-medium.mjs --next        (自動執行下一篇排程匯入)');
    console.log('   node scripts/publish-to-medium.mjs --slug <slug> (手動指定文章 slug)');
    console.log('   node scripts/publish-to-medium.mjs --headful     (打開可視瀏覽器視窗)\n');
    return;
  }

  const item = ROADMAP.find(r => r.slug === targetSlug);
  const articleTitle = item ? item.title : targetSlug;
  const syndicationUrl = `https://haoweichan.github.io/${lang === 'zh-tw' ? 'zh-tw/' : ''}syndication/blog/${targetSlug}/`;

  console.log(`\n🚀 開始自動匯入流程:`);
  console.log(`   文章標題: ${articleTitle}`);
  console.log(`   目標 Slug: ${targetSlug}`);
  console.log(`   鏡像網址: ${syndicationUrl}`);

  const browser = await chromium.launch({ headless: isHeadless });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  try {
    console.log('🌐 正在打開 Medium 匯入頁面 (https://medium.com/p/import)...');
    await page.goto('https://medium.com/p/import', { waitUntil: 'domcontentloaded' });

    // Verify login state
    if (page.url().includes('/signin') || page.url().includes('/login')) {
      throw new Error('Medium 登入過期，請重新執行 npm run medium:login 登入。');
    }

    // Wait for the URL input
    const inputSelector = 'input[type="url"], input[type="text"], input[name="url"], input';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    const input = page.locator(inputSelector).first();
    await input.fill(syndicationUrl);

    console.log('📝 已填入鏡像 URL，正在點擊 Import story...');
    const importButton = page.locator('button:has-text("Import"), button[type="submit"]').first();
    await importButton.click();

    // Medium will process the import and navigate to preview or editor
    console.log('⏳ Medium 正在解析文章、下載圖檔並轉換格式...');
    await page.waitForURL(url => url.pathname.includes('/p/') || url.pathname.includes('/edit') || url.pathname.includes('/preview'), { timeout: 45000 });

    const mediumDraftUrl = page.url();
    console.log(`\n✅ 匯入成功！已生成 Medium 草稿:`);
    console.log(`   URL: ${mediumDraftUrl}`);

    // Update state
    state[targetSlug] = {
      status: 'IMPORTED',
      mediumUrl: mediumDraftUrl,
      syndicationUrl,
      importedAt: new Date().toISOString(),
      slot: item ? item.slot : null
    };
    await saveState(state);

    console.log(`\n🎉 完成！圖片已自動內嵌，Canonical URL 已自動對齊主站。`);
    console.log(`   你可以在 Medium 草稿中點擊「Publish」並設定「Schedule for later」預約發布。\n`);

  } catch (err) {
    console.error('❌ 匯入過程發生錯誤:', err.message);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
