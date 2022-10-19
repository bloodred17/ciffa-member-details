import { ciffaScraper } from './ciffa.scraper';
import dotenv from 'dotenv';


(async () => {
  dotenv.config();

  const data = await ciffaScraper();
  console.log(data);

})()
