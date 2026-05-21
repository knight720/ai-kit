---
name: browser-quick-nav
description: >
  快速瀏覽器 tab 導航工具，補足 playwright-cli 在多視窗/大量 tab 場景的效能瓶頸。
  透過直接 CDP WebSocket 繞過 playwright-cli daemon 的 faviconUrl 初始化（每 tab 最多 3 秒），
  讓 tab 列舉和查詢在毫秒級完成。之後再交給 playwright-cli 進行頁面互動。

  適用場景：
  - Chrome 開啟大量分頁（>10）導致 playwright-cli attach 逾時（30 秒 daemon 限制）
  - 需要快速找到目標 tab 再切換給 playwright-cli 操作
  - 跨多個 Chrome 視窗列出所有分頁

allowed-tools: Bash(node:*) Bash(playwright-cli:*) Bash(npx:*)
---

# Browser Quick Nav

## 背景：為何需要此 skill

`playwright-cli attach --cdp=chrome` 在大量 tab 時會非常慢，原因是：

1. **faviconUrl() 瓶頸**：每個 tab 都會在瀏覽器內發 HTTP fetch 取 favicon 並轉 base64，逾時為 3 秒/tab
2. **Daemon 30 秒限制**：tab 數量多時 favicon 累積超過 30 秒，導致 daemon 初始化逾時
3. **listChannelSessions() 循序掃描**：8 個 browser channel 依序探測，每個 TCP 逾時 250ms

**解法**：直接用 CDP WebSocket 的 `Target.getTargets` 繞過 favicon 邏輯，速度從 30 秒降至 <1 秒。

---

## 核心腳本

位於 `scripts/cdp.js`，Node.js 原生實作，無額外依賴（ws 模組除外）。

```bash
# ws 模組（僅需安裝一次）
npm install -g ws
```

---

## 快速指令

### 列出所有 tab

```bash
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js list
```

輸出格式：

```
| # | Title | URL |
|---|-------|-----|
| 0 | Google Keep | https://keep.google.com/ |
| 1 | GitHub | https://github.com/ |
```

### 搜尋 tab（依 title 或 URL 關鍵字）

```bash
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js find github
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js find 91app
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js find erp
```

輸出包含 targetId，可用於後續 activate 或 playwright-cli：

```
| # | Title | URL | TargetId |
|---|-------|-----|----------|
| 0 | GitHub | https://github.com/ | XXXXXXXX-XXXX-... |
```

### 切換到指定 tab（前景顯示）

```bash
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js activate <targetId>
```

### JSON 輸出（供程式處理）

```bash
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js list --json
node D:\Code\SideProject\ai-kit\skills\browser-quick-nav\scripts\cdp.js find github --json
```

### 指定 browser channel

```bash
node ... list --browser=msedge
node ... list --browser=chrome-canary
```

支援：`chrome`（預設）、`msedge`、`chrome-canary`

---

## 與 playwright-cli 的協作流程

### 標準流程：找 tab → 操作 tab

```bash
# Step 1：用 browser-quick-nav 快速找到目標 tab（<1 秒）
node scripts/cdp.js find erp --json

# Step 2：用 playwright-cli attach 操作（此時 Chrome 已有 CDP 端點）
playwright-cli attach --cdp=chrome

# Step 3：用 tab-list 確認，再 tab-select 切換
playwright-cli tab-list
playwright-cli tab-select 3
playwright-cli snapshot
```

### 當 playwright-cli attach 逾時時的替代方案

如果 `playwright-cli attach --cdp=chrome` 超過 30 秒失敗，代表 tab 數量太多導致 favicon 初始化逾時。
此時先用此 skill 列出 tab 清單，讓使用者確認目標 tab，關閉不必要的 tab 後再重新 attach。

```bash
# 列出所有 tab，協助使用者識別可以關閉的
node scripts/cdp.js list

# 或找到特定服務的 tab
node scripts/cdp.js find youtube
```

---

## 效能比較

| 方法 | 30 個 tab 耗時 | 100 個 tab |
|------|---------------|------------|
| playwright-cli attach | ~30 秒（逾時） | 逾時 |
| browser-quick-nav (CDP) | ~200ms | ~500ms |

---

## 前置條件

Chrome 必須開啟遠端除錯：

1. 在 Chrome 網址列輸入：`chrome://inspect/#remote-debugging`
2. 勾選 **「Discover network targets」** 或確認已啟用遠端除錯
3. 確認 `%LOCALAPPDATA%\Google\Chrome\User Data\DevToolsActivePort` 檔案存在

或以除錯模式啟動 Chrome：

```powershell
Start-Process "chrome" "--remote-debugging-port=9222"
```
