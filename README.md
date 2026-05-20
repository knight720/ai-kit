# ai-kit

個人 AI 工具收藏庫，類似 `dotfiles` 的概念，專門存放 GitHub Copilot CLI 的 **Skills**、Prompt 範本及相關設定，讓 AI 助理更貼合個人工作流程。

---

## 專案目的

- 集中管理自訂 Skill，方便在不同機器上部署
- 記錄 AI 工具的使用技巧與已知問題的解決方案
- 提供可重用、可分享的 Prompt 與工作流程

---

## 專案結構

```
ai-kit/
├── .github/
│   └── plugin/
│       └── plugin.json          # Copilot Plugin 格式（供 copilot plugin install 使用）
├── skills/
│   ├── gws-docs-markdown/       # 以 Markdown 格式讀寫 Google Doc
│   │   └── SKILL.md
│   └── gws-docs-parser/         # 解析 Google Docs 的強健版（含 CJK 編碼修正）
│       └── SKILL.md
└── marketplace.json             # Marketplace 索引（供 copilot plugin marketplace add 使用）
```

---

## 安裝 Plugin

> **Plugin** 是 Skill 的集合。安裝 plugin 後，其下所有 skills 會自動對 Copilot CLI 生效。

### 方式一：從 GitHub 安裝（Remote）

```powershell
# 直接從 GitHub repo 安裝（一行搞定）
copilot plugin install knight720/ai-kit
```

更新：

```powershell
copilot plugin update ai-kit
```

---

### 方式二：從本地目錄安裝（Local）

適用於本機開發、尚未推到 GitHub 的情境。

```powershell
# Step 1：Clone repo
git clone https://github.com/knight720/ai-kit.git D:\Code\SideProject\ai-kit

# Step 2：將本地路徑加入 marketplace（只需執行一次）
copilot plugin marketplace add D:\Code\SideProject\ai-kit

# Step 3：安裝 plugin
copilot plugin install ai-kit@ai-kit
```

更新（需先 commit，plugin update 從 git 讀取）：

```powershell
git -C D:\Code\SideProject\ai-kit pull   # 或在開發中 commit 本地變更
copilot plugin update ai-kit
```

---

### 方式三：Symbolic Link（本地開發推薦）

適用於需要**邊用邊修改、即改即生效**的情境。直接將 Copilot 讀取 skill 的路徑指向 repo，省去每次修改都要 `plugin update` 的步驟。

```powershell
# Step 1：Clone repo（已有就跳過）
git clone https://github.com/knight720/ai-kit.git D:\Code\SideProject\ai-kit

# Step 2：為每個 skill 建立 symlink（需以系統管理員身分執行，只做一次）
New-Item -ItemType SymbolicLink `
  -Path "$HOME\.copilot\skills\gws-docs-markdown" `
  -Target "D:\Code\SideProject\ai-kit\skills\gws-docs-markdown"

New-Item -ItemType SymbolicLink `
  -Path "$HOME\.copilot\skills\gws-docs-parser" `
  -Target "D:\Code\SideProject\ai-kit\skills\gws-docs-parser"
```

日常開發循環：

```
使用 skill → 發現問題 → 直接編輯 skills\xxx\SKILL.md
  → 下次 Copilot session 自動生效（不需要 plugin update）
  → 滿意後 git commit + git push
```

> **注意：** 新增 skill 時，除了建立目錄與 `SKILL.md`，還需補一條新的 `New-Item` symlink 指令，並更新 `plugin.json` 與 `marketplace.json`。

---

### 確認安裝狀態

```powershell
copilot plugin list
```

---

## 新增 Skill

> **Skill** 是一份 `SKILL.md`，描述 Copilot 應在什麼情況下執行什麼步驟。

### Step 1：建立 skill 目錄與 SKILL.md

```powershell
New-Item -ItemType Directory -Path "skills\my-new-skill"
New-Item -ItemType File -Path "skills\my-new-skill\SKILL.md"
```

`SKILL.md` 最小結構：

```markdown
---
name: my-new-skill
description: >
  一句話說明此 skill 做什麼，以及何時應該觸發。
  觸發關鍵字也寫在這裡，例如「當使用者說 xxx 時，立即使用此 skill」。
---

# my-new-skill

## 工作流程

說明 Copilot 應該執行的步驟...
```

### Step 2：加入 marketplace.json 與 plugin.json

**`marketplace.json`**（新增 skill 路徑到 `skills` 陣列）：

```json
"skills": [
  "./skills/gws-docs-markdown",
  "./skills/gws-docs-parser",
  "./skills/my-new-skill"
]
```

**`.github/plugin/plugin.json`**（同步新增）：

```json
"skills": [
  "./skills/gws-docs-markdown",
  "./skills/gws-docs-parser",
  "./skills/my-new-skill"
]
```

### Step 3：Commit 並更新

```powershell
git add .
git commit -m "feat: add my-new-skill"

copilot plugin update ai-kit
```

---

## Skills 說明

### `gws-docs-markdown`

以 Markdown 格式讀取、編輯、寫入 Google Doc。

**工作流程：** 匯出 .md → 本地修改 → 整份覆蓋上傳

**依賴工具：** `gws`

---

### `gws-docs-parser`

解析 Google Docs 文件內容（含多分頁）的強健版 Skill，用來補強官方 `gws docs` CLI 的已知 JSON 編碼缺陷。

**解決的已知問題：**

| 問題 | 解法 |
|------|------|
| keyring 訊息混入 stdout | 跳到第一個 `{` |
| JSON 字串內含 literal 控制字元 | 狀態機逐字 escape |
| `content` 欄位缺少結尾引號 | 逐行掃描修補 |
| Unicode PUA 字元（字型私用符號） | Regex 過濾 |
| PowerShell `>` 重導向造成亂碼 | 改用 `Out-File -Encoding utf8` |

**依賴工具：** `gws`、`python`

---

## 授權

個人使用，未設定公開授權。
