import { mongoose } from '@typegoose/typegoose';
import { ciffaScraper } from './ciffa.scraper';
import dotenv from 'dotenv';


(async () => {
  dotenv.config();
  await mongoose.connect('mongodb://localhost:27017/general_scraping')

  try {
    await ciffaScraper();
  } catch (e) {
    console.log(e);
  }

  await mongoose.disconnect();
})()
