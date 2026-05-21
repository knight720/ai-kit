#!/usr/bin/env node
// CDP fast tool - directly uses WebSocket to query Chrome DevTools Protocol
// Bypasses playwright-cli daemon's faviconUrl bottleneck (up to 3s/tab)
//
// Usage:
//   node cdp.js list [--browser=chrome|msedge|chrome-canary] [--json]
//   node cdp.js find <pattern> [--browser=chrome] [--json]
//   node cdp.js activate <targetId> [--browser=chrome]

const fs = require('fs');
const path = require('path');

// Locate ws module from known global npm paths
const WS_CANDIDATE_PATHS = [
  'C:\\nvm4w\\nodejs\\node_modules\\ws',
  path.join(process.env.LOCALAPPDATA || '', 'nvm', 'v20.19.3', 'node_modules', 'ws'),
  path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'ws'),
];

function loadWs() {
  for (const p of WS_CANDIDATE_PATHS) {
    try { return require(p); } catch {}
  }
  // Fallback: try global require (works if ws is in NODE_PATH)
  try { return require('ws'); } catch {}
  throw new Error('ws module not found. Run: npm install -g ws');
}

function readDevToolsPort(browser) {
  const localAppData = process.env.LOCALAPPDATA || '';
  const portFiles = {
    chrome: path.join(localAppData, 'Google', 'Chrome', 'User Data', 'DevToolsActivePort'),
    msedge: path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'DevToolsActivePort'),
    'chrome-canary': path.join(localAppData, 'Google', 'Chrome SxS', 'User Data', 'DevToolsActivePort'),
    'chrome-dev': path.join(localAppData, 'Google', 'Chrome Dev', 'User Data', 'DevToolsActivePort'),
  };
  const file = portFiles[browser] || portFiles.chrome;
  if (!fs.existsSync(file)) throw new Error('DevToolsActivePort not found: ' + file + '\nStart Chrome with remote debugging enabled.');
  const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
  return { port: parseInt(lines[0].trim(), 10), wsPath: lines[1].trim() };
}

function cdpCommand(port, wsPath, method, params) {
  const WebSocket = loadWs();
  return new Promise((resolve, reject) => {
    const url = 'ws://localhost:' + port + wsPath;
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('CDP timeout (5s): ' + url));
    }, 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: 1, method, params: params || {} }));
    });
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.id === 1) {
        clearTimeout(timer);
        ws.close();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function listTabs(browser) {
  const { port, wsPath } = readDevToolsPort(browser);
  const result = await cdpCommand(port, wsPath, 'Target.getTargets');
  return result.targetInfos.filter(t => t.type === 'page');
}

async function activateTab(browser, targetId) {
  const { port, wsPath } = readDevToolsPort(browser);
  await cdpCommand(port, wsPath, 'Target.activateTarget', { targetId });
}

async function main() {
  const [,, cmd, ...rawArgs] = process.argv;
  const browser = (rawArgs.find(a => a.startsWith('--browser=')) || '--browser=chrome').split('=')[1];
  const asJson = rawArgs.includes('--json');
  const positional = rawArgs.filter(a => !a.startsWith('--'));

  switch (cmd) {
    case 'list': {
      const tabs = await listTabs(browser);
      if (asJson) {
        process.stdout.write(JSON.stringify(tabs, null, 2) + '\n');
      } else {
        console.log('| # | Title | URL |');
        console.log('|---|-------|-----|');
        tabs.forEach((t, i) => console.log('| ' + i + ' | ' + (t.title || '(no title)') + ' | ' + t.url + ' |'));
        console.log('\nTotal: ' + tabs.length + ' tabs');
      }
      break;
    }
    case 'find': {
      const pattern = positional.join(' ').toLowerCase();
      if (!pattern) { console.error('Usage: node cdp.js find <pattern>'); process.exit(1); }
      const tabs = await listTabs(browser);
      const matches = tabs.filter(t =>
        (t.title || '').toLowerCase().includes(pattern) ||
        (t.url || '').toLowerCase().includes(pattern)
      );
      if (asJson) {
        process.stdout.write(JSON.stringify(matches, null, 2) + '\n');
      } else {
        console.log('Found ' + matches.length + ' tab(s) matching "' + pattern + '":');
        console.log('| # | Title | URL | TargetId |');
        console.log('|---|-------|-----|----------|');
        matches.forEach((t, i) => console.log('| ' + i + ' | ' + (t.title || '(no title)') + ' | ' + t.url + ' | ' + t.targetId + ' |'));
      }
      break;
    }
    case 'activate': {
      const targetId = positional[0];
      if (!targetId) { console.error('Usage: node cdp.js activate <targetId>'); process.exit(1); }
      await activateTab(browser, targetId);
      console.log('Activated tab: ' + targetId);
      break;
    }
    default:
      console.log([
        'Usage:',
        '  node cdp.js list [--browser=chrome|msedge|chrome-canary] [--json]',
        '  node cdp.js find <pattern> [--browser=chrome] [--json]',
        '  node cdp.js activate <targetId> [--browser=chrome]',
      ].join('\n'));
  }
}

main().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
