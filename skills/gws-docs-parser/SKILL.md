---
name: gws-docs-parser
description: >
  Robustly read Google Docs content (including all tabs) with encoding-safe JSON parsing.
  Use this skill whenever the user wants to read, fetch, or extract text content from a
  Google Doc — especially when multiple tabs are involved, or when the document contains
  Chinese / CJK characters. This skill works around known bugs in the `gws` CLI tool output:
  literal newlines inside JSON strings, non-JSON header lines, and Unicode Private Use Area
  characters. Trigger on phrases like "讀取 doc", "read google doc", "抓取文件內容",
  "read all tabs", "google doc 內容", or any request to get text from a Google Doc URL.
metadata:
  version: 1.0.0
  openclaw:
    category: "productivity"
    requires:
      bins:
        - gws
        - python
---

# gws-docs-parser

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules.

Use this skill **instead of `gws-docs`** whenever you need to read document **text content**.
`gws docs documents get` has known JSON encoding bugs — this skill provides reliable workarounds.

---

## Known Issues with `gws docs` Output

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| First line: `Using keyring backend: keyring` | gws 將 keyring 訊息混入 stdout | 跳到第一個 `{` |
| `revisionId` 字串中有 literal `\n` | gws 輸出長字串時未 escape | 狀態機修復 |
| `textRun.content` 中有 literal `\n` | gws 未 escape JSON string 內的控制字元 | 狀態機修復 |
| Unicode PUA 字元（U+E000–U+F8FF） | Google Docs 字型用私用區字元表示 bullet 等符號 | regex 過濾 |
| Windows 終端 CP950 顯示亂碼 | PowerShell console 預設 Big5 code page | 寫 UTF-8 檔，用 view tool 讀 |
| `content` 欄位 JSON 解析失敗 | gws 輸出的 content string 有時缺少結尾 `"` | 逐行掃描修補（見 `fix_content_line`）|
| `>` 重導向造成中文亂碼 | PowerShell `>` 以 Console Encoding (CP950) 寫檔，gws 輸出是 UTF-8 | 先設 `[Console]::OutputEncoding = UTF8`，再用 `\| Out-File -Encoding utf8` |

---

## Workflow

### Step 1 — 取得文件 ID

從 Google Doc URL 提取 document ID：
```
https://docs.google.com/document/d/<DOCUMENT_ID>/edit
```

### Step 2 — 抓取原始輸出並存檔

```powershell
$docId = "<DOCUMENT_ID>"
$rawFile = "$env:TEMP\gdoc_raw.txt"
# ⚠️ 必須先設 Console Encoding 為 UTF-8，否則 PowerShell 會以 CP950 擷取 gws 的 UTF-8 輸出，造成中文亂碼
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
gws docs documents get --params "{`"documentId`": `"$docId`", `"includeTabsContent`": true}" | Out-File -FilePath $rawFile -Encoding utf8
```

> **注意：** 禁止使用 `>` 重導向（PowerShell 的 `>` 依 Console Encoding 寫檔，預設 CP950 會把 UTF-8 亂掉）。
> 必須用 `| Out-File -Encoding utf8` 並且事先設定 `[Console]::OutputEncoding = UTF8`。

### Step 3 — 用 Python 解析並輸出 UTF-8 文字

將以下 Python 腳本存成暫存檔後執行，或直接以 `python -c` 或 `powershell` 內嵌執行：

```python
import json, re, os

raw_path = os.path.join(os.environ['TEMP'], 'gdoc_raw.txt')
out_path = os.path.join(os.environ['TEMP'], 'gdoc_parsed.txt')

raw = open(raw_path, encoding='utf-8', errors='replace').read()

# Fix 0: 去除 UTF-8 BOM（Out-File -Encoding utf8 會加 BOM）
if raw.startswith('\ufeff'):
    raw = raw[1:]

# Fix 1: 跳過 keyring header，找到第一個 '{'
raw = raw[raw.index('{'):]

# Fix 2: 逐行修補 content 欄位缺少結尾引號的 bug（gws known issue）
# 症狀：'"content": "文字,' 缺少結尾 '"'，導致 json.loads 失敗
def fix_content_line(line):
    marker = '"content": "'
    pos = line.find(marker)
    if pos < 0:
        return line
    start = pos + len(marker)
    i = start
    while i < len(line):
        ch = line[i]
        if ch == '\\':
            i += 2
            continue
        if ch == '"':
            return line  # 有正確結尾引號，不需修補
        i += 1
    # 沒找到結尾引號，補上
    stripped = line.rstrip('\r\n')
    tail = line[len(stripped):]
    if stripped.endswith(','):
        return stripped[:-1] + '",' + tail
    return stripped + '"' + tail

lines = raw.splitlines(keepends=True)
raw = ''.join(fix_content_line(l) for l in lines)

# Fix 3: 狀態機 — 將 JSON 字串值內的 literal 控制字元 escape 掉
def fix_json(s):
    out, in_str, esc = [], False, False
    for ch in s:
        if esc:
            out.append(ch); esc = False
        elif ch == '\\' and in_str:
            out.append(ch); esc = True
        elif ch == '"':
            out.append(ch); in_str = not in_str
        elif in_str and ord(ch) < 0x20:
            out.append(f'\\u{ord(ch):04x}')
        else:
            out.append(ch)
    return ''.join(out)

data = json.loads(fix_json(raw))

# Fix 4: 過濾 Unicode Private Use Area 字元（字型私用符號）
PUA = re.compile(r'[\ue000-\uf8ff]')

def extract_text(elements):
    lines = []
    for el in elements:
        if 'paragraph' in el:
            text = ''.join(
                r.get('textRun', {}).get('content', '')
                for r in el['paragraph'].get('elements', [])
            )
            text = PUA.sub('', text).rstrip('\n')
            if text.strip():
                lines.append(text)
    return '\n'.join(lines)

tabs = data.get('tabs', [])
sections = []
for tab in tabs:
    props = tab.get('tabProperties', {})
    title = props.get('title', '(未命名)')
    body = tab.get('documentTab', {}).get('body', {}).get('content', [])
    sections.append(f'## {title}\n\n{extract_text(body)}')

output = '\n\n---\n\n'.join(sections)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(output)
print(f"Done: {out_path}")
```

執行方式（PowerShell）：

```powershell
$script = "$env:TEMP\parse_gdoc.py"
# 將上方 Python 腳本寫入 $script，然後：
python $script
```

### Step 4 — 用 view tool 讀取結果

```
view: C:\Users\<USERNAME>\AppData\Local\Temp\gdoc_parsed.txt
```

**請用 `view` tool 讀取，不要用 PowerShell `Get-Content`**（會有 CP950 亂碼問題）。

---

## 快速範例（單一分頁文件）

若文件只有一個分頁，可省略 `includeTabsContent`：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
gws docs documents get --params '{"documentId": "1WR9hSVEFKjGlYZQcZT4o9vKrVceqeauDVQGWGPPRvBM"}' | Out-File -FilePath "$env:TEMP\gdoc_raw.txt" -Encoding utf8
```

Python 解析邏輯相同，`tabs` 陣列仍然存在，只包含一個分頁。

---

## 疑難排解

| 症狀 | 原因 | 處理方式 |
|------|------|---------|
| `json.loads` 仍失敗 | raw 檔案有其他 encoding 問題 | 用 `open(..., errors='replace')` 並檢查 raw 前 5 行 |
| `tabs` 陣列為空 | 未加 `includeTabsContent: true` | 重新抓取，加上此參數 |
| 內容包含大量 `?` | 用了 `>` 重導向而非 `Out-File -Encoding utf8` | 重新抓取，參考 Step 2 正確方式 |
| 部分段落缺失 | 非 paragraph element（table、image 等）| 視需求擴充 `extract_text` 處理 `table` element |

---

## See Also

- [gws-shared](../gws-shared/SKILL.md) — Global flags and auth
- [gws-docs](../gws-docs/SKILL.md) — Documents API 完整參考（batchUpdate、create）
