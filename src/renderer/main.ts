// Top bar + settings UI. Plain script (not a module) so it loads from file://.
type AppState = import('../shared/types').AppState;
type Settings = import('../shared/types').Settings;
type LLMsApi = import('../preload/topbar').LLMsApi;

const api = (window as unknown as { llms: LLMsApi }).llms;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const KEEP_ALIVE_OPTIONS: [number, string][] = [
  [5, '5m'],
  [15, '15m'],
  [30, '30m'],
  [60, '1h'],
  [240, '4h'],
  [0, 'Always'],
];

type ProviderInfo = AppState['providers'][number];

/** Fill a .icon holder with the provider's image, or a colored letter badge when it has none. */
function setIcon(holder: Element, p: ProviderInfo): void {
  if (p.icon) {
    let img = holder.querySelector('img');
    if (!img) {
      holder.replaceChildren();
      img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      holder.appendChild(img);
    }
    if (img.getAttribute('src') !== p.icon) img.src = p.icon;
  } else {
    let badge = holder.querySelector<HTMLElement>('.badge');
    if (!badge) {
      holder.replaceChildren();
      badge = document.createElement('span');
      badge.className = 'badge';
      holder.appendChild(badge);
    }
    badge.textContent = (p.name.match(/[\p{L}\p{N}]/u) ?? ['?'])[0];
    badge.style.background = p.color;
  }
}

let state: AppState | null = null;
let initialFrame: boolean | null = null;

// ---------- top bar ----------

const track = $('track');
const indicator = $('indicator');

function renderPills(s: AppState): void {
  const enabled = s.providers.filter((p) => p.enabled);
  const existing = new Map([...track.querySelectorAll<HTMLButtonElement>('.pill')].map((el) => [el.dataset.id!, el]));

  enabled.forEach((p, i) => {
    let el = existing.get(p.id);
    if (!el) {
      el = document.createElement('button');
      el.className = 'pill';
      el.dataset.id = p.id;
      el.innerHTML = `<span class="icon"></span><span class="status"></span><span class="name"></span>`;
      el.addEventListener('click', (e) => (e.shiftKey ? api.toggleInSplit(p.id) : api.activate(p.id)));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        api.tabMenu(p.id);
      });
    }
    existing.delete(p.id);
    setIcon(el.querySelector('.icon')!, p);
    el.querySelector('.name')!.textContent = p.name;
    el.title = (i < 9 ? `${p.name}  (Ctrl+${i + 1})` : p.name) + (p.inSplit ? '\nShift+click to remove from split' : '\nShift+click to show alongside');
    el.className = `pill ${p.status}` + (p.id === s.active ? ' active' : '') + (p.inSplit ? ' grouped' : '');
    el.style.setProperty('--glow', p.color);
    track.appendChild(el); // re-appending keeps DOM order in sync with settings order
  });
  for (const el of existing.values()) el.remove();

  // The name expands with a transition, so follow the pill until it settles.
  moveIndicator();
  const start = performance.now();
  const follow = () => {
    moveIndicator();
    if (performance.now() - start < 300) requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}

function moveIndicator(): void {
  const active = track.querySelector<HTMLElement>('.pill.active');
  if (!active) {
    indicator.style.width = '0';
    return;
  }
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
  indicator.style.width = `${active.offsetWidth}px`;
  const color = state?.providers.find((p) => p.id === active.dataset.id)?.color;
  indicator.style.setProperty('--glow', color ?? 'transparent');
  active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

window.addEventListener('resize', () => {
  indicator.classList.add('no-anim');
  moveIndicator();
  requestAnimationFrame(() => indicator.classList.remove('no-anim'));
});

// Mouse wheel scrolls the pill track sideways when it overflows.
track.addEventListener(
  'wheel',
  (e) => {
    if (track.scrollWidth > track.clientWidth) {
      track.scrollLeft += e.deltaY || e.deltaX;
      e.preventDefault();
    }
  },
  { passive: false },
);

$('reload').addEventListener('click', () => api.reload());
$('split-btn').addEventListener('click', () => api.toggleSplit());
$('home').addEventListener('click', () => api.goHome());
document.querySelectorAll<HTMLButtonElement>('[data-win]').forEach((b) =>
  b.addEventListener('click', () => api.windowAction(b.dataset.win as 'minimize' | 'maximize' | 'close')),
);
// Double-clicking empty bar space maximizes, like a normal title bar.
document.querySelectorAll('.drag').forEach((el) => el.addEventListener('dblclick', () => api.windowAction('maximize')));

function renderWindowControls(s: AppState): void {
  $('split-btn').classList.toggle('on', s.split);
  $('win-controls').hidden = initialFrame === true;
  $('max-icon').innerHTML = s.maximized
    ? '<rect x="8" y="5" width="11" height="11" rx="2"/><path d="M5 9v8a2 2 0 0 0 2 2h8"/>'
    : '<rect x="6" y="6" width="12" height="12" rx="2"/>';
}

// ---------- toast ----------

const toastEl = $('toast');
let toastTimer: number | undefined;
api.onToast((t) => {
  toastEl.textContent = t.text;
  toastEl.className = `toast show ${t.kind ?? ''}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
});

// ---------- settings ----------

const overlay = $('overlay');
const addOverlay = $('add-overlay');

function openOverlay(el: HTMLElement): void {
  if (!el.hidden) return;
  for (const other of [overlay, addOverlay]) if (other !== el) closeOverlay(other);
  api.setOverlay(true);
  el.classList.remove('closing');
  el.hidden = false;
}

function closeOverlay(el: HTMLElement): void {
  if (el.hidden || el.classList.contains('closing')) return;
  el.classList.add('closing');
  setTimeout(() => {
    el.hidden = true;
    el.classList.remove('closing');
    if (overlay.hidden && addOverlay.hidden) api.setOverlay(false);
  }, 160);
}

function openSettings(): void {
  if (state) renderSettings(state);
  openOverlay(overlay);
}

$('settings-btn').addEventListener('click', () => (overlay.hidden ? openSettings() : closeOverlay(overlay)));
$('close-settings').addEventListener('click', () => closeOverlay(overlay));
$('backdrop').addEventListener('click', () => closeOverlay(overlay));
document.querySelectorAll<HTMLElement>('[data-close]').forEach((b) =>
  b.addEventListener('click', () => closeOverlay($(b.dataset.close!))),
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const el of [overlay, addOverlay]) closeOverlay(el);
});
api.onOpenSettings(() => (overlay.hidden ? openSettings() : closeOverlay(overlay)));

// ---------- add a tab ("+") ----------

let addKind: 'account' | 'site' = 'account';
const baseSelect = $<HTMLSelectElement>('add-base');
const urlInput = $<HTMLInputElement>('add-url');
const nameInput = $<HTMLInputElement>('add-name');

function setAddKind(kind: 'account' | 'site'): void {
  addKind = kind;
  document.querySelectorAll<HTMLButtonElement>('#add-kind button').forEach((b) => b.classList.toggle('on', b.dataset.kind === kind));
  $('field-base').hidden = kind !== 'account';
  $('field-url').hidden = kind !== 'site';
  $('add-hint').textContent =
    kind === 'account'
      ? 'A second login for the same service, with its own separate cookies. Handy for a work and a personal account.'
      : 'Any website. It gets its own saved login too.';
  nameInput.placeholder = kind === 'account' ? 'e.g. ChatGPT (work)' : 'Defaults to the site address';
}

function openAdd(): void {
  if (!state) return;
  // Offer only built-in-style choices once each; extras are listed under their own name too.
  baseSelect.replaceChildren(
    ...state.providers.map((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      return o;
    }),
  );
  const current = state.active && state.providers.some((p) => p.id === state!.active) ? state.active : '';
  if (current) baseSelect.value = current;
  urlInput.value = '';
  nameInput.value = '';
  setAddKind(addKind);
  openOverlay(addOverlay);
  setTimeout(() => (addKind === 'site' ? urlInput : nameInput).focus(), 50);
}

document.querySelectorAll<HTMLButtonElement>('#add-kind button').forEach((b) =>
  b.addEventListener('click', () => {
    setAddKind(b.dataset.kind as 'account' | 'site');
    (addKind === 'site' ? urlInput : nameInput).focus();
  }),
);
$('add-btn').addEventListener('click', () => (addOverlay.hidden ? openAdd() : closeOverlay(addOverlay)));
api.onOpenAdd(() => (addOverlay.hidden ? openAdd() : closeOverlay(addOverlay)));
$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (addKind === 'site') {
    if (!urlInput.value.trim()) return urlInput.focus();
    api.addProvider({ kind: 'site', url: urlInput.value, name: nameInput.value });
  } else {
    api.addProvider({ kind: 'account', base: baseSelect.value, name: nameInput.value });
  }
  closeOverlay(addOverlay);
});

function save(patch: Partial<Settings>): void {
  api.updateSettings(patch);
}

function renderSettings(s: AppState): void {
  const list = $('provider-list');
  list.replaceChildren(
    ...s.providers.map((p) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.id = p.id;
      li.className = p.enabled ? '' : 'off';
      li.innerHTML = `
        <svg class="grip" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        <span class="icon"></span>
        <span class="pname"></span>
        ${p.removable ? '<button class="text-btn remove" title="Delete this tab and its login">Remove</button>' : ''}
        <button class="text-btn danger logout" title="Clear this provider's cookies">Log out</button>
        <input type="checkbox" class="switch" title="Show in top bar">`;
      setIcon(li.querySelector('.icon')!, p);
      li.querySelector('.pname')!.textContent = p.name;
      li.querySelector('.logout')!.addEventListener('click', () => api.logout(p.id));
      li.querySelector('.remove')?.addEventListener('click', () => api.removeProvider(p.id));
      const sw = li.querySelector<HTMLInputElement>('input')!;
      sw.checked = p.enabled;
      sw.addEventListener('change', () => {
        const disabled = new Set(s.settings.disabled);
        if (sw.checked) disabled.delete(p.id);
        else disabled.add(p.id);
        save({ disabled: [...disabled] });
      });
      attachDrag(li);
      return li;
    }),
  );

  const ka = $('keepalive');
  ka.replaceChildren(
    ...KEEP_ALIVE_OPTIONS.map(([minutes, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = s.settings.keepAliveMinutes === minutes ? 'on' : '';
      b.addEventListener('click', () => save({ keepAliveMinutes: minutes }));
      return b;
    }),
  );

  const nf = $<HTMLInputElement>('native-frame');
  nf.checked = s.settings.nativeFrame;
  $('relaunch').hidden = initialFrame === null || s.settings.nativeFrame === initialFrame;
}

nativeFrameInit();
function nativeFrameInit(): void {
  $<HTMLInputElement>('native-frame').addEventListener('change', (e) =>
    save({ nativeFrame: (e.target as HTMLInputElement).checked }),
  );
  $('relaunch').addEventListener('click', () => api.relaunch());
}

// Drag-to-reorder for the provider list.
let dragId: string | null = null;
function attachDrag(li: HTMLLIElement): void {
  li.addEventListener('dragstart', (e) => {
    dragId = li.dataset.id!;
    li.classList.add('dragging');
    e.dataTransfer!.effectAllowed = 'move';
  });
  li.addEventListener('dragend', () => {
    dragId = null;
    li.classList.remove('dragging');
    document.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  });
  li.addEventListener('dragover', (e) => {
    if (!dragId || dragId === li.dataset.id) return;
    e.preventDefault();
    const after = e.offsetY > li.offsetHeight / 2;
    li.classList.toggle('drop-after', after);
    li.classList.toggle('drop-before', !after);
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragId || !state) return;
    const after = li.classList.contains('drop-after');
    const order = state.settings.order.filter((id) => id !== dragId);
    const target = order.indexOf(li.dataset.id!);
    order.splice(after ? target + 1 : target, 0, dragId);
    save({ order });
  });
}

// ---------- state ----------

function render(s: AppState): void {
  state = s;
  if (initialFrame === null) initialFrame = s.settings.nativeFrame;
  renderPills(s);
  renderWindowControls(s);
  if (!overlay.hidden) renderSettings(s);
}

api.onState(render);
api.getState().then((s) => s && render(s));
