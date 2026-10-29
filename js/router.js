// Маршрутизация по hash: #/topics/math → { name: 'topics', params: ['math'] }.
// Hash-маршруты работают на любом статическом хостинге, в том числе GitHub Pages.

export function parseHash(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = clean.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return { name: parts[0] || 'home', params: parts.slice(1) };
}

export function href(name, ...params) {
  if (name === 'home') return '#/';
  return `#/${[name, ...params].map((p) => encodeURIComponent(p)).join('/')}`;
}

export function navigate(name, ...params) {
  const target = href(name, ...params);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Хуки «можно ли уйти»: экран тренировки ставит подтверждение выхода. */
let leaveGuard = null;
export function setLeaveGuard(fn) {
  leaveGuard = fn;
}

export function startRouter(render) {
  let current = location.hash;
  let busy = false;
  const onChange = async () => {
    if (busy) return;
    if (leaveGuard && location.hash !== current) {
      const target = location.hash;
      busy = true;
      history.replaceState(null, '', current || '#/');
      const ok = await leaveGuard();
      busy = false;
      if (!ok) return;
      leaveGuard = null;
      history.replaceState(null, '', target);
    }
    current = location.hash;
    render(parseHash(location.hash));
  };
  window.addEventListener('hashchange', onChange);
  render(parseHash(location.hash));
}
