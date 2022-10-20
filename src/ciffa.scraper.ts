import { ElementHandle, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { CiffaMember, Contact } from './ciffa-member.schema';
import { delay, injectLocalJquery } from './scraping-util';
puppeteer.use(StealthPlugin());

type Detail = {
  company: string;
  location: string;
  phone: string;
  email: string;
  isFreightForwarder: string;
  carrierCode: string;
}
type Member = Promise<CiffaMember | null>;

export const ciffaScraper = async () => {
  const proxy = JSON.parse(process.env.PROXY || '{}');
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

    const initialMembersHandle = await page.$x('//div[@class="membership-dir-card"]');
    const companyDetails = await Promise.all(initialMembersHandle?.map(captureData));
    if (companyDetails?.length === 0) {
      throw new Error('Failed to fetch memebers');
    }

    const ciffaMembers_: Member[] = [];
    for (const companyDetail of companyDetails) {
      ciffaMembers_.push(addToDb(companyDetail));
    }

    // Load more
    let followingMembersHandle = await getMoreDataMembers(page, (companyDetails?.at(-1) as Detail)?.company);
    while(followingMembersHandle?.length > 0) {
      const companyDetails = await Promise.all(followingMembersHandle?.map(captureData));
      for (const companyDetail of companyDetails) {
        ciffaMembers_.push(addToDb(companyDetail));
      }
      await delay(5000);
      followingMembersHandle = await getMoreDataMembers(page, (companyDetails?.at(-1) as Detail)?.company);
    }

    await Promise.allSettled(ciffaMembers_);

    await page?.close();
    await browser?.close();

    return;
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

const followingMemberXPath = (company: string) =>
  `//div[@class="company"][contains(., "${company}")]/ancestor::div[@class="membership-dir-card"]/following-sibling::div[@class="membership-dir-card"]`;

const captureData = async (followingMemberHandle: ElementHandle<Node>) =>
  await followingMemberHandle?.evaluate((x) => {
    type Detail = {
      company: string;
      location: string;
      phone: string;
      email: string;
      isFreightForwarder: string;
      carrierCode: string;
    }
    const detail: Partial<Detail> = {};
    detail.company = $(x).find('.membership-dir-card-header .company')?.text()
      ?.replace('Company Name: ', '')?.trim();
    detail.location = $(x).find('.location')?.text()
      ?.replace('Location: ', '')?.trim();
    detail.phone = $(x).find('span:contains("Tel:")')?.last()
      ?.text()?.replace('Tel: ', '')?.trim();
    detail.carrierCode = $(x).find('p:contains("Carrier Code:")')?.last()
      ?.text()?.replace('Carrier Code:', '')?.trim();
    detail.email = $(x).find('.email a')?.text()?.trim();
    detail.isFreightForwarder = ((ff: string) => {
      if (ff?.includes('yes')) {
        return 'yes';
      }
      else if (ff?.includes('no')) {
        return 'no';
      }
      else {
        return 'maybe';
      }
    })($(x)?.find('.freight-forward')
      ?.text()?.toLowerCase())
    return detail as Detail;
  }
);

const getMoreDataMembers = async (page: Page, companyName: string) => {
  await page.waitForSelector('#member-dir-loadmore', { timeout: 10_000 });
  await page.click('#member-dir-loadmore', { delay: 40 });

  const xPath = followingMemberXPath(companyName);
  await page.waitForXPath(xPath, { timeout: 30_000 });

  return page.$x(xPath);
}

const addToDb = async (detail: Detail) => {
  try {
    const ciffaMember = new CiffaMember({
      company_name: detail?.company,
      location: detail?.location,
      contact: new Contact({
        phone: detail?.phone,
        email: detail?.email,
      }),
      carrier_code: detail?.carrierCode,
    });
    const created = await CiffaMember.model.create(ciffaMember);
    return JSON.parse(JSON.stringify(created)) as CiffaMember;
  }
  catch (e) {
    console.log(e);
    return null;
  }
}
