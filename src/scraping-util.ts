import { Frame, Page } from 'puppeteer';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export const delay =
  (timeout: number): Promise<void> =>
    new Promise((resolve) =>
      setTimeout(() => resolve(), timeout));

export async function injectLocalJquery(page: Page | Frame) {
  const file = await readFile(resolve('./assets', 'jquery-3.6.1.min.js'), 'utf8');
  const jquery_ev_fn = await page.evaluate((code_str) => code_str, file);
  await page.evaluate(jquery_ev_fn);
}
