// 端口扫描引擎：TCP 连接扫描 + 轻量服务/横幅识别
// 对标简化版 nmap 的 connect() 扫描（不需要 root 权限）
import net from 'net';
import http from 'http';
import https from 'https';

const CONNECT_TIMEOUT = 2500; // 单个端口连接超时(ms)
const PROBE_TIMEOUT = 2000; // 服务探测超时(ms)

// 常见端口 -> 服务名（nmap 风格）
const SERVICE_NAMES = {
  21: 'ftp',
  22: 'ssh',
  23: 'telnet',
  25: 'smtp',
  53: 'domain',
  80: 'http',
  110: 'pop3',
  135: 'msrpc',
  139: 'netbios-ssn',
  143: 'imap',
  443: 'https',
  445: 'microsoft-ds',
  587: 'submission',
  3306: 'mysql',
  3389: 'ms-wbt-server',
  5432: 'postgresql',
  6379: 'redis',
  8080: 'http-proxy',
  8443: 'https-alt',
  9000: 'cslistener',
  9200: 'elasticsearch',
  27017: 'mongodb'
};

// 建立一次 TCP 连接，判断端口是否可连
function connectTCP(target, port) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: target, port, timeout: CONNECT_TIMEOUT });
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (_) {}
      resolve(r);
    };
    sock.once('connect', () => finish({ ok: true, socket: sock }));
    sock.once('timeout', () => finish({ ok: false, status: 'filtered' }));
    sock.once('error', (err) => {
      if (err && err.code === 'ECONNREFUSED') finish({ ok: false, status: 'closed' });
      else finish({ ok: false, status: 'filtered' });
    });
  });
}

// 通用横幅抓取：监听对端主动发来的数据（FTP/SSH 等会先发 banner）
function bannerProbe(socket, ms = 1000) {
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => {
      socket.removeAllListeners('data');
      resolve(data);
    }, ms);
    socket.on('data', (chunk) => {
      data += chunk.toString('utf8', 0, 400);
      if (data.length > 300) {
        clearTimeout(timer);
        socket.removeAllListeners('data');
        resolve(data);
      }
    });
  });
}

// HTTP/HTTPS 探测：发一个 GET，读取状态行与 Server 头
function httpProbe(target, port, secure) {
  return new Promise((resolve) => {
    const lib = secure ? https : http;
    const req = lib.request(
      {
        host: target,
        port,
        path: '/',
        method: 'GET',
        timeout: PROBE_TIMEOUT,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (ScanConsole)', 'Connection': 'close' }
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const server = res.headers['server'] || 'n/a';
          resolve(`HTTP ${res.statusCode} | Server: ${server}`);
        });
      }
    );
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
}

// 根据横幅猜测未知端口的服务
function guessService(banner) {
  const b = (banner || '').toLowerCase();
  if (b.includes('ssh')) return 'ssh';
  if (b.includes('ftp')) return 'ftp';
  if (b.includes('smtp')) return 'smtp';
  if (b.includes('http')) return 'http';
  if (b.includes('mysql')) return 'mysql';
  if (b.includes('redis')) return 'redis';
  return 'unknown';
}

// 扫描单个端口
async function scanPort(target, port) {
  const base = { port, status: '', service: SERVICE_NAMES[port] || 'unknown', banner: '' };
  const conn = await connectTCP(target, port);
  if (!conn.ok) {
    base.status = conn.status; // closed / filtered
    return base;
  }
  // 端口开放，尝试识别服务
  let banner = '';
  try {
    if (port === 80 || port === 8080) {
      banner = await httpProbe(target, port, false);
    } else if (port === 443 || port === 8443) {
      banner = await httpProbe(target, port, true);
    } else {
      banner = await bannerProbe(conn.socket);
    }
  } catch (_) {
    banner = '';
  }
  // 若仍未识别且非 HTTPS 端口，再尝试一次 HTTP 探测（捕捉 3000/8000 等非标准 Web 端口）
  if ((!base.service || base.service === 'unknown') && port !== 443 && port !== 8443) {
    try {
      const httpBanner = await httpProbe(target, port, false);
      if (httpBanner && httpBanner.startsWith('HTTP')) {
        banner = httpBanner;
      }
    } catch (_) {}
  }
  try { conn.socket.destroy(); } catch (_) {}
  base.status = 'open';
  if (!base.service || base.service === 'unknown') {
    base.service = guessService(banner) || 'unknown';
  }
  base.banner = (banner || '').replace(/\r?\n/g, ' ').slice(0, 120);
  return base;
}

// 并发扫描一组端口（带并发上限）
export async function runPortScan(target, ports, concurrency = 50) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < ports.length) {
      const p = ports[idx++];
      try {
        const r = await scanPort(target, p);
        results.push(r);
      } catch (e) {
        results.push({ port: p, status: 'error', service: 'unknown', banner: e.message });
      }
    }
  }
  const n = Math.min(concurrency, ports.length) || 1;
  await Promise.all(Array.from({ length: n }, worker));
  results.sort((a, b) => a.port - b.port);
  return results;
}
