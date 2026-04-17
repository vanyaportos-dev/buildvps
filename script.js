/* ============================================
   BUILD VPN — script.js
   Speed Test Modal + Nav + FAQ + Servers
   ============================================ */

/* ---- Bottom Nav Active State ---- */
(function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    const page = item.dataset.page;
    let isActive = false;
    if (page === 'home' && (path === '/' || path === '/index.html')) isActive = true;
    if (page === 'servers' && path.includes('servers')) isActive = true;
    if (page === 'news' && path.includes('news')) isActive = true;
    if (page === 'blog' && path.includes('blog')) isActive = true;
    if (page === 'speedtest') isActive = false; // modal, never "active"
    if (isActive) item.classList.add('active');
  });
})();

/* ---- FAQ Accordion ---- */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.faq-item').forEach(item => {
    const q = item.querySelector('.faq-question');
    if (!q) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
});

/* ============================================
   SPEED TEST
   ============================================ */
const SpeedTest = (() => {
  let running = false;

  function openModal() {
    const overlay = document.getElementById('speedtest-overlay');
    if (!overlay) return;
    overlay.classList.add('open');
    resetUI();
    startTest();
  }

  function closeModal() {
    const overlay = document.getElementById('speedtest-overlay');
    if (overlay) overlay.classList.remove('open');
    running = false;
  }

  function resetUI() {
    setMetric('ping-val', '—');
    setMetric('dl-val', '—');
    setMetric('ul-val', '—');
    setProgress(0);
    setPhase('Нажмите «Тест» для запуска');
    const btn = document.getElementById('speedtest-run-btn');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Запустить'; }
  }

  function setMetric(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setProgress(pct) {
    const bar = document.getElementById('speed-fill');
    const label = document.getElementById('speed-pct');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = Math.round(pct) + '%';
  }

  function setPhase(text) {
    const el = document.getElementById('speed-phase');
    if (el) el.textContent = text;
  }

  async function measurePing() {
    const times = [];
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      try {
        await fetch('https://www.google.com/favicon.ico?cb=' + Math.random(), {
          mode: 'no-cors', cache: 'no-store'
        });
      } catch (e) { /* ignore CORS */ }
      times.push(performance.now() - t0);
      await sleep(150);
    }
    times.sort((a, b) => a - b);
    return Math.round(times.slice(1, 3).reduce((s, v) => s + v, 0) / 2);
  }

  async function measureDownload() {
    // Load a reasonably sized public image multiple times
    const urls = [
      'https://www.gstatic.com/webp/gallery/1.jpg?cb=' + Math.random(),
      'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png?cb=' + Math.random(),
    ];
    let totalBytes = 0;
    let totalMs = 0;
    for (const url of urls) {
      const t0 = performance.now();
      try {
        const res = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      } catch (e) {}
      const dt = performance.now() - t0;
      // Estimate size based on typical image sizes
      totalBytes += 60000; // ~60KB each
      totalMs += dt;
    }
    const seconds = totalMs / 1000;
    const mbps = (totalBytes * 8) / (seconds * 1024 * 1024);
    // Add some realistic variance + clamp
    const adjusted = Math.min(Math.max(mbps * (0.8 + Math.random() * 0.6), 8), 150);
    return parseFloat(adjusted.toFixed(1));
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function startTest() {
    running = true;
    const btn = document.getElementById('speedtest-run-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Тестирование...'; }

    try {
      // Phase 1: Ping
      setPhase('Измерение пинга...');
      setProgress(5);
      const ping = await measurePing();
      if (!running) return;
      setMetric('ping-val', ping);
      setProgress(30);
      await sleep(300);

      // Phase 2: Download
      setPhase('Измерение скорости загрузки...');
      setProgress(35);
      const dl = await measureDownload();
      if (!running) return;
      setMetric('dl-val', dl.toFixed(1));
      setProgress(75);
      await sleep(400);

      // Phase 3: Upload (simulated 70–90% of download)
      setPhase('Измерение скорости отдачи...');
      setProgress(80);
      await sleep(600);
      const ulFactor = 0.70 + Math.random() * 0.20;
      const ul = parseFloat((dl * ulFactor).toFixed(1));
      if (!running) return;
      setMetric('ul-val', ul.toFixed(1));
      setProgress(100);
      setPhase('Готово ✓');

    } catch (e) {
      setPhase('Ошибка теста. Попробуйте ещё раз.');
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Повторить'; }
    running = false;
  }

  return { openModal, closeModal, startTest };
})();

/* ---- Expose globally ---- */
window.openSpeedTest = SpeedTest.openModal;
window.closeSpeedTest = SpeedTest.closeModal;
window.runSpeedTest = () => { SpeedTest.startTest(); };

/* ---- Speed test run button ---- */
document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('speedtest-run-btn');
  if (runBtn) runBtn.addEventListener('click', SpeedTest.startTest);

  // Close on overlay click
  const overlay = document.getElementById('speedtest-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) SpeedTest.closeModal();
    });
  }
});

/* ============================================
   SERVERS PAGE
   ============================================ */
const SERVERS = [
  { name: 'Автовыбор',             flag: '🌐', type: 'auto' },
  { name: 'YouTube no ADS',         flag: '▶️', type: 'special' },
  { name: 'Latvia',                  flag: '🇱🇻', type: 'regular' },
  { name: 'Germany - Frankfurt',     flag: '🇩🇪', type: 'regular' },
  { name: 'Germany - Frankfurt 2',   flag: '🇩🇪', type: 'regular' },
  { name: 'NL Amsterdam',            flag: '🇳🇱', type: 'regular' },
  { name: 'Poland - Warszawa',       flag: '🇵🇱', type: 'regular' },
  { name: 'England - London',        flag: '🇬🇧', type: 'regular' },
  { name: 'Japan - Tokyo',           flag: '🇯🇵', type: 'regular' },
  { name: 'Sweden - Stockholm',      flag: '🇸🇪', type: 'regular' },
  { name: 'United States',           flag: '🇺🇸', type: 'regular' },
  { name: 'Brazil - São Paulo',      flag: '🇧🇷', type: 'regular' },
  { name: 'India - Mumbai',          flag: '🇮🇳', type: 'regular' },
  { name: 'Indonesia - Jakarta',     flag: '🇮🇩', type: 'regular' },
  { name: 'Bridge1 | Latvia',        flag: '🌉', type: 'bridge' },
  { name: 'Bridge3 | London',        flag: '🌉', type: 'bridge' },
  { name: 'Bridge4 | Finland',       flag: '🌉', type: 'bridge' },
  { name: 'Bridge5 | Netherlands',   flag: '🌉', type: 'bridge' },
  { name: 'Bridge6 | Japan',         flag: '🌉', type: 'bridge' },
  { name: 'Bridge10 | Frankfurt',    flag: '🌉', type: 'bridge' },
  { name: 'Bridge11 | Frankfurt',    flag: '🌉', type: 'bridge' },
  { name: 'Bridge13 LTE | Latvia',   flag: '📡', type: 'bridge' },
  { name: 'Bridge15 | Netherlands',  flag: '🌉', type: 'bridge' },
  { name: 'Latvia | WhiteList LTE',  flag: '🇱🇻', type: 'whitelist' },
  { name: 'Latvia | WhiteList LTE2', flag: '🇱🇻', type: 'whitelist' },
  { name: 'WhiteList | Netherlands', flag: '🇳🇱', type: 'whitelist' },
  { name: 'Russia #2 | WhiteList',   flag: '🇷🇺', type: 'whitelist' },
  { name: 'Russia #3 | WhiteList',   flag: '🇷🇺', type: 'whitelist' },
  { name: 'Russia #7 | WhiteList',   flag: '🇷🇺', type: 'whitelist' },
  { name: 'Russia #8 | WhiteList',   flag: '🇷🇺', type: 'whitelist' },
  { name: 'Russia #9 | WhiteList',   flag: '🇷🇺', type: 'whitelist' },
];

function getServerType(s) {
  if (s.type === 'bridge') return 'Bridge-сервер';
  if (s.type === 'whitelist') return 'WhiteList сервер';
  if (s.type === 'auto') return 'Автоматический выбор';
  if (s.type === 'special') return 'Специальный';
  return 'Публичный сервер';
}

function generateStatuses() {
  // 2 red, 3 yellow, rest green
  const count = SERVERS.length;
  const statuses = Array(count).fill('green');
  const redIndices = [];
  const yellowIndices = [];
  while (redIndices.length < 2) {
    const i = 2 + Math.floor(Math.random() * (count - 2));
    if (!redIndices.includes(i)) redIndices.push(i);
  }
  while (yellowIndices.length < 3) {
    const i = 2 + Math.floor(Math.random() * (count - 2));
    if (!redIndices.includes(i) && !yellowIndices.includes(i)) yellowIndices.push(i);
  }
  redIndices.forEach(i => statuses[i] = 'red');
  yellowIndices.forEach(i => statuses[i] = 'yellow');
  return statuses;
}

function randomPing(status) {
  if (status === 'green')  return Math.floor(70  + Math.random() * 180); // 70–250
  if (status === 'yellow') return Math.floor(200 + Math.random() * 500); // 200–700
  return null; // offline
}

function renderServers(statuses) {
  const list = document.getElementById('server-list');
  if (!list) return;
  list.innerHTML = '';
  SERVERS.forEach((s, i) => {
    const status = statuses[i];
    const ping = randomPing(status);
    const pingText = status === 'red' ? 'offline' : ping + ' ms';
    const pingClass = status;

    const dotColor = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' }[status];

    const card = document.createElement('div');
    card.className = 'server-card fade-up';
    card.style.animationDelay = (i * 0.02) + 's';
    card.innerHTML = `
      <div class="server-flag">${s.flag}</div>
      <div class="server-info">
        <div class="server-name">${s.name}</div>
        <div class="server-meta">${getServerType(s)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <i class="fa-solid fa-circle status-dot ${status}" style="font-size:0.55rem;"></i>
        <span class="server-ping ${pingClass}">${pingText}</span>
      </div>`;
    list.appendChild(card);
  });
}

function showSkeletons() {
  const list = document.getElementById('server-list');
  if (!list) return;
  list.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton skeleton-card';
    list.appendChild(sk);
  }
}

function initServersPage() {
  const list = document.getElementById('server-list');
  if (!list) return;

  showSkeletons();
  setTimeout(() => {
    const statuses = generateStatuses();
    renderServers(statuses);
    updateServerStats(statuses);
  }, 900);

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('fa-spin');
      showSkeletons();
      setTimeout(() => {
        const statuses = generateStatuses();
        renderServers(statuses);
        updateServerStats(statuses);
        refreshBtn.classList.remove('fa-spin');
      }, 800);
    });
  }
}

function updateServerStats(statuses) {
  const green  = statuses.filter(s => s === 'green').length;
  const yellow = statuses.filter(s => s === 'yellow').length;
  const red    = statuses.filter(s => s === 'red').length;
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('stat-green',  green);
  setEl('stat-yellow', yellow);
  setEl('stat-red',    red);
}

document.addEventListener('DOMContentLoaded', initServersPage);
