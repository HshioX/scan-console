# 扫描台 · Scan Console

一个黑客终端风格的 Web 扫描运行台。前端控制台 + Node.js 后端扫描引擎，提供两类扫描模块：

- **端口扫描（PORT SCAN）**：简化版 nmap 的 TCP connect 扫描。默认扫描 `443 / 80 / 21 / 22`，可手动增删或自定义端口范围（如 `80,443,21-25,3306`），并识别开放端口的服务/横幅。
- **目录扫描（DIR SCAN）**：简化版 dirb / gobuster。按 `ASP / ASPX / JSP / PHP` 等扩展名生成字典，拼接探测路径后对目标进行命中探测。

纯前端无法做真实扫描（受浏览器同源策略与无原始 socket 限制），因此"扫描"动作由后端引擎执行，前端只做控制台与结果展示。

## ⚠️ 合规声明

本项目**仅可用于你拥有或已获书面授权的目标**。未经授权对他人资产进行端口/目录扫描可能违反《网络安全法》及服务条款，后果自负。使用时请遵守当地法律法规。

## 技术栈

- 后端：Node.js + Express
- 前端：原生 HTML / CSS / JS（无构建步骤）
- 扫描：`net` 模块做 TCP 连接探测；`http` 请求做目录爆破

## 运行

需要 Node.js（建议 LTS，>= 18）。

```bash
cd scan-console
npm install      # 安装依赖（express）
npm start        # 启动服务
```

启动后浏览器打开：<http://localhost:3000>

> 注意：必须通过 `http://localhost:3000` 访问，不要直接双击 `index.html`。
> 直接以 `file://` 打开只能看到界面样式，**无法扫描**（扫描接口由后端提供）。

## 在虚拟机中使用

1. 在虚拟机里安装 Node.js（https://nodejs.org ，LTS 版）。
2. 把整个 `scan-console` 文件夹拷进虚拟机（含 `node_modules` 可省去 `npm install`）。
3. 虚拟机终端 `cd scan-console && npm start`，浏览器开 `http://localhost:3000`。

## 目录结构

```
scan-console/
├── server.js              # Express：托管前端 + 提供 /api/portscan、/api/dirscan、/api/meta
├── lib/
│   ├── portscan.js        # TCP 端口扫描 + 服务/横幅识别
│   ├── dirscan.js         # 目录字典爆破 + 命中判定
│   └── wordlists.js       # 默认字典 + 扩展名选项
└── public/
    ├── index.html         # 控制台首页（双入口）+ 两个独立终端界面
    ├── css/style.css      # 黑客终端风格样式
    └── js/app.js          # 视图切换、matrix 背景、扫描请求与结果渲染
```

## API 简介

- `POST /api/portscan`
  ```json
  { "target": "127.0.0.1", "ports": [443, 80, 21, 22] }
  ```
- `POST /api/dirscan`
  ```json
  { "target": "http://127.0.0.1:3000", "extensions": ["php"], "wordlist": ["admin", "login"] }
  ```
- `GET /api/meta`：返回默认端口、扩展名选项与默认字典。

## 已知局限

- 端口扫描为 TCP connect 方式（无需 root，但比 SYN 扫描慢、更易被记录）。
- 目录扫描为单轮字典探测，暂不支持递归、响应大小过滤、实时进度流。
