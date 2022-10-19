import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { injectLocalJquery } from './scraping-util';
puppeteer.use(StealthPlugin());

export const ciffaScraper = async () => {
  const proxy = JSON.parse(process.env.PROXY || '{}');
  console.log(proxy);
  if (!proxy?.ip || !proxy?.port) {
    throw new Error('Failed to get Proxy details');
  }

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      `--proxy-server=${proxy.ip}:${proxy.port}`
    ],
    headless: false,
  });

  const page = await browser.newPage();

  try {
    await page.authenticate({
      username: proxy.username,
      password: proxy.password,
    });

    const url = 'https://ciffa.com/member-directory/';
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });

    await page.waitForSelector('.membership-dir-cards', { timeout: 5000 });
    await injectLocalJquery(page);

    const companyDetails = await page.evaluate(() => {
      const details: any[] = [];
      $('.membership-dir-card').each(function(this) {
        const detail: any = {};
        detail.company = $(this).find('.membership-dir-card-header .company')?.text()
          ?.replace('Company Name: ', '')?.trim();
        detail.location = $(this).find('.location')?.text()
          ?.replace('Location: ', '')?.trim();
        detail.phone = $(this).find('span:contains("Tel:")')?.last()
          ?.text()?.replace('Tel: ', '')?.trim();
        detail.email = $(this).find('.email a')?.text()?.trim();
        detail.isFreightForwarder = ((ff: string) => {
          if (ff?.includes('yes')) {
            return 'yes';
          } else if (ff?.includes('no')) {
            return 'no';
          } else {
            return 'maybe';
          }
        })($(this)?.find('.freight-forward')
          ?.text()?.toLowerCase())
        details.push(detail);
      });
      return details;
    });

    await page?.close();
    await browser?.close();

    return companyDetails;
  }
  catch (e) {
    try {
      await page?.close();
      await browser?.close();
    }
    catch (err) {
      console.log('Failed to close page and browser. Probably closed');
    }
    throw e;
  }
}
