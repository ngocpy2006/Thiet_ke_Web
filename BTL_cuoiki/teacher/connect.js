/**
 * connect.js - Nạp sidebar, topbar, footer dùng chung cho các trang giáo viên
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

  const layoutBase = new URL('../', document.currentScript.src);
  const PARTIALS = [
    { slot: '#sidebar-slot', url: new URL('partial/sidebar/sidebar.html', layoutBase), selector: '.sidebar' },
    { slot: '#topbar-slot', url: new URL('partial/topbar/topbar.html', layoutBase), selector: '.topbar' },
    { slot: '#footer-slot', url: new URL('partial/footer/footer.html', layoutBase), selector: '.footer' },
  ];

  /* ---- Cấu hình độ rộng sidebar (px) ---- */
  const STORAGE_KEY = 'learnova.sidebarWidth';
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
      if (a.dataset.page !== current) return;
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
    const saved = readSaved();
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
      if (currentWidth !== null) applyWidth(normalize(currentWidth), false);
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
    await Promise.all(PARTIALS.map(loadPartial));
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
  window.layoutReady = new Promise((resolve) => {
    const start = () => init().then(resolve);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });
})();