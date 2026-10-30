/* Xác thực cho bản thực hành local. main.js vẫn là bộ nạp bố cục chung. */
(() => {
  'use strict';
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
