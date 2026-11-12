// 目录扫描引擎：基于字典的路径爆破（对标简化版 dirb / gobuster）
import http from 'http';
import https from 'https';
import { DEFAULT_WORDLIST } from './wordlists.js';

const REQUEST_TIMEOUT = 4000; // 单请求超时(ms)

// 命中的 HTTP 状态码（存在但可能无权访问，对渗透测试都有价值）
const FOUND_CODES = new Set([200, 201, 202, 203, 204, 301, 302, 303, 307, 308, 401, 403, 405, 500, 502]);

// 根据用户提供的词 + 选择的扩展名，生成待探测路径列表
export function buildWordlist(words, extensions) {
  const exts = (extensions || []).filter(Boolean).map((e) => (e.startsWith('.') ? e : '.' + e));
  const list = [];
  for (const raw of words) {
    const clean = String(raw).trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!clean) continue;
    list.push('/' + clean); // 原词：可能是目录也可能是无扩展名文件
    list.push('/' + clean + '/'); // 作为目录探测（可能返回列目录/跳转）
    for (const ext of exts) {
      list.push('/' + clean + ext); // 拼接扩展名：如 admin.php / login.aspx
    }
  }
  return Array.from(new Set(list));
}

// 探测单个路径
function probe(lib, url) {
  return new Promise((resolve) => {
    const req = lib.request(
      url,
      {
        method: 'GET',
        timeout: REQUEST_TIMEOUT,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (ScanConsole)', 'Connection': 'close' }
      },
      (res) => {
        const code = res.statusCode;
        res.resume(); // 不读取 body，直接丢弃，省流量
        resolve({ path: new URL(url).pathname, url, status: code, found: FOUND_CODES.has(code) });
      }
    );
    req.on('error', () => resolve({ path: new URL(url).pathname, url, status: 0, found: false, error: true }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ path: new URL(url).pathname, url, status: 0, found: false, timeout: true });
    });
    req.end();
  });
}

// 执行目录扫描
// opts: { extensions: string[], wordlist: string[], concurrency: number }
export async function runDirScan(target, opts = {}) {
  const base = String(target).trim().replace(/\/+$/, '');
  const words = opts.wordlist && opts.wordlist.length ? opts.wordlist : DEFAULT_WORDLIST;
  const paths = buildWordlist(words, opts.extensions);
  const secure = /^https:/i.test(base);
  const lib = secure ? https : http;

  // 校验 URL 合法性
  let host;
  try {
    const u = new URL(base);
    host = u.host;
  } catch (_) {
    throw new Error('目标 URL 不合法，请包含 http:// 或 https:// 前缀');
  }

  const all = [];
  const found = [];
  let idx = 0;
  const concurrency = Math.min(opts.concurrency || 12, paths.length) || 1;

  async function worker() {
    while (idx < paths.length) {
      const p = paths[idx++];
      const r = await probe(lib, base + p);
      all.push(r);
      if (r.found) found.push(r);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  // 命中结果按状态码排序，200 优先
  found.sort((a, b) => {
    const wa = a.status === 200 ? 0 : 1;
    const wb = b.status === 200 ? 0 : 1;
    return wa - wb || a.path.localeCompare(b.path);
  });

  return { scanned: paths.length, foundCount: found.length, found, all };
}
