import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyPublished } from './verify-published.mjs';

const directories = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });
const hash = value => createHash('sha256').update(value).digest('hex');
const commit = 'a'.repeat(40);

async function fixture() {
  const publicDir = await mkdtemp(join(tmpdir(), 'published-catalog-test-'));
  directories.push(publicDir);
  const catalog = { stories: [{ id: 'story', title: 'Story', template: { manifest: 'templates/story/r1/manifest.json' },
    cover: { thumbnail: 'templates/story/r1/images/cover-320.webp', detail: 'templates/story/r1/images/cover-320.webp' } }], modules: [] };
  const files = new Map(Object.entries({
    'catalog.json': JSON.stringify(catalog), 'browse.json': JSON.stringify(catalog),
    'templates/story/r1/manifest.json': JSON.stringify({ modules: [{ file: 'setting.md', image: 'images/setting.jpg' }] }),
    'templates/story/r1/setting.md': 'Original story', 'templates/story/r1/images/setting.jpg': 'jpeg',
    'templates/story/r1/images/cover-320.webp': 'webp',
    'index.html': '<html>Current app</html>', 'assets/app.js': 'current app', 'vendor/telegram-web-app.js': 'official SDK',
  }));
  for (const [path, bytes] of files) {
    await mkdir(dirname(join(publicDir, path)), { recursive: true });
    await writeFile(join(publicDir, path), bytes);
  }
  const release = { version: 1, commit, catalog_sha256: hash(files.get('catalog.json')), browse_sha256: hash(files.get('browse.json')),
    story_ids: ['story'], files: ['index.html', 'assets/app.js', 'vendor/telegram-web-app.js'].map(path => ({ path, sha256: hash(files.get(path)) })) };
  files.set('release.json', JSON.stringify(release));
  const fetcher = async url => {
    const bytes = files.get(url.pathname.replace('/site/', ''));
    return new Response(bytes, { status: bytes == null ? 404 : 200 });
  };
  return { publicDir, files, release, fetcher, url: 'https://example.com/site/', commit };
}

it('verifies deployed cards, package text, JPEG, responsive images and current app assets', async () => {
  const data = await fixture();
  expect(await verifyPublished(data)).toEqual({ commit, stories: [{ id: 'story', title: 'Story' }], files: 9 });
});

it('rejects the previous deployment even if its homepage works', async () => {
  const data = await fixture();
  data.files.set('release.json', JSON.stringify({ ...data.release, commit: 'b'.repeat(40) }));
  await expect(verifyPublished(data)).rejects.toThrow('not published yet');
});

it('rejects a stale public catalog instead of treating a local card as published', async () => {
  const data = await fixture();
  data.files.set('catalog.json', JSON.stringify({ stories: [], modules: [] }));
  await expect(verifyPublished(data)).rejects.toThrow('Public file differs: catalog.json');
});

it.each(['templates/story/r1/setting.md', 'templates/story/r1/images/setting.jpg', 'templates/story/r1/images/cover-320.webp', 'assets/app.js'])(
  'rejects missing deployed file %s', async path => {
    const data = await fixture();
    data.files.delete(path);
    await expect(verifyPublished(data)).rejects.toThrow('Public file unavailable: ' + path);
  });

it('rejects altered game text even when the card and deployment succeeded', async () => {
  const data = await fixture();
  data.files.set('templates/story/r1/setting.md', 'Altered story');
  await expect(verifyPublished(data)).rejects.toThrow('Public file differs: templates/story/r1/setting.md');
});
