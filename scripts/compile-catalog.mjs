import { readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && [...value].length <= limit && !value.includes('\0');
const title = value => text(value, 80) && !/[\r\n]/.test(value);
const kinds = ['prompt', 'setting', 'player', 'lead', 'support', 'opening'];
const required = kinds.filter(kind => kind !== 'support');
function fail(message) { throw new Error(message); }
function safePath(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(value) || value.split('/').some(p => p === '.' || p === '..')) fail('Unsafe template path');
  return value;
}
async function localFile(root, name, limit) {
  const base = await realpath(root);
  const file = await realpath(resolve(root, safePath(name)));
  if (!file.startsWith(base + sep)) fail('Template path escapes its directory');
  const data = await readFile(file);
  if (data.length > limit) fail('Template file too large');
  return data;
}

export async function compileCatalog(publicDir) {
  const registry = JSON.parse(await readFile(resolve(publicDir, 'templates/index.json'), 'utf8'));
  if (!Array.isArray(registry.stories) || registry.stories.length > 2000) fail('Invalid template registry');
  const catalog = { version: 2, stories: [], modules: [] };
  const seen = new Set();
  const useId = value => { if (!id(value) || seen.has(value)) fail('Invalid or duplicate ID'); seen.add(value); };
  for (const entry of registry.stories) {
    if (entry.summary != null && (typeof entry.summary !== 'string' || entry.summary.length > 1000)) fail('Invalid summary');
    if (entry.author != null && (typeof entry.author.name !== 'string' || entry.author.name.length > 100)) fail('Invalid author');
    for (const key of ['tags', 'categories']) {
      if (entry[key] != null && (!Array.isArray(entry[key]) || entry[key].length > 30 || entry[key].some(v => typeof v !== 'string' || v.length > 80))) fail('Invalid tags/categories');
    }
    const manifestPath = safePath(entry.manifest);
    if (!/^templates\/[A-Za-z0-9_-]+\/r\d+\/manifest\.json$/.test(manifestPath)) fail('Expected versioned template directory');
    const raw = await localFile(publicDir, manifestPath, 128 * 1024);
    const manifest = JSON.parse(raw.toString('utf8'));
    useId(manifest.id);
    if (manifest.format !== 'simpledeepseek.story' || manifest.version !== 1 || !Number.isSafeInteger(manifest.revision) || manifest.revision < 0 || !title(manifest.title)) fail('Invalid manifest');
    if (manifestPath !== `templates/${manifest.id}/r${manifest.revision}/manifest.json`) fail('Template revision does not match directory');
    const modules = manifest.modules;
    if (!Array.isArray(modules) || modules.length < 5 || modules.length > 23 || required.some(k => modules.filter(m => m.kind === k).length !== 1)) fail('Invalid module roles');
    const characters = modules.filter(m => ['player', 'lead', 'support'].includes(m.kind));
    if (characters.length > 20 || new Set(characters.map(m => m.title.toLocaleLowerCase('ru'))).size !== characters.length) fail('Invalid characters');
    const paths = new Set(), indexed = [], base = dirname(resolve(publicDir, manifestPath));
    let total = 0;
    for (const m of modules) {
      useId(m.id);
      if (!kinds.includes(m.kind) || !title(m.title) || m.complete !== true) fail('Incomplete module');
      const get = async (key, limit) => {
        const path = safePath(m[key]);
        if (paths.has(path) || ['manifest.json', 'README.txt'].includes(path) || !path.endsWith(key === 'file' ? '.md' : '.jpg')) fail('Invalid file reference');
        paths.add(path);
        const data = await localFile(base, path, limit);
        if (hash(data) !== m[key + '_sha256']) fail('Template hash mismatch');
        return data;
      };
      const content = await get('file', 48000);
      const body = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (!text(body, 12000)) fail('Invalid module text');
      total += [...body].length;
      let image = null;
      if (m.image != null) {
        if (!['setting', 'player', 'lead', 'support'].includes(m.kind)) fail('Unexpected image role');
        const bytes = await get('image', 2 * 1024 * 1024);
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('Expected JPEG image');
        if ([m.image_width, m.image_height].some(v => v != null && (!Number.isInteger(v) || v < 1 || v > 1024))) fail('Invalid image dimensions');
        const url = manifestPath.replace('manifest.json', m.image);
        image = { thumbnail: url, detail: url, width: m.image_width || 1024, height: m.image_height || 1024, alt: m.title };
      }
      if (m.kind !== 'prompt') indexed.push({ id: m.id, type: m.kind === 'setting' ? 'setting' : m.kind === 'opening' ? 'plot' : 'character',
        role: m.kind, title: m.title, summary: body.slice(0, 220), description: body, image, tags: [], author: entry.author || { name: 'Редакция' } });
    }
    if (total > 60000) fail('Story text too large');
    const setting = indexed.find(m => m.role === 'setting');
    catalog.stories.push({ id: manifest.id, title: manifest.title, summary: entry.summary || '',
      cover: setting.image, categories: entry.categories || [], tags: entry.tags || [], author: entry.author || { name: 'Редакция' },
      setting_id: setting.id, plot_id: indexed.find(m => m.role === 'opening').id, character_ids: characters.map(m => m.id),
      template: { manifest: manifestPath, sha256: hash(raw) } });
    catalog.modules.push(...indexed);
  }
  const output = JSON.stringify(catalog, null, 2) + '\n';
  if (catalog.modules.length > 10000) fail('Too many catalog modules');
  if (Buffer.byteLength(output) > 2 * 1024 * 1024) fail('Catalog index exceeds bot limit (2 MiB)');
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const publicDir = resolve('public');
  const catalog = await compileCatalog(publicDir);
  await writeFile(resolve(publicDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Catalog compiled: ${catalog.stories.length} stories, ${catalog.modules.length} modules`);
}
