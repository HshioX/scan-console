// SCAN//CONSOLE —— 前端控制台逻辑（黑客终端风）
'use strict';

/* 若直接用 file:// 打开，弹警告（扫描必须经 http 服务） */
if (location.protocol === 'file:') {
  const w = document.getElementById('fileWarn');
  if (w) w.classList.remove('hidden');
}

/* ============ 背景：矩阵雨 ============ */
(function matrixRain() {
  const canvas = document.getElementById('matrix');
  const ctx = canvas.getContext('2d');
  const fontSize = 14;
  let cols, drops;
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / fontSize);
    drops = new Array(cols).fill(1);
  }
  resize();
  window.addEventListener('resize', resize);
  function draw() {
    ctx.fillStyle = 'rgba(4, 7, 10, 0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff9c';
    ctx.font = fontSize + 'px monospace';
    for (let i = 0; i < cols; i++) {
      const ch = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
      ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ============ 视图切换 + 启动动画 ============ */
const views = {
  home: document.getElementById('home'),
  port: document.getElementById('port'),
  dir: document.getElementById('dir')
};
const backHome = document.getElementById('backHome');
const bootOverlay = document.getElementById('bootOverlay');

function typeInto(el, text, speed, done) {
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += text[i++] || '';
    if (i >= text.length) {
      clearInterval(timer);
      if (done) setTimeout(done, 350);
    }
  }, speed);
}

function showView(name) {
  if (name === 'home') {
    Object.values(views).forEach((v) => v.classList.add('hidden'));
    views.home.classList.remove('hidden');
    backHome.classList.add('hidden');
    window.scrollTo({ top: 0 });
    return;
  }
  const label = name === 'port' ? 'PORT_SCAN' : 'DIR_SCAN';
  bootOverlay.classList.remove('hidden');
  bootOverlay.textContent = '';
  typeInto(
    bootOverlay,
    `> INITIALIZING ${label} MODULE ...\n> MOUNTING PAYLOADS ........ OK\n> ESTABLISHING ENGINE ..... OK\n> ACCESS GRANTED. ENTERING ${label}.\n`,
    10,
    () => {
      Object.values(views).forEach((v) => v.classList.add('hidden'));
      views[name].classList.remove('hidden');
      backHome.classList.remove('hidden');
      bootOverlay.classList.add('hidden');
      window.scrollTo({ top: 0 });
    }
  );
}

document.querySelectorAll('.module[data-goto]').forEach((card) => {
  card.addEventListener('click', () => showView(card.dataset.goto));
});
backHome.addEventListener('click', () => showView('home'));

/* ============ 首页打字引导 ============ */
(function bootText() {
  const el = document.getElementById('bootText');
  typeInto(
    el,
    '[ SYSTEM ] scanner engine online\n[ AUTH    ] authorized-use mode enabled\n[ READY   ] select a module to begin_',
    14
  );
})();

/* ============ 端口预设 ============ */
const PRESET_PORTS = [
  { port: 21, on: true },
  { port: 22, on: true },
  { port: 80, on: true },
  { port: 443, on: true },
  { port: 3306, on: false },
  { port: 3389, on: false },
  { port: 8080, on: false },
  { port: 6379, on: false },
  { port: 9200, on: false },
  { port: 27017, on: false }
];
const portPresetsEl = document.getElementById('portPresets');
const portCustomEl = document.getElementById('portCustom');
const portCountEl = document.getElementById('portCount');

PRESET_PORTS.forEach((p) => {
  const chip = document.createElement('span');
  chip.className = 'chip' + (p.on ? ' active' : '');
  chip.textContent = p.port;
  chip.addEventListener('click', () => {
    p.on = !p.on;
    chip.classList.toggle('active', p.on);
    updatePortCount();
  });
  portPresetsEl.appendChild(chip);
});

function parseCustomPorts(str) {
  const out = [];
  (str || '').split(/[,\s]+/).forEach((tok) => {
    tok = tok.trim();
    if (!tok) return;
    if (tok.includes('-')) {
      const [a, b] = tok.split('-').map((x) => parseInt(x, 10));
      if (Number.isInteger(a) && Number.isInteger(b) && a <= b) {
        for (let i = a; i <= b && i <= 65535; i++) out.push(i);
      }
    } else {
      const n = parseInt(tok, 10);
      if (Number.isInteger(n)) out.push(n);
    }
  });
  return out.filter((n) => n >= 1 && n <= 65535);
}

function resolvePorts() {
  const set = new Set();
  PRESET_PORTS.forEach((p) => { if (p.on) set.add(p.port); });
  parseCustomPorts(portCustomEl.value).forEach((n) => set.add(n));
  return Array.from(set).sort((a, b) => a - b);
}

function updatePortCount() { portCountEl.textContent = resolvePorts().length; }
portCustomEl.addEventListener('input', updatePortCount);
updatePortCount();

/* ============ 目录扩展名 ============ */
const dirExtsEl = document.getElementById('dirExts');
const dirWordlistEl = document.getElementById('dirWordlist');
const dirCountEl = document.getElementById('dirCount');
let META = { extensions: [], defaultWordlist: [] };
const extState = {};

async function loadMeta() {
  try {
    const res = await fetch('/api/meta');
    META = await res.json();
  } catch (_) {
    META = {
      extensions: [
        { value: 'asp', label: 'ASP' }, { value: 'aspx', label: 'ASPX' },
        { value: 'jsp', label: 'JSP' }, { value: 'php', label: 'PHP' }
      ],
      defaultWordlist: []
    };
  }
  const defaultOn = new Set(['asp', 'aspx', 'jsp', 'php']);
  META.extensions.forEach((e) => {
    extState[e.value] = defaultOn.has(e.value);
    const chip = document.createElement('span');
    chip.className = 'chip' + (extState[e.value] ? ' active' : '');
    chip.textContent = e.label;
    chip.addEventListener('click', () => {
      extState[e.value] = !extState[e.value];
      chip.classList.toggle('active', extState[e.value]);
      updateDirCount();
    });
    dirExtsEl.appendChild(chip);
  });
  updateDirCount();
}

function getSelectedExts() {
  return META.extensions.filter((e) => extState[e.value]).map((e) => e.value);
}
function getWordCount() {
  const custom = dirWordlistEl.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return custom.length ? custom.length : (META.defaultWordlist ? META.defaultWordlist.length : 0);
}
function updateDirCount() {
  const words = getWordCount();
  const exts = getSelectedExts().length;
  dirCountEl.textContent = words * (2 + exts);
}
dirWordlistEl.addEventListener('input', updateDirCount);

/* ============ 工具 ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function appendLine(container, cls, text) {
  const span = document.createElement('span');
  span.className = 'ln ' + (cls || '');
  span.textContent = text;
  container.appendChild(span);
}

/* ============ 端口扫描 ============ */
const portScanBtn = document.getElementById('portScanBtn');
const portStatus = document.getElementById('portStatus');
const portOutput = document.getElementById('portOutput');

portScanBtn.addEventListener('click', async () => {
  const target = document.getElementById('portTarget').value.trim();
  const ports = resolvePorts();
  if (!target) { portStatus.textContent = '⚠ 请先输入目标 (target>)'; return; }
  if (ports.length === 0) { portStatus.textContent = '⚠ 没有可扫描的端口'; return; }

  portScanBtn.disabled = true;
  portOutput.classList.add('hidden');
  portOutput.innerHTML = '';
  portStatus.innerHTML = '<span class="spin"></span>EXECUTING PORT SCAN ON ' + escapeHtml(target) + ' [' + ports.length + ' ports] ...';

  try {
    const res = await fetch('/api/portscan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, ports })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'scan failed');

    portOutput.classList.remove('hidden');
    appendLine(portOutput, 'head', '── PORT SCAN REPORT ── target: ' + data.target);
    data.results.forEach((r) => {
      const cls = r.status === 'open' ? 'open' : r.status === 'closed' ? 'closed' : r.status === 'filtered' ? 'filtered' : 'err';
      const line = `[${String(r.port).padEnd(5)}] ${r.status.toUpperCase().padEnd(9)} svc:${String(r.service || '-').padEnd(8)} ${r.banner || '-'}`;
      appendLine(portOutput, cls, line);
    });
    const open = data.results.filter((r) => r.status === 'open');
    appendLine(portOutput, 'summary', `>> TOTAL ${data.total} | OPEN ${open.length} | CLOSED/FILTERED ${data.total - open.length}`);
    portStatus.innerHTML = '<span class="ok">✓ DONE.</span> 开放 ' + open.length + ' / 共 ' + data.total + ' 个端口。';
  } catch (e) {
    portStatus.innerHTML = '<span style="color:var(--red)">✗ ' + escapeHtml(e.message) + '</span>';
  } finally {
    portScanBtn.disabled = false;
  }
});

/* ============ 目录扫描 ============ */
const dirScanBtn = document.getElementById('dirScanBtn');
const dirStatus = document.getElementById('dirStatus');
const dirOutput = document.getElementById('dirOutput');

dirScanBtn.addEventListener('click', async () => {
  const target = document.getElementById('dirTarget').value.trim();
  if (!target) { dirStatus.textContent = '⚠ 请先输入目标 URL (target>)'; return; }

  const custom = dirWordlistEl.value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const payload = {
    target,
    extensions: getSelectedExts(),
    wordlist: custom.length ? custom : undefined,
    concurrency: 12
  };

  dirScanBtn.disabled = true;
  dirOutput.classList.add('hidden');
  dirOutput.innerHTML = '';
  dirStatus.innerHTML = '<span class="spin"></span>BRUTE-FORCING DIRECTORIES ON ' + escapeHtml(target) + ' ...';

  try {
    const res = await fetch('/api/dirscan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'scan failed');

    dirOutput.classList.remove('hidden');
    appendLine(dirOutput, 'head', '── DIRECTORY SCAN REPORT ── target: ' + data.target);
    if (data.found.length > 0) {
      data.found.forEach((r) => {
        appendLine(dirOutput, 'found', `[${r.status}] ${r.path}  >>  ${r.url}`);
      });
    } else {
      appendLine(dirOutput, 'miss', '(no accessible path found — try more extensions or a custom wordlist)');
    }
    appendLine(dirOutput, 'summary', `>> PROBED ${data.scanned} paths | HITS ${data.foundCount}`);
    dirStatus.innerHTML = '<span class="ok">✓ DONE.</span> 探测 ' + data.scanned + ' 条，命中 ' + data.foundCount + ' 条。';
  } catch (e) {
    dirStatus.innerHTML = '<span style="color:var(--red)">✗ ' + escapeHtml(e.message) + '</span>';
  } finally {
    dirScanBtn.disabled = false;
  }
});

loadMeta();
