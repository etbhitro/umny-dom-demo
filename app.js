// Панель «Дом»: одна страница для планшета на стене и телефона.
// Состояние приходит по WebSocket от хаба, команды уходят REST-запросами.
//
// Управление — как пульт, минимум текста:
//   касание плитки      — включить / выключить (шторы — открыть / закрыть, замок — открыть по PIN);
//   свайп по плитке ⟷   — яркость, положение штор, температура;
//   долгое нажатие      — редкие настройки (цвет ленты, режим кондиционера, камера на весь экран).
// Датчики молчат, пока всё в порядке, и появляются в комнате только с проблемой.

const $ = (id) => document.getElementById(id);

const ICONS = {
  light: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
  thermostat: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  ac: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11"/><path d="M9 3l3 2 3-2M9 21l3-2 3 2"/>',
  curtain: '<path d="M3 3h18M5 3v18M19 3v18M5 3c0 8 3 12 5 18M19 3c0 8-3 12-5 18"/>',
  gate: '<path d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M7 15h10M7 18h10"/>',
  contact: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>',
  motion: '<circle cx="13" cy="4" r="2"/><path d="M8 21l3-6 3 2v4M7 12l3-4 4 1 3 4M11 15l-1-5"/>',
  leak: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  smoke: '<path d="M4 14h16M6 18h12M8 10c0-2 2-2 2-4M12 10c0-2 2-2 2-4M16 10c0-2 2-2 2-4"/>',
  siren: '<path d="M7 18v-6a5 5 0 0 1 10 0v6M5 21h14M12 3v2M4 7l1.5 1M20 7l-1.5 1"/>',
  leave: '<path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  home: '<path d="M3 11l9-7 9 7v10H3zM9 21v-6h6v6"/>',
  night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  morning: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v4M12 17.5h.01"/>',
  led: '<path d="M3 17c3-1 4-5 9-5s6 4 9 5"/><circle cx="6" cy="9" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="18" cy="9" r="1"/>',
  switch: '<path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  valve: '<path d="M4 14h16M4 10h16M12 10V5M8 5h8"/><path d="M4 9v6M20 9v6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  camera: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  doorbell: '<rect x="7" y="3" width="10" height="18" rx="3"/><circle cx="12" cy="9" r="2"/><circle cx="12" cy="16" r="1.5"/>',
  gas: '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M6 10v4"/>',
  offline: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.3a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/>',
  journal: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  phones: '<rect x="3" y="4" width="9" height="16" rx="2"/><rect x="14" y="7" width="7" height="13" rx="2"/>',
  install: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  exit: '<path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M10 17l-5-5 5-5M5 12h12"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
};
const icon = (name, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const deg = (v) => (v == null ? '—' : `${String(Math.round(v * 2) / 2).replace('.', ',')}°`);
const buzz = () => navigator.vibrate?.(8);

const S = {
  house: { name: 'Дом', rooms: [] },
  devices: new Map(),
  security: { status: 'disarmed' },
  alerts: [],
  scenes: [],
  log: [],
  clockSkew: 0, // сервер - клиент, чтобы отсчёты совпадали с хабом
};

// ---------- связь с хабом ----------

let ws;
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => ($('conn').hidden = true);
  ws.onclose = () => {
    $('conn').hidden = false;
    setTimeout(connect, 2000);
  };
  ws.onmessage = (e) => {
    const { type, data } = JSON.parse(e.data);
    if (type === 'snapshot') {
      S.house = data.house;
      S.devices = new Map(data.devices.map((d) => [d.id, d]));
      S.security = data.security;
      S.alerts = data.alerts;
      S.scenes = data.scenes;
      S.log = data.log;
      S.clockSkew = data.now - Date.now();
      renderAll();
      refreshFrames();
      runSceneFromUrl();
    } else if (type === 'device') {
      S.devices.set(data.id, data);
      scheduleRooms();
    } else if (type === 'security') {
      S.security = data;
      renderGuard();
    } else if (type === 'alerts') {
      S.alerts = data;
      renderAlerts();
    } else if (type === 'log') {
      S.log.unshift(data);
      S.log.length = Math.min(S.log.length, 200);
    }
  };
}

async function api(path, body, method = 'POST') {
  const res = await fetch(`/api${path}`, method === 'GET' ? {} : {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error ?? `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const command = (id, cmd) => api(`/devices/${id}`, cmd).catch((e) => toast(e.message));

// ---------- отрисовка ----------

function renderAll() {
  document.title = S.house.name;
  $('home-name').textContent = S.house.name;
  renderScenes();
  renderRooms();
  renderGuard();
  renderAlerts();
}

// Короткие подписи сценариев: одно слово под иконкой.
const SCENE_SHORT = { leave: 'Ушёл', home: 'Дома', night: 'Ночь', morning: 'Утро' };

function renderScenes() {
  $('scenes').innerHTML = S.scenes
    .map((s) => `<button class="scene" data-scene="${s.id}" aria-label="${esc(s.name)}"><span class="scene-dot">${icon(s.id, 24)}</span><span>${esc(SCENE_SHORT[s.id] ?? s.name)}</span></button>`)
    .join('');
}

const TILES = ['camera', 'doorbell', 'light', 'led', 'switch', 'plug', 'curtain', 'thermostat', 'ac', 'valve', 'lock', 'gate'];
const ADJUSTABLE = { led: true, curtain: true, thermostat: true, ac: true };

// Пока палец на плитке — не перерисовываем, иначе плитка «вырвется» из-под пальца.
let holding = false;
let roomsDirty = false;
function scheduleRooms() {
  if (holding) roomsDirty = true;
  else renderRooms();
}

function renderRooms() {
  roomsDirty = false;
  const all = [...S.devices.values()];
  const rooms = [...S.house.rooms, { id: 'unassigned', name: 'Без комнаты' }];
  $('rooms').innerHTML = rooms
    .map((room) => {
      const list = all.filter((d) => d.room === room.id);
      const tiles = list.filter((d) => TILES.includes(d.kind)).sort((a, b) => TILES.indexOf(a.kind) - TILES.indexOf(b.kind));
      const issues = list.map(issue).filter(Boolean);
      if (!tiles.length && !issues.length) return '';
      const here = list.some((d) => d.kind === 'presence' && d.state.presence);
      const lights = list.some((d) => ROOM_LIGHTS[d.kind]);
      return `
        <article class="room">
          <div class="room-head${lights ? ' pullable' : ''}" ${lights ? `data-room="${room.id}"` : ''}>
            ${lights ? `<span class="room-pull" aria-hidden="true">${icon('light', 18)}</span>` : ''}
            <span class="room-name">${esc(room.name)}${here ? '<i class="here"></i>' : ''}</span>
            <span class="room-temp">${roomTemp(list)}</span>
          </div>
          ${issues.length ? `<div class="issues">${issues.join('')}</div>` : ''}
          <div class="tiles">${tiles.map(tile).join('')}</div>
        </article>`;
    })
    .join('');
  showHintOnce();
  for (const img of $('rooms').querySelectorAll('img[data-cam]')) {
    const url = frames.get(img.dataset.cam);
    if (url) img.src = url;
  }
}

// Подсказка жеста без слов: при первом запуске регулируемые плитки один раз «проводят» заливкой.
let hinted = false;
function showHintOnce() {
  if (hinted || !$('rooms').querySelector('.tile.adj')) return;
  hinted = true;
  try { if (localStorage.getItem('dom:hint') === '1') return; localStorage.setItem('dom:hint', '1'); } catch { return; }
  $('rooms').classList.add('hint');
  setTimeout(() => $('rooms').classList.remove('hint'), 2600);
}

function roomTemp(list) {
  const sensor = list.find((d) => d.kind === 'climate_sensor');
  const trv = list.find((d) => d.kind === 'thermostat');
  const t = sensor?.state.temperature ?? trv?.state.temperature;
  return t == null ? '' : deg(t);
}

// Датчики: только если что-то не так. Нормальное состояние не показываем вовсе.
function issue(d) {
  const s = d.state;
  const chip = (cls, ic, text) => `<span class="issue ${cls}">${icon(ic, 16)}${esc(text)}</span>`;
  if (!d.online && !TILES.includes(d.kind)) return chip('warn', 'offline', `${d.label}: нет связи`);
  switch (d.kind) {
    case 'leak': if (s.leak) return chip('bad', 'leak', `${d.label}: вода`); break;
    case 'smoke': if (s.smoke) return chip('bad', 'smoke', 'Дым'); break;
    case 'gas': if (s.gas) return chip('bad', 'gas', 'Газ'); break;
    case 'contact': if (s.open) return chip('warn', 'contact', `${d.label} открыто`); break;
    case 'siren': if (s.alarm) return chip('bad', 'siren', 'Сирена'); break;
    case 'air': if (s.co2 > 1000) return chip(s.co2 > 1400 ? 'bad' : 'warn', 'air', 'Душно — проветрить'); break;
  }
  if (s.battery != null && s.battery < 15) return chip('warn', 'battery', `${d.label}: батарея ${s.battery}%`);
  return '';
}

// ---------- плитки ----------

function tile(d) {
  const s = d.state;
  let cls = '';
  let value = '';
  let ic = d.kind;
  let level = null; // 0..1 — заливка у регулируемых плиток

  switch (d.kind) {
    case 'light':
    case 'switch':
      cls = s.on ? 'on' : '';
      break;
    case 'plug':
      cls = s.on ? 'on' : '';
      if (s.on && s.power > 0) value = `${Math.round(s.power)} Вт`;
      break;
    case 'led':
      cls = s.on ? 'on' : '';
      if (s.on) { value = `${s.brightness}%`; level = s.brightness / 100; }
      break;
    case 'curtain':
      cls = s.position > 0 ? 'on' : '';
      value = s.moving ? '…' : s.position > 0 && s.position < 100 ? `${s.position}%` : '';
      level = s.position / 100;
      break;
    case 'thermostat':
      cls = s.mode === 'off' ? '' : s.heating ? 'on heat' : 'idle';
      value = s.mode === 'off' ? 'выкл' : deg(s.setpoint);
      if (s.mode !== 'off') level = (s.setpoint - 5) / 25;
      break;
    case 'ac':
      cls = s.on ? 'on cool' : '';
      if (s.on) { value = deg(s.setpoint); level = (s.setpoint - 16) / 14; }
      break;
    case 'valve':
      cls = s.open === false ? 'bad' : 'on cool';
      value = s.open === false ? 'закрыта' : '';
      break;
    case 'lock':
      cls = s.locked ? '' : 'warn';
      ic = s.locked ? 'lock' : 'unlock';
      break;
    case 'gate':
      cls = s.pulse ? 'on' : '';
      break;
    case 'camera':
    case 'doorbell':
      return `
        <button class="tile cam${d.online ? '' : ' offline'}" data-id="${d.id}">
          <img data-cam="${d.id}" alt="">
          <span class="tile-label">${icon(d.kind, 16)}${esc(d.label)}</span>
        </button>`;
  }
  const adj = ADJUSTABLE[d.kind] && level != null;
  return `
    <button class="tile ${cls}${d.online ? '' : ' offline'}${adj ? ' adj' : ''}" data-id="${d.id}" aria-label="${esc(d.label)}">
      ${adj ? `<span class="tile-fill" style="--level:${Math.max(0, Math.min(1, level))}"></span>` : ''}
      <span class="tile-icon">${icon(ic)}</span>
      <span class="tile-value">${esc(value)}</span>
      <span class="tile-label">${esc(d.label)}</span>
    </button>`;
}

// Касание: главное действие плитки.
function tap(d) {
  const s = d.state;
  buzz();
  switch (d.kind) {
    case 'light': case 'switch': case 'plug': case 'led':
      return command(d.id, { on: !s.on });
    case 'curtain':
      if (s.moving) return command(d.id, { action: 'stop' });
      return command(d.id, { action: s.position > 0 ? 'close' : 'open' });
    case 'thermostat':
      return command(d.id, { mode: s.mode === 'off' ? 'heat' : 'off' });
    case 'ac':
      return command(d.id, { on: !s.on });
    case 'valve':
      return command(d.id, { open: s.open === false });
    case 'lock':
      if (!s.locked) return command(d.id, { locked: true });
      return openSecurity({ onPin: (p) => api(`/devices/${d.id}`, { locked: false, pin: p }), sub: d.label, done: 'Открыто' });
    case 'gate':
      return command(d.id, { pulse: true });
    case 'camera': case 'doorbell':
      return details(d);
  }
}

// Свайп: значение по горизонтали. Полная ширина плитки = весь диапазон (для температуры — 8°).
// Выключенное устройство тоже можно «провести»: подсветка разгорается с нуля, климат включается.
// live — подсветка меняется прямо под пальцем, остальное — когда палец отпущен.
const RANGES = {
  led: {
    min: 0, max: 100, step: 1, span: 100, live: true,
    read: (s) => (s.on ? s.brightness : 0),
    show: (v) => (v ? `${v}%` : 'выкл'),
    cmd: (v) => (v ? { on: true, brightness: v } : { on: false }),
  },
  curtain: {
    min: 0, max: 100, step: 5, span: 100,
    read: (s) => s.position, show: (v) => `${v}%`, cmd: (v) => ({ position: v }),
  },
  thermostat: {
    min: 5, max: 30, step: 0.5, span: 8,
    read: (s) => s.setpoint ?? 20, show: deg, cmd: (v) => ({ mode: 'heat', setpoint: v }),
  },
  ac: {
    min: 16, max: 30, step: 1, span: 8,
    read: (s) => s.setpoint ?? 24, show: deg, cmd: (v) => ({ on: true, setpoint: v }),
  },
};
// Простые выключатели: провёл вправо — включил, влево — выключил.
const FLICK = { light: true, switch: true, plug: true };
const FLICK_PX = 36;
// Весь свет комнаты — свайпом по её названию.
const ROOM_LIGHTS = { light: true, led: true };
const ROOM_PX = 70;

// Долгое нажатие: редкие настройки.
function details(d) {
  const s = d.state;
  const room = S.house.rooms.find((r) => r.id === d.room)?.name ?? '';
  openInfo(d.label, room);
  const actions = $('sheet-actions');
  switch (d.kind) {
    case 'led':
      actions.innerHTML = `<div class="swatches">${LED_PRESETS.map((p) => `<button data-led="${p.cmd}" style="background:${p.css}" aria-label="${p.name}"></button>`).join('')}</div>`;
      actions.onclick = (e) => {
        const c = e.target.closest('[data-led]')?.dataset.led;
        if (!c) return;
        const [k, v] = c.split(':');
        command(d.id, k === 'ct' ? { colorTemp: Number(v) } : { hue: Number(v), saturation: 100 });
      };
      break;
    case 'ac':
      actions.innerHTML = `<div class="choice">
        <button data-mode="cool" class="${s.mode === 'cool' ? 'sel' : ''}">Холод</button>
        <button data-mode="heat" class="${s.mode === 'heat' ? 'sel' : ''}">Тепло</button>
        <button data-mode="off" class="${!s.on ? 'sel' : ''}">Выкл</button></div>`;
      actions.onclick = (e) => {
        const m = e.target.closest('[data-mode]')?.dataset.mode;
        if (m) { command(d.id, { mode: m }); sheet.close(); }
      };
      break;
    case 'camera':
    case 'doorbell':
      actions.innerHTML = `<img class="cam-full" data-cam="${d.id}" src="${frames.get(d.id) ?? ''}" alt="">`;
      actions.onclick = null;
      break;
    case 'thermostat':
      $('sheet-sub').textContent = `${room} · сейчас ${deg(s.temperature)}`;
      actions.onclick = null;
      break;
    case 'lock':
      $('sheet-sub').textContent = `${room}${s.battery != null ? ` · батарея ${s.battery}%` : ''}`;
      actions.onclick = null;
      break;
    case 'plug':
      $('sheet-sub').textContent = `${room}${s.on ? ` · ${Math.round(s.power ?? 0)} Вт` : ''}`;
      actions.onclick = null;
      break;
    default:
      actions.onclick = null;
  }
}

const LED_PRESETS = [
  { name: 'Тёплый', cmd: 'ct:400', css: '#ffb766' },
  { name: 'Дневной', cmd: 'ct:270', css: '#fff1dc' },
  { name: 'Холодный', cmd: 'ct:170', css: '#dfeeff' },
  { name: 'Янтарь', cmd: 'hue:30', css: '#ff9a1f' },
  { name: 'Бирюза', cmd: 'hue:180', css: '#2fd3c3' },
  { name: 'Сирень', cmd: 'hue:280', css: '#a05cff' },
];

// Жесты: касание, свайп, долгое нажатие на плитке и свайп по названию комнаты — одним обработчиком.
let gesture = null;
$('rooms').addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const head = e.target.closest('.room-head.pullable');
  if (head) {
    gesture = { kind: 'room', el: head, room: head.dataset.room, x: e.clientX, y: e.clientY, mode: 'press' };
    holding = true;
    return;
  }
  const el = e.target.closest('.tile');
  if (!el) return;
  const d = S.devices.get(el.dataset.id);
  if (!d || !d.online) return;
  const range = RANGES[d.kind];
  gesture = { kind: 'tile', el, d, x: e.clientX, y: e.clientY, mode: 'press', range, start: range ? range.read(d.state) : 0, value: null, sent: 0 };
  holding = true;
  gesture.timer = setTimeout(() => {
    if (gesture?.mode !== 'press') return;
    gesture.mode = 'long';
    buzz();
    details(d);
  }, 520);
});

window.addEventListener('pointermove', (e) => {
  if (!gesture) return;
  const g = gesture;
  const dx = e.clientX - g.x;
  const dy = e.clientY - g.y;
  if (g.mode === 'press') {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return endGesture(); // это прокрутка страницы
    if (Math.abs(dx) <= 10) return;
    const can = g.kind === 'room' || g.range || FLICK[g.d.kind];
    if (!can) return;
    clearTimeout(g.timer);
    g.mode = g.kind === 'room' ? 'room' : g.range ? 'drag' : 'flick';
    g.el.classList.add('dragging');
    try { g.el.setPointerCapture(e.pointerId); } catch {}
  }
  if (g.mode === 'drag') return dragValue(g, dx);
  if (g.mode === 'flick') {
    // Плитка тянется за пальцем и «защёлкивается», когда пройден порог.
    const want = dx > FLICK_PX ? true : dx < -FLICK_PX ? false : null;
    g.el.style.transform = `translateX(${Math.max(-18, Math.min(18, dx / 4))}px)`;
    if (want !== g.value) {
      g.value = want;
      if (want != null) buzz();
      g.el.classList.toggle('on', want ?? Boolean(g.d.state.on));
    }
  }
  if (g.mode === 'room') {
    const want = dx > ROOM_PX ? true : dx < -ROOM_PX ? false : null;
    g.el.style.setProperty('--pull', `${Math.max(-ROOM_PX - 20, Math.min(ROOM_PX + 20, dx))}px`);
    g.el.classList.toggle('arm-on', want === true);
    g.el.classList.toggle('arm-off', want === false);
    g.el.classList.toggle('to-left', dx < 0);
    if (want !== g.value && want != null) buzz();
    g.value = want;
  }
});

function dragValue(g, dx) {
  const r = g.range;
  const width = g.el.getBoundingClientRect().width;
  let v = g.start + (dx / width) * r.span;
  v = Math.min(r.max, Math.max(r.min, Math.round(v / r.step) * r.step));
  if (v === g.value) return;
  g.value = v;
  g.el.querySelector('.tile-value').textContent = r.show(v);
  g.el.classList.add('adj');
  g.el.classList.toggle('on', g.d.kind !== 'led' || v > 0);
  let fill = g.el.querySelector('.tile-fill');
  if (!fill) {
    fill = document.createElement('span');
    fill.className = 'tile-fill';
    g.el.prepend(fill);
  }
  fill.style.setProperty('--level', (v - r.min) / (r.max - r.min));
  // Подсветка отвечает сразу — не чаще раза в 250 мс, последнее значение уйдёт при отпускании.
  if (r.live && Date.now() - g.sent > 250) {
    g.sent = Date.now();
    g.liveValue = v;
    command(g.d.id, r.cmd(v));
  }
}

window.addEventListener('pointerup', () => {
  if (!gesture) return;
  const g = gesture;
  if (g.kind === 'tile' && g.mode === 'press') tap(g.d);
  if (g.mode === 'drag' && g.value != null && g.value !== g.start && g.value !== g.liveValue) {
    buzz();
    command(g.d.id, g.range.cmd(g.value));
  }
  if (g.mode === 'flick' && g.value != null && g.value !== Boolean(g.d.state.on)) command(g.d.id, { on: g.value });
  if (g.mode === 'room' && g.value != null) roomLights(g.room, g.value);
  endGesture();
});
window.addEventListener('pointercancel', endGesture);

function endGesture() {
  if (!gesture) return;
  clearTimeout(gesture.timer);
  const el = gesture.el;
  el.classList.remove('dragging', 'arm-on', 'arm-off', 'to-left');
  el.style.transform = '';
  el.style.removeProperty('--pull');
  gesture = null;
  holding = false;
  if (roomsDirty) setTimeout(renderRooms, 250);
}

function roomLights(roomId, on) {
  const list = [...S.devices.values()].filter((d) => d.room === roomId && ROOM_LIGHTS[d.kind] && d.online && Boolean(d.state.on) !== on);
  for (const d of list) command(d.id, { on });
  const name = S.house.rooms.find((r) => r.id === roomId)?.name ?? '';
  toast(`${name}: свет ${on ? 'включён' : 'выключен'}`);
}
// Долгое нажатие не должно открывать системное меню.
$('rooms').addEventListener('contextmenu', (e) => { if (e.target.closest('.tile')) e.preventDefault(); });

// ---------- камеры: кадр раз в 3 секунды, без мерцания при перерисовке ----------

const frames = new Map(); // id камеры -> objectURL последнего кадра
const MEDIA = ['camera', 'doorbell'];

async function refreshFrames() {
  const cams = [...S.devices.values()].filter((d) => MEDIA.includes(d.kind) && d.online);
  await Promise.all(cams.map(async (d) => {
    try {
      const res = await fetch(`/api/cameras/${d.id}/snapshot`, { cache: 'no-store' });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      const old = frames.get(d.id);
      frames.set(d.id, url);
      for (const img of document.querySelectorAll(`img[data-cam="${d.id}"]`)) img.src = url;
      if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
    } catch {
      // нет связи — оставляем прошлый кадр
    }
  }));
}
setInterval(() => { if (!document.hidden) refreshFrames(); }, 3000);

// ---------- охрана: щит в шапке ----------

function renderGuard() {
  const st = S.security.status;
  $('guard').dataset.status = st;
  const left = st === 'arming' || st === 'entry' ? secondsLeft() : '';
  $('guard-text').textContent = left || '';
  $('guard').setAttribute('aria-label', { disarmed: 'Охрана выключена', arming: 'Охрана включается', armed: 'Под охраной', entry: 'Снимите охрану', alarm: 'Тревога' }[st]);
  if ((st === 'entry' || st === 'alarm') && (!sheetOpen() || sheetMode !== 'security')) openSecurity();
  if (sheetOpen() && sheetMode === 'security') fillSecurity();
}

function secondsLeft() {
  if (!S.security.until) return 0;
  return Math.max(0, Math.ceil((S.security.until - (Date.now() + S.clockSkew)) / 1000));
}

// ---------- тревоги: смахнуть или нажать — «понятно» ----------

function renderAlerts() {
  $('alerts').innerHTML = S.alerts
    .map((a) => `
      <div class="alert ${a.level}" data-ack="${esc(a.id)}">
        ${a.kind === 'doorbell' && a.deviceId
          ? `<img class="alert-cam" data-cam="${esc(a.deviceId)}" src="${frames.get(a.deviceId) ?? ''}" alt="">`
          : `<span class="alert-icon">${icon('alert', 22)}</span>`}
        <span class="alert-title">${esc(a.title)}</span>
        <span class="alert-time">${time(a.at)}</span>
      </div>`)
    .join('');
}

let swipe = null;
$('alerts').addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.alert');
  if (el) swipe = { el, x: e.clientX };
});
$('alerts').addEventListener('pointermove', (e) => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x;
  swipe.el.style.transform = `translateX(${dx}px)`;
  swipe.el.style.opacity = String(1 - Math.min(Math.abs(dx) / 240, 0.7));
});
window.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const { el, x } = swipe;
  swipe = null;
  const moved = Math.abs(e.clientX - x);
  if (moved > 90 || moved < 6) {
    el.style.transform = `translateX(${(e.clientX - x) >= 0 ? 110 : -110}%)`;
    el.style.opacity = '0';
    api(`/alerts/${encodeURIComponent(el.dataset.ack)}/ack`).catch((err) => toast(err.message));
  } else {
    el.style.transform = '';
    el.style.opacity = '';
  }
});

function time(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${hm}`;
}

// ---------- сценарии ----------

$('scenes').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-scene]');
  if (!btn) return;
  const id = btn.dataset.scene;
  buzz();
  // «Дома» при включённой охране — сначала PIN.
  if (id === 'home' && S.security.status !== 'disarmed') {
    openSecurity({ onPin: (pin) => api('/scenes/home', { pin }), done: 'С возвращением' });
    return;
  }
  btn.classList.add('busy');
  try {
    await api(`/scenes/${id}`);
    toast(`${SCENE_SHORT[id] ?? ''} ✓`);
  } catch (err) {
    toast(err.message);
  } finally {
    setTimeout(() => btn.classList.remove('busy'), 500);
  }
});

// ---------- окно (охрана, PIN, детали, меню) ----------

const sheet = $('sheet');
const sheetOpen = () => sheet.open;
let sheetMode = 'security'; // security | info
let pin = '';
let onPin = null;
let pinSub = '';
let pinDone = 'Охрана снята';

$('guard').addEventListener('click', () => openSecurity());
$('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => { onPin = null; pin = ''; });
// Тап по затемнению вокруг окна — закрыть.
sheet.addEventListener('click', (e) => { if (e.target === sheet && S.security.status !== 'entry' && S.security.status !== 'alarm') sheet.close(); });

$('pin-pad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫']
  .map((k) => (k === '' ? '<span></span>' : `<button data-key="${k}" class="${k === '⌫' ? 'ghost' : ''}">${k}</button>`))
  .join('');

$('pin-pad').addEventListener('click', async (e) => {
  const key = e.target.closest('[data-key]')?.dataset.key;
  if (key == null) return;
  pin = key === '⌫' ? pin.slice(0, -1) : (pin + key).slice(0, 4);
  drawPin();
  if (pin.length < 4) return;
  const entered = pin;
  try {
    await (onPin ?? ((p) => api('/security', { action: 'disarm', pin: p })))(entered);
    sheet.close();
    toast(pinDone);
  } catch (err) {
    pin = '';
    drawPin();
    const dots = $('pin-dots');
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    if (err.status !== 403) toast(err.message);
  }
});

function drawPin() {
  [...$('pin-dots').children].forEach((dot, i) => dot.classList.toggle('full', i < pin.length));
}

function openSecurity(opts = {}) {
  sheetMode = 'security';
  onPin = opts.onPin ?? null;
  pinSub = opts.sub ?? '';
  pinDone = opts.done ?? 'Охрана снята';
  pin = '';
  drawPin();
  $('sheet-actions').onclick = null;
  fillSecurity();
  if (!sheet.open) sheet.showModal();
}

function fillSecurity() {
  const { status, mode, reason } = S.security;
  const set = (title, sub, actions, needPin) => {
    $('sheet-title').textContent = title;
    $('sheet-sub').textContent = sub;
    $('sheet-actions').innerHTML = actions;
    $('pin').hidden = !needPin;
  };
  sheet.classList.toggle('alarm', status === 'entry' || status === 'alarm');

  if (onPin) return set('PIN', pinSub, '', true);
  if (status === 'disarmed') {
    return set('Охрана', '', `
      <button class="primary" data-arm="away">${icon('leave')}Ухожу</button>
      <button data-arm="night">${icon('night')}На ночь</button>`, false);
  }
  if (status === 'arming') return set(`Через ${secondsLeft()} с`, 'PIN — отменить', '', true);
  if (status === 'armed') return set(mode === 'night' ? 'Ночная охрана' : 'Под охраной', '', '', true);
  if (status === 'entry') return set(`Снимите охрану: ${secondsLeft()} с`, reason ?? '', '', true);
  if (status === 'alarm') return set('Тревога', reason ?? '', '', true);
}

$('sheet-actions').addEventListener('click', async (e) => {
  const mode = e.target.closest('[data-arm]')?.dataset.arm;
  if (!mode) return;
  try {
    await api('/security', { action: 'arm', mode });
    sheet.close();
  } catch (err) {
    toast(err.message);
  }
});

function openInfo(title, sub) {
  sheetMode = 'info';
  onPin = null;
  sheet.classList.remove('alarm');
  $('sheet-title').textContent = title;
  $('sheet-sub').textContent = sub ?? '';
  $('sheet-actions').innerHTML = '';
  $('sheet-actions').onclick = null;
  $('pin').hidden = true;
  if (!sheet.open) sheet.showModal();
}

// ---------- меню «⋯»: всё редкое ----------

const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;
let cloud = null; // статус облака у хаба — для пунктов «Подключить телефон» и «Телефоны»

async function openMenu() {
  openInfo('', '');
  const items = [];
  items.push({ id: 'journal', icon: 'journal', label: 'Журнал' });
  const notify = await notifyState();
  if (notify) items.push({ id: 'notify', icon: 'bell', label: 'Уведомления', value: notify.label, on: notify.on });
  try { cloud = await api('/cloud', null, 'GET'); } catch { cloud = null; }
  if (cloud?.enabled && cloud.connected) {
    items.push({ id: 'pair', icon: 'phone', label: 'Подключить телефон' });
    items.push({ id: 'phones', icon: 'phones', label: 'Телефоны' });
  }
  if (!standalone && (installEvent || ios)) items.push({ id: 'install', icon: 'install', label: 'На экран «Домой»' });
  for (const extra of window.DOM_MENU_EXTRA?.() ?? []) items.push(extra);

  $('sheet-actions').innerHTML = `<div class="menu">${items.map((i) => `
    <button data-item="${i.id}">${icon(i.icon)}<span>${esc(i.label)}</span>${i.value ? `<small class="${i.on ? 'on' : ''}">${esc(i.value)}</small>` : ''}</button>`).join('')}</div>`;
  $('sheet-actions').onclick = (e) => {
    const id = e.target.closest('[data-item]')?.dataset.item;
    if (!id) return;
    const extra = (window.DOM_MENU_EXTRA?.() ?? []).find((x) => x.id === id);
    if (extra) {
      sheet.close();
      return extra.run();
    }
    ({ journal: openJournal, notify: toggleNotify, pair: showPairQr, phones: openPhones, install: install })[id]?.();
  };
}
$('menu').addEventListener('click', openMenu);

function openJournal() {
  openInfo('Журнал', '');
  $('sheet-actions').innerHTML = `<ol class="log">${S.log.length
    ? S.log.slice(0, 80).map((e) => `<li class="${e.level}"><time>${time(e.at)}</time><span>${esc(e.text)}</span></li>`).join('')
    : '<li class="log-empty">Пока тихо</li>'}</ol>`;
}

async function showPairQr() {
  try {
    const { svg } = await api('/cloud/pair');
    openInfo('Наведите камеру телефона', 'Потом — Face ID. QR живёт 10 минут.');
    $('sheet-actions').innerHTML = `<div class="qr">${svg}</div>`;
  } catch (err) {
    toast(err.message);
  }
}

async function openPhones() {
  openInfo('Телефоны', '');
  const box = $('sheet-actions');
  box.innerHTML = '<p class="muted">…</p>';
  try {
    const { members } = await api('/cloud/members', null, 'GET');
    box.innerHTML = members.length
      ? `<div class="menu">${members.map((m) => `
          <div class="member">${icon(m.device === 'Компьютер' ? 'install' : 'phone')}
            <span>${esc(m.device ?? 'Телефон')}<small>${m.role === 'owner' ? 'владелец · ' : ''}${new Date(m.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small></span>
            <button class="pill-btn" data-remove="${esc(m.user_id)}">Отключить</button>
          </div>`).join('')}</div>`
      : '<p class="muted">Пока ни одного</p>';
    box.onclick = async (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      if (btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.textContent = 'Точно?';
        btn.classList.add('danger');
        return;
      }
      try {
        await api('/cloud/members/remove', { userId: btn.dataset.remove });
        toast('Отключён');
        openPhones();
      } catch (err) {
        toast(err.message);
      }
    };
  } catch (err) {
    box.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
  }
}

// ---------- установка и уведомления ----------

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  toast('Установлено');
});

async function install() {
  if (installEvent) {
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    sheet.close();
    return;
  }
  openInfo('На экран «Домой»', 'Safari → «Поделиться» → «На экран „Домой“».');
}

async function pushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Что показать в меню напротив «Уведомления». null — пункт не нужен.
async function notifyState() {
  if (!window.isSecureContext || !('Notification' in window)) return null;
  if (ios && !standalone) return { label: 'после установки', on: false, needInstall: true };
  if (Notification.permission === 'denied') return { label: 'запрещены', on: false };
  if (window.DOM_DEMO) return window.DOM_DEMO.subscribed() ? { label: 'вкл', on: true } : { label: 'выкл', on: false };
  if (!('PushManager' in window)) return null;
  return (await pushSubscription()) ? { label: 'вкл', on: true } : { label: 'выкл', on: false };
}

async function toggleNotify() {
  const st = await notifyState();
  try {
    if (st?.needInstall) return install();
    if (st?.on) {
      await api('/push/test');
      return toast('Проверка отправлена');
    }
    if ((await Notification.requestPermission()) !== 'granted') return openMenu();
    if (window.DOM_DEMO) {
      await api('/push/subscribe', { demo: true });
    } else {
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api('/push/key', null, 'GET');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64url(key) });
      await api('/push/subscribe', sub.toJSON());
    }
    toast('Уведомления включены');
    openMenu();
  } catch (err) {
    toast(err.message);
  }
}

function base64url(s) {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

// Ярлыки на иконке приложения (долгое нажатие) открывают /?scene=leave и т.п.
let sceneFromUrlDone = false;
function runSceneFromUrl() {
  if (sceneFromUrlDone) return;
  sceneFromUrlDone = true;
  const id = new URLSearchParams(location.search).get('scene');
  if (!id) return;
  history.replaceState(null, '', location.pathname);
  document.querySelector(`[data-scene="${CSS.escape(id)}"]`)?.click();
}

// ---------- часы, отсчёты, тосты ----------

function tick() {
  $('clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (S.security.until) renderGuard();
}
setInterval(tick, 1000);
tick();

let toastTimer;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2000);
}

connect();
