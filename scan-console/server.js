// 扫描运行台 —— 后端服务
// 托管前端控制台 + 提供端口/目录扫描 API
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPortScan } from './lib/portscan.js';
import { runDirScan } from './lib/dirscan.js';
import { DEFAULT_WORDLIST, EXTENSION_OPTIONS } from './lib/wordlists.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 暴露字典选项给前端
app.get('/api/meta', (_req, res) => {
  res.json({ extensions: EXTENSION_OPTIONS, defaultWordlist: DEFAULT_WORDLIST });
});

// 端口扫描
app.post('/api/portscan', async (req, res) => {
  try {
    const { target, ports } = req.body || {};
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: '缺少目标主机（host 或 IP）' });
    }
    if (!Array.isArray(ports) || ports.length === 0) {
      return res.status(400).json({ error: '端口列表为空' });
    }
    const cleanPorts = ports
      .map((p) => parseInt(p, 10))
      .filter((p) => Number.isInteger(p) && p >= 1 && p <= 65535);
    if (cleanPorts.length === 0) {
      return res.status(400).json({ error: '没有合法的端口（1-65535）' });
    }
    const results = await runPortScan(target.trim(), cleanPorts);
    const open = results.filter((r) => r.status === 'open');
    res.json({ target, total: results.length, openCount: open.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 目录扫描
app.post('/api/dirscan', async (req, res) => {
  try {
    const { target, extensions, wordlist, concurrency } = req.body || {};
    if (!target || typeof target !== 'string') {
      return res.status(400).json({ error: '缺少目标 URL（需含 http:// 或 https://）' });
    }
    const opts = {
      extensions: Array.isArray(extensions) ? extensions : [],
      wordlist: Array.isArray(wordlist) && wordlist.length ? wordlist : undefined,
      concurrency: Number.isInteger(concurrency) ? concurrency : 12
    };
    const data = await runDirScan(target.trim(), opts);
    res.json({ target, ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('==================================================');
  console.log('  扫描运行台已启动');
  console.log(`  控制台:  http://localhost:${PORT}`);
  console.log('  仅可用于你拥有或已获书面授权的目标！');
  console.log('==================================================');
});
