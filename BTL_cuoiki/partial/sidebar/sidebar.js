/* Menu theo vai trò. HTML/CSS của khung sidebar được dùng chung. */
window.renderSidebar = function (app) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const home = app.role === 'student' ? 'student/classes/classes.html' : 'teacher/overview/overview.html';
  sidebar.querySelector('.brand').href = new URL(home, app.base).href;
  sidebar.querySelector('.user-info small').textContent = app.role === 'student' ? 'Học sinh' : 'Giáo viên';
  if (app.role !== 'student') return;
  const nav = sidebar.querySelector('.nav');
  nav.replaceChildren();
  const icons = {
    classes: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
    assignments: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18M8 14h8M8 18h5"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    analytics: '<path d="M3 3v16a2 2 0 0 0 2 2h16M7 14v-4M12 14V6M17 14V9"/>',
    account: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>'
  };
  function icon(key) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + icons[key] + '</svg>'; }
  function link(parent, key, label, path, nested) {
    const a = document.createElement('a');
    a.href = new URL(path, app.base).href;
    a.dataset.page = path.split('/').pop().split('?')[0];
    a.dataset.key = key;
    a.className = nested ? '' : 'nav-link';
    a.innerHTML = icon(key);
    const span = document.createElement('span'); span.textContent = label; a.append(span);
    if (nested) { const li = document.createElement('li'); li.append(a); parent.append(li); }
    else parent.append(a);
  }
  link(nav, 'classes', 'Lớp học', 'student/classes/classes.html');
  link(nav, 'assignments', 'Danh sách bài', 'partial/assignment/assignment.html?role=student&phase=ongoing');
  const divider = document.createElement('hr'); divider.className = 'nav-divider'; nav.append(divider);
  const group = document.createElement('details'); group.className = 'nav-group'; group.open = true;
  const summary = document.createElement('summary'); summary.className = 'nav-link';
  summary.innerHTML = icon('analytics') + '<span>Kết quả</span><svg class="icon chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const list = document.createElement('ul'); list.className = 'nav-sub';
  link(list, 'history', 'Lịch sử bài làm', 'student/history/history.html', true);
  link(list, 'analytics', 'Phân tích học tập', 'student/analytics/analytics.html', true);
  group.append(summary, list); nav.append(group);
  link(nav, 'account', 'Tài khoản', 'partial/account/account.html');
  const account = nav.lastElementChild;
  account.dataset.accountLink = '';
  account.href = app.url('partial/account/account.html');
};
