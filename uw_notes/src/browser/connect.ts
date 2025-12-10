import { chromium, Browser } from 'playwright';

interface ConnectOptions {
  host?: string;
  port?: number;
}

/**
 * 既に起動済みの Chrome に CDP で接続する
 * 例:
 * /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *   --remote-debugging-port=9222 \
 *   --user-data-dir=$HOME/.uworld_chrome_profile
 */
export async function connectToChrome(
  options: ConnectOptions = {}
): Promise<Browser> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 9222;

  const url = `http://${host}:${port}`;
  console.log(`Connecting to Chrome over CDP: ${url}`);

  try {
    const browser = await chromium.connectOverCDP(url);
    console.log('Connected to Chrome via CDP.');
    return browser;
  } catch (err) {
    console.error(
      'Failed to connect to Chrome. Is it running with --remote-debugging-port?',
    );
    throw err;
  }
}
