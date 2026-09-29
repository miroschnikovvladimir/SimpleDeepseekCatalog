import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileCatalog } from './compile-catalog.mjs';

const directories = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'catalog-test-'));
  directories.push(root);
  const dir = join(root, 'templates/story/r5');
  await mkdir(dir, { recursive: true });
  const manifest = { format: 'simpledeepseek.story', version: 1, id: 'story', title: 'Тест', revision: 5,
    modules: ['prompt', 'setting', 'player', 'lead', 'opening'].map(kind => ({
      id: kind, kind, title: kind, file: kind + '.md', file_sha256: hash(Buffer.from('Текст ' + kind)), image: null, complete: true })) };
  for (const m of manifest.modules) await writeFile(join(dir, m.file), 'Текст ' + m.kind);
  const save = () => writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
  await save();
  await writeFile(join(root, 'templates/index.json'), JSON.stringify({ stories: [{ manifest: 'templates/story/r5/manifest.json' }] }));
  return { root, dir, manifest, save };
}

it('compiles loose Markdown files into cards with a hashed package reference', async () => {
  const { root } = await fixture();
  const catalog = await compileCatalog(root);
  expect(catalog.stories[0].template.manifest).toBe('templates/story/r5/manifest.json');
  expect(catalog.stories[0].template.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(catalog.modules.map(m => m.role)).toEqual(['setting', 'player', 'lead', 'opening']);
  expect(catalog.modules[0].description).toBe('Текст setting');
});
it('rejects altered module bytes', async () => {
  const { root, dir } = await fixture();
  await writeFile(join(dir, 'player.md'), 'tampered');
  await expect(compileCatalog(root)).rejects.toThrow('hash mismatch');
});
it('rejects incomplete roles and unsafe paths', async () => {
  const { root, manifest, save } = await fixture();
  manifest.modules[0].kind = 'support';
  await save();
  await expect(compileCatalog(root)).rejects.toThrow('roles');
  manifest.modules[0].kind = 'prompt';
  manifest.modules[0].file = '../private.md';
  await save();
  await expect(compileCatalog(root)).rejects.toThrow('path');
});
it('rejects invalid public card metadata before deployment', async () => {
  const { root } = await fixture();
  await writeFile(join(root, 'templates/index.json'), JSON.stringify({ stories: [{ manifest: 'templates/story/r5/manifest.json', summary: 'x'.repeat(1001) }] }));
  await expect(compileCatalog(root)).rejects.toThrow('summary');
});
