/**
 * main.js - Nạp sidebar, topbar, footer dùng chung theo vai trò
 * và cho phép KÉO CHUỘT để thay đổi độ rộng sidebar.
 *
 * Mỗi trang HTML cần có:
 *   <div id="sidebar-slot"></div>
 *   <div class="main">
 *     <div id="topbar-slot"></div>
 *     <main class="content">...</main>
 *     <div id="footer-slot"></div>
 *   </div>
 *
 * và khai báo trước khi nạp file này:
 *   window.PAGE = { title: 'Danh sách lớp', breadcrumb: ['Lớp học', 'Danh sách lớp'] };
 *   (breadcrumb KHÔNG bao gồm "Trang chủ", vì mục này đã nằm sẵn trong topbar.html)
 *
 * Nạp bằng HTTP (Live Server). Đường dẫn partial tính theo vị trí connect.js.
 * Các slot được thay bằng thành phần thật để giữ bố cục flex và topbar sticky.
 */
(function () {
  'use strict';

  // Trang ??ng nh?p d?ng b? x? l? x?c th?c ? cu?i file.
  if (document.body.classList.contains('auth-page')) return;

  const layoutBase = new URL('./', document.currentScript.src);
  const page = window.PAGE || {};
  const params = new URLSearchParams(location.search);
  const sharedPage = /\/partial\/(account|policy)\//.test(location.pathname);
  const role = page.role === 'student' || location.pathname.includes('/student/')
    || (sharedPage && params.get('role') === 'student') ? 'student' : 'teacher';
  let authSession = null;
  try { authSession = JSON.parse(sessionStorage.getItem('learnova.auth.session.v1') || 'null'); } catch (_) {}
  const userId = page.userId || params.get('userId') || (authSession?.role === role ? authSession.id : null);
  document.addEventListener('account:logout', event => {
    event.preventDefault();
    try { sessionStorage.removeItem('learnova.auth.session.v1'); } catch (_) {}
    location.assign(new URL('index.html', layoutBase).href);
  });
  window.APP = { base: layoutBase, role: role, userId: userId, user: null };
  window.APP.url = function (path) {
    const url = new URL(path, layoutBase);
    url.searchParams.set('role', role);
    if (userId) url.searchParams.set('userId', userId);
    return url.href;
  };
  document.body.dataset.role = role;
  document.documentElement.classList.add('layout-loading');
  function loadScript(relative) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL(relative, layoutBase).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Không tải được ' + relative));
      document.head.appendChild(script);
    });
  }
  const PARTIALS = [
    { slot: '#sidebar-slot', url: new URL('partial/sidebar/sidebar.html', layoutBase), selector: '.sidebar' },
    { slot: '#topbar-slot', url: new URL('partial/topbar/topbar.html', layoutBase), selector: '.topbar' },
    { slot: '#footer-slot', url: new URL('partial/footer/footer.html', layoutBase), selector: '.footer' },
  ];

  /* ---- Cấu hình độ rộng sidebar (px) ---- */
  const STORAGE_KEY = 'learnova.sidebarWidth.v2';
  const COLLAPSED   = 76;    // dạng thu gọn, chỉ còn icon
  const MIN_OPEN    = 200;   // nhỏ nhất khi còn hiển thị chữ
  const MAX_OPEN    = 420;   // lớn nhất
  const SNAP        = 140;   // kéo hẹp hơn mức này thì tự thu gọn hẳn
  const KEY_STEP    = 16;    // mỗi lần bấm phím mũi tên

  const root = document.documentElement;

  /* ---------------------------------------------------------------
   * 1. NẠP PARTIAL
   * ------------------------------------------------------------- */
  async function loadPartial({ slot, url, selector }) {
    const el = document.querySelector(slot);
    if (!el) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const fragment = new DOMParser().parseFromString(await res.text(), 'text/html');
      const component = fragment.querySelector(selector);
      if (!component) throw new Error('Thiếu thành phần ' + selector);

      // URL trong partial phải tính từ chính file partial, không phải trang đang mở.
      component.querySelectorAll('[href], [src]').forEach((node) => {
        ['href', 'src'].forEach((attr) => {
          const value = node.getAttribute(attr);
          if (!value || value.startsWith('#')) return;
          node.setAttribute(attr, new URL(value, url).href);
        });
      });
      el.replaceWith(component);
    } catch (err) {
      console.error('[layout] Không nạp được ' + url + ':', err);
      const message = document.createElement('p');
      message.className = 'layout-error';
      message.setAttribute('role', 'alert');
      message.textContent = location.protocol === 'file:'
        ? 'Hãy mở trang bằng Live Server để tải các thành phần dùng chung.'
        : 'Không tải được giao diện dùng chung. Hãy tải lại trang.';
      el.replaceWith(message);
    }
  }

  /* ---------------------------------------------------------------
   * 2. MENU + TIÊU ĐỀ + BREADCRUMB
   * ------------------------------------------------------------- */
  function highlightActiveMenu() {
    const current = location.pathname.split('/').pop() || 'overview.html';
    document.querySelectorAll('.sidebar a[data-page]').forEach((a) => {
      const key = window.PAGE && window.PAGE.key;
      const selected = a.dataset.key ? a.dataset.key === ({
        'assignment-detail': 'assignments', exam: 'assignments', 'result-detail': 'history'
      }[key] || key) : a.dataset.page === current;
      a.classList.remove('is-active');
      a.removeAttribute('aria-current');
      if (!selected) return;
      a.setAttribute('aria-current', 'page');
      a.classList.add('is-active');
      const group = a.closest('details');
      if (group) group.open = true;
    });
  }

  function applyPageInfo() {
    const cfg = window.PAGE || {};
    const title = document.getElementById('pageTitle');
    const crumb = document.getElementById('breadcrumb');

    if (title) title.textContent = cfg.title || '';
    if (cfg.title) document.title = 'Learnova - ' + cfg.title;

    if (crumb && Array.isArray(cfg.breadcrumb)) {
      // Giữ mục Trang chủ; thêm breadcrumb bằng textContent.
      while (crumb.children.length > 1) crumb.lastElementChild.remove();
      cfg.breadcrumb.forEach((text, i) => {
        const item = document.createElement('li');
        item.textContent = text;
        if (i === cfg.breadcrumb.length - 1) item.setAttribute('aria-current', 'page');
        crumb.appendChild(item);
      });
    }
  }

  /** Khi thu gọn chỉ còn icon, gắn tooltip để biết đó là mục nào. */
  function addTooltips() {
    document.querySelectorAll('.sidebar .nav-link, .sidebar .nav-sub a').forEach((el) => {
      if (el.title) return;
      const label = el.querySelector('span');
      if (label) el.title = label.textContent.trim();
    });
  }

  /* ---------------------------------------------------------------
   * 3. KÉO CHUỘT ĐỂ ĐỔI ĐỘ RỘNG SIDEBAR
   * ------------------------------------------------------------- */
  let handle = null;
  let currentWidth = null;
  let defaultWidth = parseFloat(getComputedStyle(root).getPropertyValue('--sb-width')) || 244;
  let dragging = false;

  function maxOpen() {
    // Trên màn hình nhỏ không cho sidebar chiếm quá nửa chiều ngang
    return Math.max(MIN_OPEN, Math.min(MAX_OPEN, Math.round(window.innerWidth * 0.5)));
  }

  /** Chuẩn hóa vị trí chuột thành độ rộng hợp lệ (có "hút" về dạng thu gọn). */
  function normalize(x) {
    if (x < SNAP) return COLLAPSED;
    return Math.round(Math.min(maxOpen(), Math.max(MIN_OPEN, x)));
  }

  function readSaved() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(v) ? normalize(v) : null;
    } catch (e) { return null; }
  }

  function save(w) {
    try { localStorage.setItem(STORAGE_KEY, String(w)); }
    catch (e) { /* bỏ qua nếu trình duyệt chặn storage */ }
  }

  function applyWidth(w, persist) {
    currentWidth = w;
    root.style.setProperty('--sb-width', w + 'px');
    root.classList.add('sb-resizable');
    root.classList.toggle('sidebar-collapsed', w === COLLAPSED);
    if (handle) {
      handle.setAttribute('aria-valuenow', String(w));
      handle.setAttribute('aria-valuemax', String(maxOpen()));
    }
    if (persist) save(w);
  }

  /** Áp dụng độ rộng đã lưu ngay từ đầu để trang không bị giật khi nạp. */
  function applySavedEarly() {
    // Nếu .main chừa chỗ cho sidebar bằng margin-left thì CSS cần chỉnh margin đó theo.
    const main = document.querySelector('.main');
    if (main && parseFloat(getComputedStyle(main).marginLeft) > 0) {
      root.classList.add('sb-uses-margin');
    }
    const saved = window.innerWidth <= 640 ? COLLAPSED : readSaved();
    if (saved !== null) applyWidth(saved, false);
  }

  /** Đổi độ rộng bằng bàn phím: ← / → */
  function stepWidth(dir) {
    let w = currentWidth;
    if (dir < 0) {
      w = (w <= MIN_OPEN) ? COLLAPSED : normalize(w - KEY_STEP);
    } else {
      w = (w === COLLAPSED) ? MIN_OPEN : normalize(w + KEY_STEP);
    }
    applyWidth(w, true);
  }

  function createHandle() {
    handle = document.createElement('div');
    handle.className = 'sidebar-resizer';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Kéo để thay đổi độ rộng thanh điều hướng');
    handle.setAttribute('aria-valuemin', String(COLLAPSED));
    handle.tabIndex = 0;
    handle.title = 'Kéo để thay đổi độ rộng · Nhấp đúp để đặt lại';
    document.body.appendChild(handle);

    handle.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      root.classList.add('sb-dragging');
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const sb = document.querySelector('.sidebar');
      const left = sb ? sb.getBoundingClientRect().left : 0;
      applyWidth(normalize(e.clientX - left), false);
    });

    const stopDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* đã nhả */ }
      root.classList.remove('sb-dragging');
      save(currentWidth);
    };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    // Nhấp đúp: trả về độ rộng mặc định
    handle.addEventListener('dblclick', () => applyWidth(defaultWidth, true));

    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stepWidth(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepWidth(1); }
    });

    // Cửa sổ đổi kích thước: đảm bảo độ rộng vẫn nằm trong giới hạn
    window.addEventListener('resize', () => {
      if (currentWidth !== null) applyWidth(window.innerWidth <= 640 ? COLLAPSED : normalize(currentWidth), false);
    });
  }

  function initResize() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;

    defaultWidth = normalize(defaultWidth);

    createHandle();
    applyWidth(currentWidth !== null ? currentWidth : defaultWidth, false);
  }

  /* ---------------------------------------------------------------
   * 4. KHỞI TẠO
   * ------------------------------------------------------------- */
  async function init() {
    applySavedEarly();
    await Promise.all([
      ...PARTIALS.map(loadPartial),
      loadScript('partial/sidebar/sidebar.js'),
      loadScript('partial/topbar/topbar.js')
    ]);
    window.renderSidebar(window.APP);
    window.initTopbar(window.APP);
    document.querySelectorAll('[data-policy-link]').forEach(link => {
      link.href = window.APP.url('partial/policy/policy.html');
    });
    document.documentElement.classList.remove('layout-loading');
    highlightActiveMenu();
    applyPageInfo();
    addTooltips();
    initResize();

    // Bật hiệu ứng chuyển động sau khi mọi thứ đã vào đúng chỗ (tránh bị "nháy" lúc nạp trang)
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('sb-ready')));

    document.dispatchEvent(new CustomEvent('layout:ready'));
  }

  // Các script khác có thể chờ layout nạp xong:
  //   window.layoutReady.then(() => { ... });
  window.layoutReady = new Promise((resolve, reject) => {
    const start = () => init().then(resolve, reject);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });
  window.layoutReady.catch(error => {
    document.documentElement.classList.remove('layout-loading');
    console.error('[layout]', error);
    const message = document.createElement('p');
    message.className = 'layout-error';
    message.setAttribute('role', 'alert');
    message.textContent = 'Không tải được giao diện dùng chung. Hãy mở trang bằng Live Server và tải lại.';
    const content = document.querySelector('main.content');
    if (content) content.prepend(message);
  });
})();

/* Xác thực cho bản thực hành local. main.js vẫn là bộ nạp bố cục chung. */
(() => {
  'use strict';
  if (!document.body.classList.contains('auth-page')) return;
  const $ = id => document.getElementById(id);
  const USERS_KEY = 'learnova.auth.accounts.v1';
  const SESSION_KEY = 'learnova.auth.session.v1';
  const REMEMBER_KEY = 'learnova.auth.remember.v1';
  const collections = { teacher: 'teachers', student: 'students', parent: 'parents' };
  const defaultAccounts = { teacher: 'gv01', parent: 'ph01', student: 'hs01' };
  let db = null;
  let dataError = false;
  const ready = window.dataReady.then(value => { db = value; }).catch(() => { dataError = true; });
  function message(text, success = false) {
    $('auth-message').textContent = text;
    $('auth-message').classList.toggle('is-success', success);
    $('auth-message').hidden = false;
  }
  function setMode(mode) {
    const register = mode === 'register';
    ['login', 'register'].forEach(name => {
      const active = name === mode;
      $(name + '-tab').setAttribute('aria-selected', String(active));
      $(name + '-tab').tabIndex = active ? 0 : -1;
      $(name + '-panel').hidden = !active;
    });
    $('auth-title').textContent = register ? 'Bắt đầu cùng Learnova' : 'Chào mừng trở lại!';
    $('auth-subtitle').textContent = register ? 'Tạo tài khoản và mở ra những cơ hội học tập mới.' : 'Đăng nhập để tiếp tục học tập và kết nối.';
    document.title = (register ? 'Đăng ký' : 'Đăng nhập') + ' · Learnova';
    $('auth-message').hidden = true;
  }
  // Cho phép trang khách mở thẳng biểu mẫu đăng ký.
  function syncAuthHash() { setMode(location.hash === '#register' ? 'register' : 'login'); }
  syncAuthHash();
  window.addEventListener('hashchange', syncAuthHash);
  function accounts() {
    const value = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (!Array.isArray(value)) throw new Error('Invalid account storage');
    return value;
  }
  function seedUsers() {
    if (!db) return [];
    return Object.entries(collections).flatMap(([role, key]) => (db[key] || []).map((user, index) =>
      index === 0 ? { ...user, role, username: defaultAccounts[role], password: '123' } : user
    ));
  }
  function normalize(value) { return value.trim().toLowerCase(); }
  async function digest(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function busy(form, action) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try { await ready; await action(); }
    catch (error) {
      console.error('[Learnova auth]', error);
      message('Không thể xử lý tài khoản. Hãy mở bằng Live Server (localhost), cho phép lưu trữ trình duyệt và thử lại.');
    } finally { button.disabled = false; form.removeAttribute('aria-busy'); }
  }
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { setMode(button.dataset.mode); $(button.dataset.mode + '-tab').focus(); }));
  ['login', 'register'].forEach(mode => {
    $(mode + '-tab').addEventListener('click', () => setMode(mode));
    $(mode + '-tab').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'login' : event.key === 'End' ? 'register' : mode === 'login' ? 'register' : 'login';
      setMode(next); $(next + '-tab').focus();
    });
  });
  document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.password);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Ẩn' : 'Hiện';
    button.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    button.setAttribute('aria-pressed', String(show));
  }));
  try {
    const remembered = localStorage.getItem(REMEMBER_KEY);
    if (remembered) { $('login-identity').value = remembered; $('remember').checked = true; }
  } catch (_) { /* Form vẫn dùng được khi trình duyệt chặn lưu trữ. */ }
  $('forgot-password').addEventListener('click', () => message('Để được hỗ trợ đặt lại mật khẩu, liên hệ support@learnova.vn. Bản thực hành chưa hỗ trợ gửi email khôi phục.'));
  document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', async () => {
    await ready;
    const user = seedUsers().find(user => user.role === button.dataset.demo);
    if (!user) { message('Không tải được tài khoản mẫu. Hãy mở bằng Live Server và kiểm tra assets/data.csv.'); return; }
    $('login-identity').value = user.username || user.email;
    $('login-password').value = user.password || db.meta.demoPassword;
    $('login-password').type = 'password';
    const toggle = document.querySelector('[data-password="login-password"]');
    toggle.textContent = 'Hiện'; toggle.setAttribute('aria-pressed', 'false'); toggle.setAttribute('aria-label', 'Hiện mật khẩu');
    $('login-identity').focus();
  }));
  $('register-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    busy(form, async () => {
      if (dataError) { message('Chưa tải được dữ liệu để kiểm tra tài khoản trùng. Hãy mở bằng Live Server và tải lại trang.'); return; }
      const fullName = $('register-name').value.trim();
      const email = normalize($('register-email').value);
      const password = $('register-password').value;
      if (fullName.length < 2) { message('Vui lòng nhập họ và tên hợp lệ.'); $('register-name').focus(); return; }
      if (password.length < 8 || !/\p{L}/u.test(password) || !/\d/.test(password)) { message('Mật khẩu cần ít nhất 8 ký tự, bao gồm chữ và số.'); $('register-password').focus(); return; }
      if (password !== $('register-confirm').value) { message('Mật khẩu xác nhận chưa khớp.'); $('register-confirm').focus(); return; }
      const users = accounts();
      if ([...users, ...seedUsers()].some(user => normalize(user.email || '') === email || normalize(user.username || '') === email)) { message('Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.'); $('register-email').focus(); return; }
      const salt = crypto.randomUUID();
      users.push({ id: 'LOCAL-' + salt, fullName, email, username: email, role: $('register-role').value, salt, passwordHash: await digest(password, salt), createdAt: new Date().toISOString() });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      form.reset(); setMode('login');
      $('login-identity').value = email; $('login-password').value = '';
      message('Đăng ký thành công! Bạn có thể đăng nhập bằng tài khoản vừa tạo.', true);
      $('login-password').focus();
    });
  });
  $('login-form').addEventListener('submit', event => {
    event.preventDefault();
    busy(event.currentTarget, async () => {
      const identity = normalize($('login-identity').value);
      const password = $('login-password').value;
      const match = user => [user.email, user.username].some(value => value && normalize(value) === identity);
      const local = accounts().find(match);
      const seed = seedUsers().find(match);
      const user = local || seed;
      const valid = local ? await digest(password, local.salt) === local.passwordHash : seed && password === (seed.password || db.meta.demoPassword);
      if (!valid) { message(dataError && !local ? 'Không tải được dữ liệu tài khoản mẫu. Hãy chạy bằng Live Server và thử lại.' : 'Email, tên đăng nhập hoặc mật khẩu chưa đúng.'); $('login-password').focus(); return; }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, fullName: user.fullName, role: user.role, email: user.email, signedInAt: new Date().toISOString() }));
      if ($('remember').checked) localStorage.setItem(REMEMBER_KEY, identity);
      else localStorage.removeItem(REMEMBER_KEY);
      $('login-password').value = '';
      if (local) {
        message('Đăng nhập thành công, ' + user.fullName + '! Tài khoản mới chưa có dữ liệu lớp học. Các trang nội bộ hiện dùng hồ sơ mẫu; bạn có thể đăng nhập tài khoản có sẵn để trải nghiệm.', true);
        return;
      }
      const paths = { teacher: 'teacher/overview/overview.html', student: 'student/classes/classes.html', parent: 'parent/assignments/assignments.html' };
      const url = new URL(paths[user.role], location.href);
      url.searchParams.set('userId', user.id);
      url.searchParams.set('role', user.role);
      if (user.childIds?.length) url.searchParams.set('child', user.childIds[0]);
      message('Đăng nhập thành công. Đang mở không gian học tập…', true);
      location.assign(url.href);
    });
  });
})();
