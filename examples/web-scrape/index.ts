import { Scraper } from "../../dist/index.mjs";

const scraper = new Scraper();

const result = await scraper.scrape("https://en.wikipedia.org/wiki/Elon_Musk", {
  output: "html",
});

console.log(result.content);
