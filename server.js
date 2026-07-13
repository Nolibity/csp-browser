import express from 'express';
import { readFile, readdir, rename, stat, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { chatWithCharacter, distillCharacter } from './llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Auto-create config.json from template on first run
const configPath = join(__dirname, 'config.json');
const examplePath = join(__dirname, 'config.example.json');
if (!existsSync(configPath) && existsSync(examplePath)) {
  await copyFile(examplePath, configPath);
  console.log('Created config.json from config.example.json — please edit it with your API key.');
}
const upload = multer({ dest: join(__dirname, 'uploads') });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const CHARS_DIR = join(__dirname, 'characters');
const SKILLS_DIR = join(process.env.HOME || process.env.USERPROFILE || '.', '.claude', 'skills');
const PRESET_SLUGS = ['takamatsu-tomori', 'chihaya-anon', 'togawa-sakiko', 'mutsumi-wakaba'];

let characters = [];

function parseDesc(desc) {
  // "角色名（Romaji），《作品名》..." or "角色名（Romaji），Works Title..."
  const m = desc.match(/^(.+?)（.+?），[《「](.+?)[》」]/);
  if (m) return { name: m[1], work: m[2] };
  return null;
}

async function loadCharacter(dir, slug) {
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'));
  } catch {}

  let description = '';
  try {
    const skillMd = await readFile(join(dir, 'SKILL.md'), 'utf-8');
    // Handle YAML description: | (multi-line) or inline
    const descMatch = skillMd.match(/^description:\s*\|\s*\n((?:\s{2,}.+\n?)+)/m);
    if (descMatch) {
      description = descMatch[1].replace(/^\s+/gm, '').replace(/\n/g, '').trim();
    } else {
      const m = skillMd.match(/^description:\s*"?([^"]*)"?\s*$/m);
      if (m) description = m[1].trim();
    }
  } catch {}

  const parsed = parseDesc(description);

  return {
    slug,
    name: manifest.character || (parsed ? parsed.name : slug),
    work: manifest.work || (parsed ? parsed.work : ''),
    aliases: manifest.aliases || [],
    description,
    hasAvatar: existsSync(join(dir, 'avatar.png'))
  };
}

async function scanCharacters() {
  characters = [];
  const seen = new Set();

  for (const slug of PRESET_SLUGS) {
    const dir = join(CHARS_DIR, slug);
    try {
      await stat(dir);
      const c = await loadCharacter(dir, slug);
      characters.push(c);
      seen.add(slug);
    } catch {}
  }

  try {
    const entries = await readdir(SKILLS_DIR);
    for (const entry of entries) {
      if (seen.has(entry) || entry === 'csp') continue;
      const dir = join(SKILLS_DIR, entry);
      try {
        const s = await stat(dir);
        if (!s.isDirectory()) continue;
        const sk = join(dir, 'SKILL.md');
        if (!existsSync(sk)) continue;
        const c = await loadCharacter(dir, entry);
        if (c.name === entry) continue; // skip entries without a real character name
        characters.push(c);
      } catch {}
    }
  } catch {}
}

async function findCharacterDir(slug) {
  if (PRESET_SLUGS.includes(slug)) {
    const dir = join(CHARS_DIR, slug);
    try { await stat(dir); return dir; } catch {}
  }
  const dir = join(SKILLS_DIR, slug);
  try { await stat(dir); return dir; } catch {}
  return null;
}

// --- Routes ---

app.get('/api/config', async (_req, res) => {
  try {
    const config = JSON.parse(await readFile(join(__dirname, 'config.json'), 'utf-8'));
    res.json(config);
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { provider, apiKey, baseUrl, model } = req.body;
    const config = { provider, apiKey, baseUrl, model };
    await writeFile(join(__dirname, 'config.json'), JSON.stringify(config, null, 2) + '\n');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.get('/api/characters', (_req, res) => {
  res.json(characters);
});

app.get('/api/characters/:slug', async (req, res) => {
  const dir = await findCharacterDir(req.params.slug);
  if (!dir) return res.status(404).json({ error: 'Character not found' });

  try {
    const skillMd = await readFile(join(dir, 'SKILL.md'), 'utf-8');
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'));
    res.json({ skillMd, manifest });
  } catch {
    res.status(500).json({ error: 'Failed to read character files' });
  }
});

app.get('/api/characters/:slug/avatar', async (req, res) => {
  const dir = await findCharacterDir(req.params.slug);
  if (!dir) return res.status(404).json({ error: 'Not found' });

  const avatarPath = join(dir, 'avatar.png');
  if (existsSync(avatarPath)) {
    res.sendFile(avatarPath);
  } else {
    res.status(404).json({ error: 'No avatar' });
  }
});

app.post('/api/characters/:slug/avatar', upload.single('avatar'), async (req, res) => {
  const dir = await findCharacterDir(req.params.slug);
  if (!dir) return res.status(404).json({ error: 'Character not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const avatarPath = join(dir, 'avatar.png');
  await rename(req.file.path, avatarPath);

  const c = characters.find(ch => ch.slug === req.params.slug);
  if (c) c.hasAvatar = true;

  res.json({ ok: true });
});

app.delete('/api/characters/:slug', async (req, res) => {
  const dir = await findCharacterDir(req.params.slug);
  if (!dir) return res.status(404).json({ error: 'Character not found' });

  // Prevent deleting preset characters
  if (PRESET_SLUGS.includes(req.params.slug)) {
    return res.status(403).json({ error: 'Cannot delete preset characters' });
  }

  try {
    await rm(dir, { recursive: true, force: true });
    characters = characters.filter(c => c.slug !== req.params.slug);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/:slug', async (req, res) => {
  const dir = await findCharacterDir(req.params.slug);
  if (!dir) return res.status(404).json({ error: 'Character not found' });

  const { messages, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing message' });

  try {
    const skillMd = await readFile(join(dir, 'SKILL.md'), 'utf-8');
    const reply = await chatWithCharacter(skillMd, messages || [], message);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

function makeSlug(name) {
  const hash = Date.now().toString(36);
  return 'char-' + hash;
}

app.post('/api/create', async (req, res) => {
  const { character, work } = req.body;
  if (!character || !work) return res.status(400).json({ error: 'Missing character or work' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    send({ text: `开始为 ${character}（${work}）生成角色 Skill...\n` });
    send({ text: '正在调用 DeepSeek 蒸馏角色行为模式...\n\n' });

    const skillMd = await distillCharacter(character, work);

    send({ text: '\n✅ 角色 Skill 生成完成！正在保存...\n' });

    // Generate slug and create directory
    const slug = makeSlug(character);
    const skillDir = join(SKILLS_DIR, slug);
    await mkdir(skillDir, { recursive: true });

    // Write SKILL.md
    await writeFile(join(skillDir, 'SKILL.md'), skillMd, 'utf-8');

    // Generate manifest.json
    const now = new Date().toISOString().slice(0, 10);
    const manifest = {
      schema_version: '1.0',
      name: slug,
      character,
      work,
      aliases: [],
      generated_at: now,
      research_started_at: now,
      research_completed_at: now,
      latest_source_checked_at: now,
      covered_until: { date: now, description: '基于 LLM 知识库蒸馏' },
      covered_media: [],
      not_covered: [],
      source_count: 1,
      source_tiers: { 'llm-knowledge': 1 },
      quality_score: null,
      honesty_boundary: '基于 LLM 训练数据中的公开资料蒸馏，未经独立来源交叉验证',
      csp_version: 'browser'
    };
    await writeFile(join(skillDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    await scanCharacters();
    send({ done: true, slug });
  } catch (err) {
    console.error('Distill error:', err);
    send({ error: true, message: err.message });
  }
  res.end();
});

// Catch-all: serve index.html for SPA-style routing
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// --- Startup ---
const PORT = process.env.PORT || 3000;
await scanCharacters();
app.listen(PORT, () => {
  console.log(`CSP Browser running at http://localhost:${PORT}`);
  console.log(`Loaded ${characters.length} characters`);
});
