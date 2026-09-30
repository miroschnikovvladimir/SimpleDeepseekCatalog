import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = path => typeof path === 'string' && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(path)
  && !path.split('/').some(part => part === '.' || part === '..');

export async function verifyPublished({ publicDir, url, commit, fetcher = fetch }) {
  const base = new URL(url.endsWith('/') ? url : url + '/');
  if (base.protocol !== 'https:' || base.search || base.hash || base.username || base.password) throw new Error('Expected a public HTTPS site URL');
  const get = async path => {
    if (!safePath(path)) throw new Error('Unsafe release path');
    const target = new URL(path, base);
    target.searchParams.set('release_check', commit);
    const response = await fetcher(target, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Public file unavailable: ${path} (HTTP ${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  };
  const release = JSON.parse(await get('release.json'));
  if (release.version !== 1 || release.commit !== commit) throw new Error('The expected site revision is not published yet');
  const checks = new Map();
  for (const [path, expected] of [['catalog.json', release.catalog_sha256], ['browse.json', release.browse_sha256]]) {
    const bytes = await readFile(resolve(publicDir, path));
    if (hash(bytes) !== expected) throw new Error(`Published ${path} differs from the prepared stories`);
    checks.set(path, expected);
  }
  const catalog = JSON.parse(await readFile(resolve(publicDir, 'catalog.json')));
  if (JSON.stringify(release.story_ids) !== JSON.stringify(catalog.stories.map(story => story.id))) throw new Error('Published story list is incomplete');
  const addLocal = async path => {
    if (!safePath(path)) throw new Error('Unsafe template path');
    checks.set(path, hash(await readFile(resolve(publicDir, path))));
  };
  for (const story of catalog.stories) {
    const manifestPath = story.template?.manifest;
    if (!manifestPath) continue;
    await addLocal(manifestPath);
    const manifest = JSON.parse(await readFile(resolve(publicDir, manifestPath)));
    for (const module of manifest.modules) {
      await addLocal(dirname(manifestPath).replaceAll('\\', '/') + '/' + module.file);
      if (module.image) await addLocal(dirname(manifestPath).replaceAll('\\', '/') + '/' + module.image);
    }
  }
  for (const image of [...catalog.stories.map(story => story.cover), ...catalog.modules.map(module => module.image)].filter(Boolean)) {
    for (const path of new Set([image.thumbnail, image.detail, ...(image.variants || []).map(v => v.url)])) await addLocal(path);
  }
  if (!Array.isArray(release.files) || !release.files.some(file => file.path === 'index.html')
      || !release.files.some(file => file.path === 'vendor/telegram-web-app.js')
      || !release.files.some(file => /^assets\/.+\.js$/.test(file.path))) throw new Error('Incomplete application release');
  for (const file of release.files) {
    if (!safePath(file.path) || !/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Invalid application file hash');
    checks.set(file.path, file.sha256);
  }
  const pending = [...checks];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (;;) {
      const check = pending.shift();
      if (!check) break;
      const [path, expected] = check;
      if (hash(await get(path)) !== expected) throw new Error(`Public file differs: ${path}`);
    }
  }));
  return { commit, stories: catalog.stories.map(story => ({ id: story.id, title: story.title })), files: checks.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const value = key => args[args.indexOf(key) + 1];
  if (!args.includes('--url')) throw new Error('Usage: npm run verify:published -- --url HTTPS_URL [--commit SHA]');
  const commit = args.includes('--commit') ? value('--commit') : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Invalid expected commit');
  const result = await verifyPublished({ publicDir: resolve('public'), url: value('--url'), commit });
  console.log(`Published revision verified: ${result.commit}; ${result.stories.length} stories; ${result.files} public files`);
  for (const story of result.stories) console.log(`${story.title}: ${value('--url').replace(/\/$/, '')}/#/stories/${story.id}`);
}
