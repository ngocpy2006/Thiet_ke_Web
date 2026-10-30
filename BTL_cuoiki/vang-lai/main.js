/* Tương tác trang công khai, không cần tải dữ liệu lớp học. */
(() => {
  'use strict';
  const menu = document.getElementById('site-nav');
  const toggle = document.querySelector('.menu-toggle');
  function closeMenu() {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Mở menu');
  }
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) { closeMenu(); toggle.focus(); }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
  const roles = {
    student: { title: 'Chủ động học, tự tin tiến bộ', description: 'Biết hôm nay cần làm gì, tập trung vào từng bài tập và nhìn lại kết quả sau mỗi lần cố gắng.', features: ['Xem lớp học và các bài được giao', 'Làm bài trực tuyến ngay trên trình duyệt', 'Xem lịch sử làm bài và kết quả học tập'], cta: 'Bắt đầu học tập', avatar: 'HS', preview: 'Học sinh chủ động', steps: [['Khám phá lớp học', 'Tìm bài học đang chờ bạn'], ['Tập trung luyện tập', 'Thử sức với từng câu hỏi'], ['Nhìn lại kết quả', 'Hiểu mình để tiến xa hơn']] },
    teacher: { title: 'Gọn việc quản lý, thêm thời gian dạy', description: 'Tổ chức lớp học, chuẩn bị bài tập và theo dõi kết quả để biết học sinh đang cần hỗ trợ ở đâu.', features: ['Quản lý lớp học và danh sách học sinh', 'Chuẩn bị câu hỏi và giao bài tập', 'Theo dõi bài nộp và phân tích kết quả'], cta: 'Khám phá cùng giáo viên', avatar: 'GV', preview: 'Giáo viên kết nối', steps: [['Tổ chức lớp học', 'Quản lý học sinh trong lớp'], ['Chuẩn bị và giao bài', 'Kết nối kiến thức với thực hành'], ['Theo dõi kết quả', 'Hiểu tiến độ, hỗ trợ đúng lúc']] },
    parent: { title: 'Hiểu việc học, đồng hành cùng con', description: 'Một góc nhìn rõ ràng về các bài được giao và kết quả học tập, để mỗi lời động viên đến đúng lúc.', features: ['Xem danh sách bài tập của con', 'Theo dõi trạng thái làm bài và kết quả', 'Xem báo cáo để hiểu hành trình học tập'], cta: 'Bắt đầu đồng hành', avatar: 'PH', preview: 'Phụ huynh đồng hành', steps: [['Xem việc học của con', 'Nắm các bài tập được giao'], ['Theo dõi kết quả', 'Hiểu những cố gắng mỗi ngày'], ['Cùng con tiến bộ', 'Thêm động viên, thêm vững bước']] }
  };
  const tabs = Array.from(document.querySelectorAll('[data-role]'));
  function selectRole(tab) {
    const data = roles[tab.dataset.role];
    tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
    document.getElementById('role-panel').setAttribute('aria-labelledby', tab.id);
    document.getElementById('role-title').textContent = data.title;
    document.getElementById('role-description').textContent = data.description;
    document.getElementById('role-features').replaceChildren(...data.features.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    const link = document.getElementById('role-link');
    link.replaceChildren(document.createTextNode(data.cta + ' '));
    const arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; link.append(arrow);
    document.getElementById('role-avatar').textContent = data.avatar;
    document.getElementById('role-preview').textContent = data.preview;
    ['one', 'two', 'three'].forEach((name, index) => {
      document.getElementById('preview-' + name).textContent = data.steps[index][0];
      document.getElementById('preview-' + name + '-detail').textContent = data.steps[index][1];
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectRole(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectRole(tabs[next]); tabs[next].focus(); }
    });
  });
  const quiz = document.getElementById('quiz-form');
  const result = document.getElementById('quiz-result');
  quiz.addEventListener('submit', event => {
    event.preventDefault();
    const correct = new FormData(quiz).get('answer') === '4';
    result.textContent = correct ? 'Chính xác! 2x = 14 − 6 = 8, vậy x = 4. Bạn đã sẵn sàng cho bài học tiếp theo!' : 'Chưa đúng, cùng xem lại nhé: chuyển 6 sang vế phải, ta có 2x = 8. Chia hai vế cho 2, được x = 4.';
    result.classList.toggle('correct', correct);
    result.hidden = false;
    document.getElementById('quiz-reset').hidden = false;
  });
  quiz.addEventListener('change', () => { result.hidden = true; });
  quiz.addEventListener('reset', () => { result.hidden = true; document.getElementById('quiz-reset').hidden = true; });
})();
