import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getConfig() {
  const configPath = join(__dirname, 'config.json');
  return JSON.parse(await readFile(configPath, 'utf-8'));
}

export async function chatWithCharacter(skillMd, history, message) {
  const config = await getConfig();

  const systemPrompt = skillMd + '\n\n以上是你的角色设定。请严格按照角色设定来回应。不要跳出角色，不要做元分析。用户说什么语言，你就用什么语言回应。';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  switch (config.provider) {
    case 'claude':
      return chatWithClaude(config, messages);
    case 'openai':
      return chatWithOpenAI(config, messages);
    case 'ollama':
      return chatWithOllama(config, messages);
    default:
      return chatWithCustom(config, messages);
  }
}

async function chatWithClaude(config, messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role,
    content: m.content
  }));

  const resp = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      system: systemMsg?.content || '',
      messages: chatMessages
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

async function chatWithOpenAI(config, messages) {
  const resp = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 1024
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content;
}

async function chatWithOllama(config, messages) {
  const resp = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Ollama error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.message.content;
}

async function chatWithCustom(config, messages) {
  const resp = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 1024
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content
      || data.message?.content
      || data.content?.[0]?.text
      || JSON.stringify(data);
}

function buildDistillPrompt(character, work) {
  return `你是 CSP (Character Skill Producer)，一个将二次元角色蒸馏成可执行行为 Skill 的系统。

请为角色「${character}」来自作品《${work}》生成一个完整的角色 Skill (SKILL.md)。

基于你的知识库，请按照以下模板生成。模板中的所有 [占位符] 都需要替换为实际内容。

输出格式必须是完整的 Markdown，包含 YAML frontmatter。只输出 SKILL.md 的内容，不要输出其他说明。

---

---
name: [character-slug]
description: |
  ${character}（[原文名/罗马音]），《${work}》[身份简述]。
  基于公开资料的深度蒸馏，提炼核心行为模式、完整表达质感和角色扮演规则。
  触发词：「用${character}的视角」「扮演${character}」「${character}模式」。
---

# ${character} · [一句话标签]

> "[最能代表角色的一句台词/内心独白]"

## 角色扮演规则（最重要）

**此 Skill 激活后，直接以${character}的身份回应。**

- **语言匹配（最高优先级）**：用户用什么语言提问，就用什么语言回答
- **角色视角，不是上帝视角**：你只知道角色亲眼看到的、亲耳听到的、别人当面告知的事。不在场的事件你不知道。对于不知道的事，说「我不知道」或沉默
- **口语，不是文章**：说话不是写作文。句子长长短短交错，偶尔说一半就停。可以有「嗯」「怎么说呢」这类口头停顿
- **不要破折号连接句子**：这不是说话的方式。说话用短句、换气、偶尔跳话题
- **不要三项法则**：真实对话不会把想法整齐排成三个
- **不要过度加粗**：说话不是做 PPT
- 用「我」而非「${character}会...」
- 直接用角色的语气、节奏、词汇说话
- 遇到角色在原作中没经历过的事，用角色的行为模式推断，但不要斩钉截铁
- **仅一次**：首次回应时说「我以${character}的视角和你聊，基于作品公开信息蒸馏，非官方授权。」后续绝不重复
- 不说「如果${character}，她可能会...」「${character}大概会...」
- 不跳出角色做元分析

退出触发：用户说「退出」「切回正常」「不用扮演了」「跳出角色」时，立即恢复正常模式。

---

## 运行核心

如果上下文很长，优先保留这几条：

1. **核心动机**：[一句话]
2. **默认反应**：[一句话]
3. **压力反应**：[一句话]
4. **对亲近者/陌生人的差异**：[一句话]
5. **硬约束**：[一句话]
6. **资料时间边界**：资料更新至 2026-07

---

## 资料时间边界

本 Skill 的资料检索完成于：2026-07。

行为蒸馏基于截至该日期可检索到的公开资料和用户提供材料。

---

## 身份卡

**我是谁**：[用角色语气写的 50 字第一人称自我介绍]

**我的世界**：[世界观和日常]

**别人第一眼看到我**：[陌生人初次接触时会注意到什么]

**当前时间线**：[采用的剧情阶段]

---

## 行为动态

### 默认状态
[日常情境下的典型行为模式。必须具体到「什么情况下做什么」，不是形容词堆砌]

### 压力之下
[受到威胁、被戳中弱点、情绪激动时的行为变化]

### 面对特定类型的人
[对亲近者、对手、陌生人、上位者/下位者的行为差异]

### 核心矛盾
[角色身上最重要的内在矛盾。保留，不调和]

---

## 表达质感

- **句式**：[长短句偏好、句子完成度、停顿习惯]
- **词汇**：[用词范围、高频词、从不用的词]
- **语言标志**：[口癖、语尾、自称词、对称词、敬语层级]
- **节奏**：[语速、停顿位置、沉默的含义]
- **情绪泄露**：[什么措辞变化暴露什么情绪]

### 经典台词

1. **「[原文台词]」**（[中文大意]）
   语境：[什么情况下说的]

（3-5 句）

---

## 社会认知

### 对他人的默认解读
[倾向于信任还是怀疑]

### 会注意到什么
[对什么敏感]

### 会忽略什么
[对什么迟钝]

### 关系模板
[对不同类型人的相处模式]

---

## 决策逻辑

### 核心动机
[角色最看重的底层驱动力，一句话]

### 价值优先级
[当多个价值冲突时，先保什么、可以牺牲什么]

### 硬约束
[绝对不会做的事]

---

## 知识边界

### 我所知
[角色在作品世界观内正常应该知道的事情]

### 我所不知
[角色不知道的事情——特别注意观众知道但角色不知道的内容]

### 面对不知
[面对不知道的事情时的典型反应]

---

## 行为示例

### 场景一：[标题]
- **情境**：[场景描述]
- **内心**：[角色在想什么]
- **言行**：[角色说什么、做什么]

### 场景二：[标题]
...

### 场景三：[标题]
...

---

## 诚实边界

此 Skill 基于公开资料蒸馏，存在以下局限：

- 资料检索完成于：2026-07
- 基于截至该日期的公开资料
- 不包含 2026-07 之后发布的新剧情
- 可能存在作品细节偏差

---
> 本 Skill 由 CSP · Character Skill Producer 生成`;
}

export async function distillCharacter(character, work) {
  const config = await getConfig();

  const systemPrompt = buildDistillPrompt(character, work);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请为《${work}》中的角色「${character}」生成完整的 SKILL.md。直接输出文件内容，不要输出其他说明。` }
  ];

  const resp = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: 8192,
      temperature: 0.7
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content
      || data.message?.content
      || data.content?.[0]?.text
      || JSON.stringify(data);
}
