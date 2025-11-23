import { Browser, Page } from 'playwright';

export async function findUWorldPage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts();
  const pages = contexts.flatMap(ctx => ctx.pages());

  const target = pages.find(p =>
    p.url().includes('uworld') ||
    p.url().includes('usmle') ||
    p.url().includes('testinterface')
  );

  if (!target) {
    throw new Error('UWorld のタブが見つかりません。ChromeでUWorldを開いてください。');
  }

  console.log('Found UWorld tab:', target.url());
  return target;
}
