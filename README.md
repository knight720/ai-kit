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
└── skills/                      # GitHub Copilot CLI 自訂 Skills
    └── gws-docs-parser/         # 解析 Google Docs 的強健版 Skill
        └── SKILL.md
```

---

## Skills 說明

### `gws-docs-parser`

解析 Google Docs 文件內容（含多分頁）的強健版 Skill，用來補強官方 `gws docs` CLI 的已知 JSON 編碼缺陷。

**適用情境：**
- 讀取含中文 / CJK 字元的 Google Doc
- 文件有多個分頁（tabs）需一次取得
- `gws docs documents get` 輸出 JSON 解析失敗

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

## 安裝方式

Skills 使用 Symbolic Link 安裝至 `~\.copilot\skills\`：

```powershell
# 以 gws-docs-parser 為例
New-Item -ItemType SymbolicLink `
  -Path "$env:USERPROFILE\.copilot\skills\gws-docs-parser" `
  -Target "D:\Code\SideProject\ai-kit\skills\gws-docs-parser"
```

---

## 授權

個人使用，未設定公開授權。
