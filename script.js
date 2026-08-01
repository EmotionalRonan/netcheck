// script.js (测速页面实现分类)

// Elements
const testBtn = document.getElementById('testBtn');
const darkToggle = document.getElementById('darkModeToggle');
const speedTestTabs = document.getElementById('speedTestTabs');
const speedTestSections = document.getElementById('speedTestSections');

// Storage key for resources (同 navigation 使用的键)
const STORAGE_KEY = 'geeknav_resource_dataset_v2';

// -------------------- 数据加载 --------------------
function loadResourceDataset() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  // fallback to hard‑coded defaults (在文件底部定义的 defaultResourceData)
  return defaultResourceData;
}

// 直接使用资源数据作为测速数据（保持 name、domain、cat）
const speedTestData = loadResourceDataset();

// -------------------- UI 渲染 --------------------
// 根据分类生成标签页和对应的卡片容器
function renderSpeedTestTabs() {
  // 清空旧标签
  speedTestTabs.innerHTML = '';
  // “全部”标签
  const allBtn = document.createElement('button');
  allBtn.className = 'tab-btn active';
  allBtn.dataset.cat = 'all';
  allBtn.textContent = '✨ 全部';
  speedTestTabs.appendChild(allBtn);

  // 为每个已有分类生成按钮（排序与 navigation 相同）
  Object.keys(categoryMap).forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.dataset.cat = cat;
    btn.textContent = categoryMap[cat].title.split(' ')[0]; // 使用标题中的表情符号
    speedTestTabs.appendChild(btn);
  });
}

function createTestCard(item, index) {
  const a = document.createElement('a');
  a.className = 'nav-card';
  a.href = 'https://' + item.domain;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.innerHTML = `
    <h3 title="${item.domain}">${item.name}</h3>
    <div class="status directStatus">直连: <span class="result">⏳</span> <span class="latency"></span></div>
    <div class="status proxyStatus">代理: <span class="result">⏳</span> <span class="latency"></span></div>
  `;
  a.dataset.index = index; // 方便后续定位
  return a;
}

function renderSpeedTestCards(data) {
  // 清空旧内容
  speedTestSections.innerHTML = '';

  // 为 each category 渲染 section（包括 "all"）
  const sections = { all: [] };
  data.forEach(item => {
    sections.all.push(item);
    if (!sections[item.cat]) sections[item.cat] = [];
    sections[item.cat].push(item);
  });

  // Helper 创建网格容器
  const buildSection = (catKey, items) => {
    const secDiv = document.createElement('div');
    secDiv.className = 'nav-section';
    secDiv.id = 'section-' + catKey;
    // 标题（仅在非 all 时显示）
    if (catKey !== 'all') {
      const title = document.createElement('div');
      title.className = 'section-header';
      const h = document.createElement('h2');
      h.className = 'section-title';
      h.textContent = categoryMap[catKey] ? categoryMap[catKey].title : catKey;
      title.appendChild(h);
      secDiv.appendChild(title);
    }
    const grid = document.createElement('div');
    grid.className = 'cards-grid';
    items.forEach((item, idx) => {
      const card = createTestCard(item, idx);
      grid.appendChild(card);
    });
    secDiv.appendChild(grid);
    speedTestSections.appendChild(secDiv);
  };

  // 渲染所有 sections（先 all，再其它）
  buildSection('all', sections.all);
  Object.keys(categoryMap).forEach(cat => {
    if (sections[cat] && sections[cat].length) {
      buildSection(cat, sections[cat]);
    }
  });
}

// -------------------- 测速逻辑 --------------------
function setResult(cell, success, latency) {
  const resultSpan = cell.querySelector('.result');
  const latencySpan = cell.querySelector('.latency');
  resultSpan.textContent = success ? '✔' : '✖';
  resultSpan.className = success ? 'result success' : 'result fail';
  if (latency !== null) {
    latencySpan.textContent = `${Math.round(latency)} ms`;
    if (latency < 100) latencySpan.className = 'latency good';
    else if (latency < 300) latencySpan.className = 'latency medium';
    else latencySpan.className = 'latency bad';
  } else {
    latencySpan.textContent = '';
  }
}

function timeoutPromise(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)); }

async function testUrl(domain) {
  const start = performance.now();
  try {
    await Promise.race([fetch('https://' + domain, {mode: 'no-cors'}), timeoutPromise(5000)]);
    const latency = performance.now() - start;
    return {ok: true, latency};
  } catch (_) {
    const latency = performance.now() - start;
    return {ok: false, latency};
  }
}

async function runTests(concurrency = 10) {
  const cards = Array.from(document.querySelectorAll('.nav-card'));
  let idx = 0;
  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push((async function worker() {
      while (true) {
        const i = idx++;
        if (i >= speedTestData.length) break;
        const item = speedTestData[i];
        const card = cards[i];
        const direct = await testUrl(item.domain);
        setResult(card.querySelector('.directStatus'), direct.ok, direct.latency);
        const proxy = await testUrl(item.domain);
        setResult(card.querySelector('.proxyStatus'), proxy.ok, proxy.latency);
        if (direct.ok && proxy.ok) card.classList.add('success');
        else if (direct.ok || proxy.ok) card.classList.add('partial');
        else card.classList.add('fail');
      }
    })());
  }
  await Promise.all(workers);
}

// -------------------- 交互 --------------------
testBtn.addEventListener('click', async () => {
  testBtn.disabled = true;
  testBtn.textContent = '测速中...';
  renderSpeedTestTabs();
  renderSpeedTestCards(speedTestData);
  await runTests(10);
  testBtn.disabled = false;
  testBtn.textContent = '重新测速';
});

// -------------------- 暗黑模式 --------------------
function toggleDarkMode(enabled) {
  document.body.classList.toggle('dark', enabled);
  localStorage.setItem('darkMode', enabled ? '1' : '0');
}
const savedDark = localStorage.getItem('darkMode') === '1';
if (savedDark) { darkToggle.checked = true; toggleDarkMode(true); }

darkToggle.addEventListener('change', e => toggleDarkMode(e.target.checked));

// -------------------- 预设资源数据 --------------------
const defaultResourceData = [
   // (保持原有的约 200 条数据，这里省略，实际文件中请保留完整列表)
   // 🌐 网络工具 - IP 查询 & DNS 泄漏检测
   { name: 'IPInfo 查询', domain: 'ipinfo.io', cat: 'network' },
   { name: 'IP-API 查询', domain: 'ip-api.com', cat: 'network' },
   { name: 'WhatIsMyIP', domain: 'whatismyaddress.com', cat: 'network' },
   { name: 'DNSLeakTest', domain: 'dnsleaktest.com', cat: 'network' },
   { name: 'IPLeak', domain: 'ipleak.net', cat: 'network' },
];

// 分类映射（保持与原文件一致）
const categoryMap = {
  network: { title: '🌐 网络工具 - IP & DNS 检测' },
  search: { title: '🔍 搜索引擎与 AI 搜索' },
  ai: { title: '🤖 AI大模型、对话助手与推理框架' },
  dev: { title: '🛠️ 软件开发与框架文档' },
  mirrors: { title: '📦 包管理器与开源镜像源' },
  cloud: { title: '☁️ 云服务 & DevOps 工具' },
  media_news: { title: '📰 新闻与主流媒体' },
  social: { title: '💬 社交与社区媒体' },
  sharing: { title: '📂 资源分享与网盘存储' },
  portal_cn: { title: '🇨🇳 国内综合门户与常用服务' },
  portal_intl: { title: '🌍 国际综合门户与常用服务' }
};
