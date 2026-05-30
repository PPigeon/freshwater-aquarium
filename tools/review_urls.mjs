import { REVIEW_URLS } from '../src/scapes.js';

const base = process.argv[2] || 'http://localhost:5174/';

for (const item of REVIEW_URLS) {
  const url = new URL(item.query, base);
  console.log(`${item.id}\t${item.label}\t${url.href}`);
}
