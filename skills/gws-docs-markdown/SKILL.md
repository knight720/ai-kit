---
name: gws-docs-markdown
description: >
  以 Markdown 格式讀取、編輯、寫入 Google Doc。支援匯出為 .md、本地修改後整份覆蓋上傳，
  可保留表格、標題、粗體等完整格式。適用於「append 內容到文件末端」、「修正文件結構」、
  「產生內容後寫入 Google Doc」等情境。當使用者說「寫入 Google Doc」、「更新 doc」、
  「把內容加到文件」、「覆蓋 google doc」、「匯出 doc 為 markdown」、「以 markdown 編輯文件」、
  「append 到文件末端」時，請立即使用此 skill。
  比 gws-docs 的 +write 更強大：+write 只支援純文字，本 skill 支援完整 Markdown 格式。
metadata:
  version: 1.0.0
  openclaw:
    category: "productivity"
    requires:
      bins:
        - gws
---

# gws-docs-markdown

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules.

以 Markdown 格式操作 Google Doc 的完整工作流程。
Google Drive API 原生支援 `text/markdown` 作為匯入／匯出格式，因此可以：
- 整份匯出為 `.md` → 本地編輯 → 整份覆蓋上傳
- 這個方式比 `batchUpdate` 簡單許多，且能保留完整的 Markdown 格式（表格、標題、粗體）

---

## 從 Google Doc URL 取得 File ID

```
https://docs.google.com/document/d/<FILE_ID>/edit
```

---

## 核心指令

### 匯出為 Markdown

```powershell
gws drive files export `
  --params '{"fileId": "FILE_ID", "mimeType": "text/markdown"}' `
  -o ".\doc.md"
```

### 整份覆蓋上傳

```powershell
gws drive files update `
  --params '{"fileId": "FILE_ID"}' `
  --json '{"mimeType": "application/vnd.google-apps.document"}' `
  --upload ".\doc.md" `
  --upload-content-type "text/markdown"
```

---

## 標準工作流程

### 情境 A：Append 內容到文件末端

```
1. 匯出現有文件為 .md
2. 讀取 .md 內容（用 view tool）
3. 在末端加入新內容
4. 整份覆蓋上傳
```

```powershell
# Step 1: 匯出
gws drive files export `
  --params '{"fileId": "FILE_ID", "mimeType": "text/markdown"}' `
  -o "$env:TEMP\doc.md"

# Step 2: 本地修改（PowerShell 範例）
$existing = Get-Content "$env:TEMP\doc.md" -Encoding UTF8 -Raw
$append = @"

## 新章節標題

內容段落...

| 欄位 | 值 |
| :--- | :--- |
| A    | 123 |

**結論文字**
"@
($existing.TrimEnd() + "`n" + $append) | Set-Content "$env:TEMP\doc.md" -Encoding UTF8

# Step 3: 上傳覆蓋
gws drive files update `
  --params '{"fileId": "FILE_ID"}' `
  --json '{"mimeType": "application/vnd.google-apps.document"}' `
  --upload "$env:TEMP\doc.md" `
  --upload-content-type "text/markdown"
```

### 情境 B：產生新內容並寫入空文件

先取得空文件的 File ID，然後直接上傳：

```powershell
$md = @"
# 文件標題

## 第一節

段落內容...
"@
$md | Set-Content "$env:TEMP\new_doc.md" -Encoding UTF8

gws drive files update `
  --params '{"fileId": "FILE_ID"}' `
  --json '{"mimeType": "application/vnd.google-apps.document"}' `
  --upload "$env:TEMP\new_doc.md" `
  --upload-content-type "text/markdown"
```

---

## Markdown 格式注意事項

Google Drive 轉換 Markdown → Google Docs 時，以下規則很重要：

| 規則 | 說明 |
| :--- | :--- |
| **標題與表格之間必須有空行** | 否則匯出後標題會與表格黏在同一行 |
| **段落之間必須有空行** | 連續行文字會被合併為同一段 |
| **表格語法** | 標準 Markdown 表格，含 `:---:` 對齊語法，完整支援 |
| **粗體／斜體** | `**粗體**`、`*斜體*` 均支援 |
| **標題階層** | `#` ~ `######` 對應 Google Docs Heading 1~6 |
| **匯出品質** | 匯出的 .md 可能缺少換行，建議修改前先整理換行再上傳 |

---

## 與其他方式的比較

| 方式 | 優點 | 缺點 |
| :--- | :--- | :--- |
| **本 skill（Markdown 匯入）** | 格式完整、語法簡單 | 整份取代，需自管歷史內容 |
| `gws docs +write` | 快速 append | 僅純文字，無格式 |
| `gws docs batchUpdate` | 精確控制位置 | 需計算 index，複雜易出錯 |

---

## See Also

- [gws-shared](../gws-shared/SKILL.md) — Global flags and auth
- [gws-docs](../gws-docs/SKILL.md) — Documents API 完整參考（batchUpdate、create）
- [gws-docs-parser](../gws-docs-parser/SKILL.md) — 讀取 Doc 內容（含 CJK 編碼修正）
