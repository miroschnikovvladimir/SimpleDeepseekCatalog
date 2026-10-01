import { it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileCatalog, browseCatalog } from './compile-catalog.mjs';
import sharp from 'sharp';

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

it('compiles two-module quick packages with mandatory portraits and age ratings', async () => {
  const {root,dir,manifest,save}=await fixture();
  manifest.mode='quick'; manifest.adult=true;
  manifest.modules=manifest.modules.filter(m=>['prompt','lead'].includes(m.kind));
  await save();
  await expect(compileCatalog(root)).rejects.toThrow('portrait');
  const bytes=await sharp({create:{width:320,height:480,channels:3,background:'#324'}}).jpeg().toBuffer();
  await writeFile(join(dir,'lead.jpg'),bytes);
  Object.assign(manifest.modules[1],{image:'lead.jpg',image_sha256:hash(bytes),image_width:320,image_height:480});
  await save();
  const result=await compileCatalog(root);
  expect(result.stories[0]).toMatchObject({mode:'quick',adult:true,prompt_id:'prompt',lead_id:'lead',character_ids:['lead']});
  expect(result.modules.map(m=>m.role)).toEqual(['prompt','lead']);
  expect(result.stories[0]).not.toHaveProperty('setting_id');
  manifest.adult='true';await save();
  await expect(compileCatalog(root)).rejects.toThrow('age rating');
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

it('keeps full game text while generating real responsive images and spoiler-free previews', async () => {
  const { root, dir, manifest, save } = await fixture();
  const bytes = await sharp({create:{width:768,height:512,channels:3,background:'#263342'}}).jpeg().toBuffer();
  await mkdir(join(dir, 'images'));
  await writeFile(join(dir, 'images/cover.jpg'), bytes);
  const setting = manifest.modules.find(m => m.kind === 'setting');
  Object.assign(setting, {image:'images/cover.jpg', image_sha256:hash(bytes), image_width:768, image_height:512});
  await save();
  await writeFile(join(root, 'templates/index.json'), JSON.stringify({stories:[{manifest:'templates/story/r5/manifest.json',
    presentation:{cover:'templates/story/r5/images/cover.jpg',modules:{opening:{summary:'Завязка',description:'Описание без разгадки',image:'templates/story/r5/images/cover.jpg'}}}}]}));
  const result = await compileCatalog(root);
  const opening = result.modules.find(m => m.role === 'opening');
  expect(opening.description).toBe('Текст opening');
  expect(opening.preview_description).toBe('Описание без разгадки');
  expect(browseCatalog(result).modules.find(m => m.role === 'opening').description).toBe('Описание без разгадки');
  expect(browseCatalog(result).modules.find(m => m.role === 'setting').description).toBe('Текст setting');
  expect(browseCatalog(result).stories).toEqual(result.stories);
  expect(result.stories[0].cover.variants.map(v => v.width)).toEqual([320,640,768]);
  for (const variant of result.stories[0].cover.variants) {
    const metadata = await sharp(await readFile(join(root, variant.url))).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(variant.width);
  }
});

it('rejects presentation images outside the story revision and incomplete descriptions', async () => {
  const {root} = await fixture();
  const save = presentation => writeFile(join(root,'templates/index.json'), JSON.stringify({stories:[{manifest:'templates/story/r5/manifest.json',presentation}]}));
  await save({cover:'templates/other/r1/images/cover.jpg'});
  await expect(compileCatalog(root)).rejects.toThrow('cover path');
  await save({modules:{opening:{summary:'Кратко'}}});
  await expect(compileCatalog(root)).rejects.toThrow('preview');
});
