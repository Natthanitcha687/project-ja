import fs from 'fs';
import path from 'path';
import https from 'https';

const outDir = path.resolve(process.cwd(), 'public', 'data');
const files = [
  { url: 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/province.json', name: 'api_province.json' },
  { url: 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/district.json', name: 'api_district.json' },
  { url: 'https://raw.githubusercontent.com/kongvut/thai-province-data/refs/heads/master/api/latest/sub_district.json', name: 'api_subdistrict.json' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Failed to fetch ' + url + ' status ' + res.statusCode));
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    ensureDir(outDir);
    for (const f of files) {
      const dest = path.join(outDir, f.name);
      console.log('Fetching', f.url, '→', dest);
      await fetchToFile(f.url, dest);
    }
    console.log('Thai location data fetched to', outDir);
  } catch (err) {
    console.error('Failed to fetch thai data:', err.message || err);
    process.exitCode = 1;
  }
}

main();
