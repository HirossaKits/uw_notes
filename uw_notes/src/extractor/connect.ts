import { chromium, Browser } from 'playwright';

export async function connectToChrome(port = 9222): Promise<Browser> {
  const url = `http://localhost:${port}`;
  console.log(`Connecting to Chrome over CDP: ${url}`);

  try {
    const browser = await chromium.connectOverCDP(url);
    console.log('Connected to Chrome.');
    return browser;
  } catch (err) {
    console.error('Failed to connect to Chrome. Is it running with --remote-debugging-port?');
    throw err;
  }
}
