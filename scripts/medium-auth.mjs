import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import readline from 'node:readline';

const SESSION_FILE = new URL('../.medium-session.json', import.meta.url).pathname;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function main() {
  console.log('🚀 正在啟動瀏覽器進行 Medium 登入認證...');
  console.log('   (若之前有登入過，將讀取現有 Session)');

  let browser;
  try {
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--disable-blink-features=AutomationControlled'],
    });
  } catch {
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });
  }

  const contextOptions = existsSync(SESSION_FILE) ? { storageState: SESSION_FILE } : {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  await page.goto('https://medium.com');

  console.log('\n======================================================');
  console.log('📌 請在彈出的瀏覽器視窗中：');
  console.log('   1. 登入你的 Medium 帳號 (Google, Apple, Email 等皆可)');
  console.log('   2. 登入完成後，腳本會「自動偵測」並儲存 Session！');
  console.log('   (若自動偵測未觸發，亦可直接在此終端機按 [Enter] 儲存)');
  console.log('======================================================\n');

  // Auto-detect login in background
  const autoDetectPromise = (async () => {
    while (true) {
      try {
        const cookies = await context.cookies();
        const hasAuthUid = cookies.some((c) => c.name === 'uid' && !c.value.startsWith('lo_'));
        const notOnSignIn = !page.url().includes('/signin') && !page.url().includes('/login');
        
        let hasProfileButton = false;
        try {
          hasProfileButton = (await page.locator('button[data-testid="headerProfileButton"], button[aria-label*="profile"], img[alt*="profile"]').count()) > 0;
        } catch {}

        if (notOnSignIn && (hasAuthUid || hasProfileButton)) {
          console.log('\n🎉 偵測到 Medium 已成功登入！');
          // Give it 3 seconds to settle all auth tokens and storage
          await new Promise((r) => setTimeout(r, 3000));
          return true;
        }
      } catch {
        // browser might be closed or navigating
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  })();

  const enterPromise = askQuestion('👉 登入完成後按 [Enter] 或靜候自動偵測: ');

  await Promise.race([autoDetectPromise, enterPromise]);

  // Save storage state
  await context.storageState({ path: SESSION_FILE });
  await browser.close();

  console.log('\n✅ 登入狀態已成功保存至 .medium-session.json！');
  console.log('   接下來自動化發文腳本將自動使用此認證進行發布。\n');
}

main().catch((err) => {
  console.error('❌ 認證過程發生錯誤:', err);
  process.exit(1);
});
