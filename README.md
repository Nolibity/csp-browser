# CSP Browser

二次元角色对话平台。使用 CSP (Character Skill Producer) 技术将角色蒸馏为可执行的行为 Skill，通过 DeepSeek 大模型驱动角色以原作身份、语气和行为模式与你对话。

## 功能

- **角色展示** — 浏览预设角色，按作品筛选，查看角色简介
- **角色对话** — 与角色实时聊天，支持多轮对话历史，侧栏管理对话记录
- **角色创建** — 输入角色名 + 作品名，AI 自动蒸馏生成角色 Skill
- **深色/浅色主题** — 一键切换

## 快速开始

**前提**：电脑需安装 Node.js → https://nodejs.org （下载左边 LTS 版本，安装一路 Next）

**运行**：双击 `start.bat`，首次自动安装依赖，之后每次双击即可启动，浏览器自动打开。

## 配置 API Key

角色对话需要 DeepSeek API Key：

1. 打开 [platform.deepseek.com](https://platform.deepseek.com) 注册
2. 进入「API Keys」创建 Key
3. 在浏览器页面右上角 ⚙ 设置中填入 Key，保存即可

首次启动时会自动从 `config.example.json` 生成 `config.json`，也可以手动复制：

```bash
cp config.example.json config.json
# 编辑 config.json 填入你的 apiKey
```

## 预设角色

- 高松灯 — BanG Dream! It's MyGO!!!!!
- 千早爱音 — BanG Dream! It's MyGO!!!!!
- 丰川祥子 — BanG Dream! It's MyGO!!!!!
- 若叶睦 — BanG Dream! It's MyGO!!!!!

## 技术栈

- Node.js + Express
- Vanilla HTML/CSS/JS
- DeepSeek API (OpenAI 兼容格式)
- CSP Skill 蒸馏

## 作者

- **GitHub**：[Nolibity](https://github.com/Nolibity)
- **邮箱**：3622776232@qq.com
- **B站**：[铹先生](https://space.bilibili.com)
