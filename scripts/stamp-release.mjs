import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const commit = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Invalid release commit');
const paths = ['index.html', 'vendor/telegram-web-app.js', ... (await readdir('dist/assets')).map(name => 'assets/' + name)];
const files = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile('dist/' + path)) })));
const catalog = await readFile('dist/catalog.json');
const browse = await readFile('dist/browse.json');
await writeFile('dist/release.json', JSON.stringify({ version: 1, commit,
  catalog_sha256: hash(catalog), browse_sha256: hash(browse),
  story_ids: JSON.parse(catalog).stories.map(story => story.id), files,
}, null, 2) + '\n');
console.log(`Release stamped: ${commit.slice(0, 7)}`);
