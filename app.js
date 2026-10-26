// Панель «Дом»: одна страница для планшета на стене и телефона.
// Состояние приходит по WebSocket от хаба, команды уходят REST-запросами.

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
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
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
  presence: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  gas: '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  button: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
};
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const deg = (v) => (v == null ? '—' : `${Number(v).toFixed(1).replace('.', ',')}°`);

const S = {
  house: { name: 'Дом', rooms: [] },
  devices: new Map(),
  security: { status: 'disarmed' },
  alerts: [],
  scenes: [],
  log: [],
  clockSkew: 0, // сервер - клиент, чтобы отсчёты совпадали с хабом
  view: 'home',
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
      if (S.view === 'log') renderLog();
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
  renderScenes();
  renderRooms();
  renderGuard();
  renderAlerts();
  if (S.view === 'log') renderLog();
}

function renderScenes() {
  $('scenes').innerHTML = S.scenes
    .map((s) => `<button class="scene" data-scene="${s.id}">${icon(s.id, 22)}<span>${esc(s.name)}</span></button>`)
    .join('');
}

const CONTROLS = ['light', 'led', 'switch', 'plug', 'thermostat', 'ac', 'curtain', 'valve', 'lock', 'gate'];
const MEDIA = ['camera', 'doorbell'];
const SENSORS = ['presence', 'motion', 'contact', 'air', 'leak', 'smoke', 'gas', 'siren', 'button'];

// Пока палец на ползунке — не перерисовываем, иначе ползунок «вырвется» из-под пальца.
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
      if (!list.length) return '';
      const of = (kinds) => list.filter((d) => kinds.includes(d.kind)).sort((a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind));
      const sensors = of(SENSORS);
      return `
        <article class="room">
          <div class="room-head">
            <div class="room-name">${esc(room.name)}${list.some((d) => d.kind === 'presence' && d.state.presence) ? '<span class="here" title="В комнате кто-то есть"></span>' : ''}</div>
            <div class="room-climate">${roomClimate(list)}</div>
          </div>
          ${of(MEDIA).map(renderMedia).join('')}
          ${of(CONTROLS).map(renderControl).join('')}
          ${sensors.length ? `<div class="chips">${sensors.map(renderChip).join('')}</div>` : ''}
        </article>`;
    })
    .join('');
  for (const img of $('rooms').querySelectorAll('img[data-cam]')) {
    const url = frames.get(img.dataset.cam);
    if (url) img.src = url;
  }
}

function roomClimate(list) {
  const sensor = list.find((d) => d.kind === 'climate_sensor');
  const trv = list.find((d) => d.kind === 'thermostat');
  const t = sensor?.state.temperature ?? trv?.state.temperature;
  if (t == null) return '';
  const h = sensor?.state.humidity;
  return `<b>${deg(t)}</b>${h != null ? `${h}%` : ''}`;
}

// ---------- камеры: кадр раз в 3 секунды, без мерцания при перерисовке ----------

const frames = new Map(); // id камеры -> objectURL последнего кадра

function renderMedia(d) {
  const sub = d.kind === 'doorbell'
    ? d.state.lastRing ? `Звонили в ${time(d.state.lastRing)}` : 'Звонков не было'
    : d.state.motion ? 'Движение в кадре' : 'В эфире';
  return `
    <figure class="cam${d.online ? '' : ' offline'}">
      <img data-cam="${d.id}" alt="${esc(d.label)}">
      <figcaption>${icon(d.kind, 16)}<span>${esc(d.label)}</span><small>${sub}</small></figcaption>
    </figure>`;
}

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
setInterval(() => { if (!document.hidden && S.view === 'home') refreshFrames(); }, 3000);

function renderControl(d) {
  const s = d.state;
  const off = d.online ? '' : ' offline';
  const row = (cls, sub, right) => `
    <div class="row ${cls}${off}" data-id="${d.id}">
      <div class="row-icon">${icon(d.kind)}</div>
      <div class="row-text"><div class="row-label">${esc(d.label)}</div><div class="row-sub">${sub}</div></div>
      ${right}
    </div>`;
  const sw = (on) => `<button class="switch" role="switch" aria-checked="${on}" data-cmd="toggle" aria-label="${esc(d.label)}"></button>`;

  switch (d.kind) {
    case 'light':
      return row(s.on ? 'on' : '', s.on ? 'Включён' : 'Выключен', sw(s.on));
    case 'switch':
      return row(s.on ? 'on' : '', s.on ? 'Работает' : 'Выключен', sw(s.on));
    case 'led': {
      const tone = s.mode === 'color' ? 'цвет' : s.colorTemp >= 330 ? 'тёплый' : s.colorTemp <= 220 ? 'холодный' : 'дневной';
      const ctl = s.on ? `
        <div class="led-ctl" data-id="${d.id}">
          <input type="range" min="1" max="100" value="${s.brightness}" aria-label="Яркость">
          <div class="swatches">
            ${LED_PRESETS.map((p) => `<button data-cmd="${p.cmd}" style="background:${p.css}" aria-label="${p.name}" title="${p.name}"></button>`).join('')}
          </div>
        </div>` : '';
      return row(s.on ? 'on' : '', s.on ? `${s.brightness}% · ${tone}` : 'Выключена', sw(s.on)) + ctl;
    }
    case 'valve': {
      const sub = s.open === true ? 'Открыта' : s.open === false ? 'Перекрыта' : 'Нет данных';
      return row(s.open === false ? 'bad' : 'on cool', sub, `
        <div class="seg">
          ${s.open === false ? '<button data-cmd="water-open">Открыть</button>' : '<button data-cmd="water-close">Перекрыть</button>'}
        </div>`);
    }
    case 'lock': {
      const sub = `${s.locked ? 'Закрыт' : 'Открыт'}${s.battery != null ? ` · батарея ${s.battery}%` : ''}`;
      return row(s.locked ? 'on' : 'warn', sub, s.locked
        ? '<button class="pill-btn" data-cmd="unlock">Открыть</button>'
        : '<button class="pill-btn" data-cmd="lock">Закрыть</button>').replace(icon('lock'), icon(s.locked ? 'lock' : 'unlock'));
    }
    case 'plug':
      return row(s.on ? 'on' : '', s.on ? `${Math.round(s.power ?? 0)} Вт` : 'Выключена', sw(s.on));
    case 'thermostat': {
      const sub = s.mode === 'off' ? 'Выключен' : `Сейчас ${deg(s.temperature)}${s.heating ? ' · греет' : ''}`;
      return row(s.heating ? 'on heat' : '', sub, stepper(s.setpoint, 'setpoint'));
    }
    case 'ac': {
      const sub = s.on ? `${s.mode === 'heat' ? 'Обогрев' : 'Охлаждение'} · ${deg(s.setpoint)}` : 'Выключен';
      return row(s.on ? 'on cool' : '', sub, `${s.on ? stepper(s.setpoint, 'setpoint') : ''}${sw(s.on)}`);
    }
    case 'curtain': {
      const sub = s.moving ? `${s.moving === 'opening' ? 'Открываются' : 'Закрываются'}… ${s.position}%`
        : s.position === 0 ? 'Закрыты' : s.position === 100 ? 'Открыты' : `Открыты на ${s.position}%`;
      return row(s.position > 0 ? 'on' : '', sub, `
        <div class="seg">
          <button data-cmd="open">Открыть</button>
          ${s.moving ? '<button data-cmd="stop">Стоп</button>' : ''}
          <button data-cmd="close">Закрыть</button>
        </div>`);
    }
    case 'gate':
      return row(s.pulse ? 'on' : '', 'Открыть или закрыть', '<button class="pill-btn" data-cmd="pulse">Нажать</button>');
  }
  return '';
}

const LED_PRESETS = [
  { name: 'Тёплый', cmd: 'ct:400', css: '#ffb766' },
  { name: 'Дневной', cmd: 'ct:270', css: '#fff1dc' },
  { name: 'Холодный', cmd: 'ct:170', css: '#dfeeff' },
  { name: 'Янтарь', cmd: 'hue:30', css: '#ff9a1f' },
  { name: 'Бирюза', cmd: 'hue:180', css: '#2fd3c3' },
  { name: 'Сирень', cmd: 'hue:280', css: '#a05cff' },
];

function stepper(value, key) {
  return `<div class="stepper"><button data-cmd="${key}-" aria-label="Меньше">−</button><output>${deg(value)}</output><button data-cmd="${key}+" aria-label="Больше">+</button></div>`;
}

function renderChip(d) {
  const s = d.state;
  let text, cls = '';
  if (!d.online) return `<span class="chip warn">${icon(d.kind)}${esc(d.label)} · не в сети</span>`;
  switch (d.kind) {
    case 'contact': text = s.open ? 'открыто' : 'закрыто'; if (s.open) cls = 'warn'; break;
    case 'motion': text = s.motion ? 'есть' : 'нет'; if (s.motion) cls = 'warn'; break;
    case 'presence': text = s.presence ? 'кто-то есть' : 'никого'; if (s.presence) cls = 'on'; break;
    case 'leak': text = s.leak ? 'вода!' : 'сухо'; if (s.leak) cls = 'bad'; break;
    case 'smoke': text = s.smoke ? 'дым!' : 'норма'; if (s.smoke) cls = 'bad'; break;
    case 'gas': text = s.gas ? 'утечка!' : 'норма'; if (s.gas) cls = 'bad'; break;
    case 'siren': text = s.alarm ? 'воет' : 'тихо'; if (s.alarm) cls = 'bad'; break;
    case 'air':
      // CO₂: до 1000 — свежо, 1000–1400 — пора проветрить, выше — душно.
      text = s.co2 == null ? '—' : `CO₂ ${s.co2} ppm${s.pm25 != null ? ` · PM2.5 ${s.pm25}` : ''}`;
      if (s.co2 > 1400) cls = 'bad';
      else if (s.co2 > 1000) { cls = 'warn'; text += ' · проветрить'; }
      break;
    case 'button': text = s.lastActionAt ? `нажата в ${time(s.lastActionAt)}` : 'готова'; break;
  }
  if (!cls && s.battery != null && s.battery < 20) { cls = 'warn'; text += ` · батарея ${s.battery}%`; }
  return `<span class="chip ${cls}">${icon(d.kind)}${esc(d.label)} · ${text}</span>`;
}

const GUARD_TEXT = {
  disarmed: () => 'Охрана выключена',
  arming: () => `Охрана через ${secondsLeft()} с`,
  armed: () => (S.security.mode === 'night' ? 'Ночная охрана' : 'Под охраной'),
  entry: () => `Снимите охрану · ${secondsLeft()} с`,
  alarm: () => 'Тревога',
};

function renderGuard() {
  const st = S.security.status;
  $('guard').dataset.status = st;
  $('guard-text').textContent = GUARD_TEXT[st]();
  if ((st === 'entry' || st === 'alarm') && (!sheetOpen() || sheetMode !== 'security')) openSecurity();
  if (sheetOpen() && sheetMode === 'security') fillSecurity();
}

function secondsLeft() {
  if (!S.security.until) return 0;
  return Math.max(0, Math.ceil((S.security.until - (Date.now() + S.clockSkew)) / 1000));
}

function renderAlerts() {
  $('alerts').innerHTML = S.alerts
    .map((a) => `
      <div class="alert ${a.level}">
        ${a.kind === 'doorbell' && a.deviceId
          ? `<img class="alert-cam" data-cam="${esc(a.deviceId)}" src="${frames.get(a.deviceId) ?? ''}" alt="">`
          : `<div class="alert-icon">${icon('alert', 24)}</div>`}
        <div class="alert-text"><div class="alert-title">${esc(a.title)}</div><div class="alert-time">${time(a.at)}</div></div>
        <button data-ack="${esc(a.id)}">Понятно</button>
      </div>`)
    .join('');
}

function renderLog() {
  $('log').innerHTML = S.log.length
    ? S.log.map((e) => `<li><time>${time(e.at)}</time><span class="${e.level}">${esc(e.text)}</span></li>`).join('')
    : '<li class="log-empty">Пока ничего не происходило</li>';
}

function time(ts) {
  const d = new Date(ts);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? hm : `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${hm}`;
}

// ---------- действия ----------

$('rooms').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cmd]');
  const row = e.target.closest('[data-id]');
  if (!btn || !row) return;
  const d = S.devices.get(row.dataset.id);
  if (!d) return;
  const cmd = btn.dataset.cmd;
  if (cmd === 'toggle') command(d.id, { on: !d.state.on });
  else if (cmd === 'setpoint+') command(d.id, { setpoint: (d.state.setpoint ?? 20) + 0.5 });
  else if (cmd === 'setpoint-') command(d.id, { setpoint: (d.state.setpoint ?? 20) - 0.5 });
  else if (cmd === 'open' || cmd === 'close' || cmd === 'stop') command(d.id, { action: cmd });
  else if (cmd === 'pulse') command(d.id, { pulse: true }).then(() => toast('Ворота: команда отправлена'));
  else if (cmd === 'water-open') command(d.id, { open: true });
  else if (cmd === 'water-close') command(d.id, { open: false });
  else if (cmd === 'lock') command(d.id, { locked: true });
  else if (cmd === 'unlock') {
    openSecurity({ onPin: (p) => api(`/devices/${d.id}`, { locked: false, pin: p }), sub: `Открыть: ${d.label}`, done: 'Замок открыт' });
  } else if (cmd.startsWith('ct:')) command(d.id, { colorTemp: Number(cmd.slice(3)) });
  else if (cmd.startsWith('hue:')) command(d.id, { hue: Number(cmd.slice(4)), saturation: 100 });
});

// Яркость ленты: команда уходит, когда палец отпустил ползунок.
$('rooms').addEventListener('pointerdown', (e) => { if (e.target.matches('input[type=range]')) holding = true; });
const release = () => {
  if (!holding) return;
  holding = false;
  if (roomsDirty) setTimeout(renderRooms, 300);
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
$('rooms').addEventListener('change', (e) => {
  if (!e.target.matches('input[type=range]')) return;
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (id) command(id, { brightness: Number(e.target.value) });
});

$('scenes').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-scene]');
  if (!btn) return;
  const id = btn.dataset.scene;
  // «Я дома» при включённой охране — сначала PIN.
  if (id === 'home' && S.security.status !== 'disarmed') {
    openSecurity({ onPin: (pin) => api('/scenes/home', { pin }) });
    return;
  }
  btn.classList.add('busy');
  try {
    await api(`/scenes/${id}`);
    toast(`«${btn.textContent.trim()}» — готово`);
  } catch (err) {
    toast(err.message);
  } finally {
    setTimeout(() => btn.classList.remove('busy'), 400);
  }
});

$('alerts').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ack]');
  if (btn) api(`/alerts/${encodeURIComponent(btn.dataset.ack)}/ack`).catch((err) => toast(err.message));
});

$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn) return;
  S.view = btn.dataset.view;
  for (const b of $('tabs').children) b.classList.toggle('active', b === btn);
  $('view-home').hidden = S.view !== 'home';
  $('view-log').hidden = S.view !== 'log';
  if (S.view === 'log') renderLog();
});

// ---------- окно охраны и PIN ----------

const sheet = $('sheet');
const sheetOpen = () => sheet.open;
let sheetMode = 'security'; // security | info
let pin = '';
let onPin = null;
let pinSub = 'Чтобы снять охрану';
let pinDone = 'Охрана снята';

$('guard').addEventListener('click', () => openSecurity());
$('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => { onPin = null; pin = ''; });

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
  pinSub = opts.sub ?? 'Чтобы снять охрану';
  pinDone = opts.done ?? 'Охрана снята';
  pin = '';
  drawPin();
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

  if (onPin) return set('Введите PIN', pinSub, '', true);
  if (status === 'disarmed') {
    return set('Охрана выключена', 'Выберите режим', `
      <button class="primary" data-arm="away">Я ухожу — полная охрана</button>
      <button data-arm="night">Ночь — только двери и окна</button>`, false);
  }
  if (status === 'arming') return set(`Охрана через ${secondsLeft()} с`, 'Выходите и закройте дверь. PIN — отменить', '', true);
  if (status === 'armed') return set(mode === 'night' ? 'Ночная охрана' : 'Дом под охраной', 'PIN — снять охрану', '', true);
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
  $('sheet-sub').textContent = sub;
  $('sheet-actions').innerHTML = '';
  $('pin').hidden = true;
  if (!sheet.open) sheet.showModal();
}

// ---------- приложение: установка, офлайн, уведомления ----------

const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').then(renderNotify).catch((e) => console.warn('sw', e));
}

// Chrome/Edge/Android: браузер сам скажет, что приложение можно установить.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('install').hidden = false;
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  $('install').hidden = true;
  toast('Приложение установлено');
});
// iPhone/iPad: кнопки установки в Safari нет — показываем, куда нажать.
if (ios && !standalone) $('install').hidden = false;

$('install').addEventListener('click', async () => {
  if (installEvent) {
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $('install').hidden = true;
    return;
  }
  openInfo('Установить на iPhone', 'Нажмите «Поделиться» внизу Safari, затем «На экран „Домой“». Уведомления о тревогах на iPhone работают только в установленном приложении.');
});

async function pushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function renderNotify() {
  const btn = $('notify-btn');
  const sub = $('notify-sub');
  const set = (text, button, on = false) => {
    sub.textContent = text;
    btn.textContent = button ?? '';
    btn.hidden = !button;
    $('notify').classList.toggle('on', on);
  };
  if (!window.isSecureContext) return set('Заработают, когда приложение откроется по защищённому адресу (https)');
  if (ios && !standalone) return set('На iPhone — сначала установите приложение', 'Как?');
  if (!('PushManager' in window) || !('Notification' in window)) return set('Этот браузер не умеет уведомления');
  if (Notification.permission === 'denied') return set('Запрещены в настройках браузера для этого сайта');
  // В демо нет сервера: уведомления показывает сама страница, пока она открыта.
  const demo = window.DOM_DEMO;
  if (demo) return demo.subscribed() ? set('Включены — в демо приходят, пока приложение открыто', 'Проверить', true) : set('Протечка, дым, проникновение, звонок в дверь', 'Включить');
  if (await pushSubscription()) return set('Включены на этом устройстве', 'Проверить', true);
  set('Протечка, дым, проникновение — даже когда приложение закрыто', 'Включить');
}

$('notify-btn').addEventListener('click', async () => {
  const action = $('notify-btn').textContent;
  try {
    if (action === 'Как?') return $('install').click();
    if (action === 'Проверить') {
      await api('/push/test');
      return toast('Отправил проверочное уведомление');
    }
    if ((await Notification.requestPermission()) !== 'granted') return renderNotify();
    if (window.DOM_DEMO) {
      await api('/push/subscribe', { demo: true });
      toast('Уведомления включены');
      return renderNotify();
    }
    const reg = await navigator.serviceWorker.ready;
    const { key } = await api('/push/key', null, 'GET');
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64url(key) });
    await api('/push/subscribe', sub.toJSON());
    toast('Уведомления включены');
  } catch (err) {
    toast(err.message);
  }
  renderNotify();
});

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

renderNotify();

// ---------- часы, отсчёты, тосты ----------

function tick() {
  const now = new Date();
  $('clock').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  $('date').textContent = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
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
  toastTimer = setTimeout(() => (el.hidden = true), 2500);
}

connect();
