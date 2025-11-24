import type { Browser, Page } from 'playwright';

/**
 * 開いているタブの中から UWorld の問題画面を探す
 */
export async function findUWorldPage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts();
  const pages = contexts.flatMap((ctx) => ctx.pages());

  const target = pages.find((p) => {
    const url = p.url();
    return (
      url.includes('uworld') ||
      url.includes('usmle') ||
      url.includes('testinterface')
    );
  });

  if (!target) {
    throw new Error(
      'UWorld のタブが見つかりません。UWorld REVIEW 画面を Chrome で開いてから再実行してください。',
    );
  }

  console.log('Found UWorld page:', target.url());
  return target;
}