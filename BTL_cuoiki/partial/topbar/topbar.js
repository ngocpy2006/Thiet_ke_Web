/* Menu tài khoản và thông tin người dùng dùng chung cho mọi trang. */
window.initTopbar = function (app) {
  const roleLabel = app.role === 'student' ? 'Học sinh' : 'Giáo viên';
  const home = app.role === 'student' ? 'student/classes/classes.html' : 'teacher/overview/overview.html';
  const homeLink = document.querySelector('#breadcrumb li:first-child a');
  if (homeLink) homeLink.href = new URL(home, app.base).href;
  document.querySelectorAll('.user-info small, .account-info small').forEach(el => { el.textContent = roleLabel; });
  document.querySelectorAll('[data-account-link]').forEach(link => {
    const hash = new URL(link.href).hash;
    link.href = app.url('partial/account/account.html') + hash;
  });
  const account = document.querySelector('.topbar .account');
  const menu = document.getElementById('account-menu');
  const items = menu ? Array.from(menu.querySelectorAll('[role="menuitem"]')) : [];
  function setOpen(open, focusIndex) {
    if (!account || !menu) return;
    menu.hidden = !open;
    account.setAttribute('aria-expanded', String(open));
    if (open && focusIndex !== undefined) items[focusIndex].focus();
  }
  if (account && menu) {
    account.addEventListener('click', () => setOpen(menu.hidden));
    account.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true, event.key === 'ArrowDown' ? 0 : items.length - 1);
      }
    });
    menu.addEventListener('keydown', event => {
      const index = items.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % items.length;
      if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      if (next !== undefined) { event.preventDefault(); items[next].focus(); }
    });
    menu.addEventListener('click', event => {
      if (event.target.closest('[role="menuitem"]')) setOpen(false);
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.account-dropdown')) setOpen(false);
    });
    document.addEventListener('focusin', event => {
      if (!event.target.closest('.account-dropdown')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) {
        event.preventDefault(); setOpen(false); account.focus();
      }
    });
  }
  // Chưa có hệ thống đăng nhập trong dự án. Cho phép bộ xác thực nối xử lý sau.
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-logout]')) return;
    setOpen(false);
    const logout = new CustomEvent('account:logout', { cancelable: true });
    if (document.dispatchEvent(logout)) {
      window.alert('Chức năng đăng xuất chưa được kết nối với hệ thống đăng nhập.');
    }
    if (account) account.focus();
  });
  function sync() {
    if (!window.DB) return;
    const people = app.role === 'student' ? DB.students : DB.teachers;
    const user = people.find(person => person.id === app.userId) || people[0];
    if (!user) return;
    app.user = { id: user.id, fullName: user.fullName, role: app.role, classId: user.classId };
    document.querySelectorAll('.user-info strong, .account-info strong').forEach(el => { el.textContent = user.fullName; });
    const initials = user.fullName.trim().split(/\s+/).slice(-2).map(word => word[0]).join('');
    document.querySelectorAll('.user-avatar > span, .account-avatar').forEach(el => { el.textContent = initials; });
    const unread = DB.notifications.filter(item => item.userId === user.id && !item.read).length;
    const dot = document.querySelector('.bell-dot'); if (dot) dot.hidden = !unread;
    const bell = document.querySelector('.bell');
    if (bell) bell.setAttribute('aria-label', unread ? 'Thông báo (' + unread + ' chưa đọc)' : 'Thông báo');
    const email = document.querySelector('.footer-admin a');
    if (email && DB.adminContact && DB.adminContact.email) {
      email.href = 'mailto:' + DB.adminContact.email;
      Array.from(email.childNodes).filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
      email.append(document.createTextNode(DB.adminContact.email));
    }
  }
  document.addEventListener('data:ready', sync);
  sync();
};
