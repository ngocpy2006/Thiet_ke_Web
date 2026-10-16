/* Vue học sinh của danh sách bài chung; giữ nội dung mẫu và bố cục đã bàn giao. */
window.renderStudentAssignments = async function () {
  const main = document.querySelector('main.content');
  const response = await fetch(new URL('partial/assignment/student-assignment.html', window.APP.base));
  if (!response.ok) throw new Error('Không tải được danh sách bài học sinh (HTTP ' + response.status + ').');
  const fragment = new DOMParser().parseFromString(await response.text(), 'text/html');
  main.replaceChildren(...Array.from(fragment.body.childNodes));
  main.classList.add('student-page', 'student-assignments');
  const dialog = document.getElementById('assignment-detail');
  if (dialog) dialog.remove();
  const valid = ['closed', 'ongoing', 'upcoming'];
  let phase = new URLSearchParams(location.search).get('phase');
  if (!valid.includes(phase)) phase = 'ongoing';
  function render() {
    const template = document.getElementById('student-table-' + phase);
    document.getElementById('student-assignment-table').replaceChildren(template.content.cloneNode(true));
    document.querySelectorAll('.student-assignments .tabs a').forEach(link => {
      const selected = new URL(link.href).searchParams.get('phase') === phase;
      link.classList.toggle('is-active', selected);
      if (selected) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const stats = main.querySelector('.stats-grid');
    if (stats) stats.hidden = phase === 'upcoming';
  }
  main.querySelector('.tabs').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    event.preventDefault();
    phase = new URL(link.href).searchParams.get('phase');
    history.pushState(null, '', link.href);
    render();
  });
  window.addEventListener('popstate', () => {
    const next = new URLSearchParams(location.search).get('phase');
    phase = valid.includes(next) ? next : 'ongoing';
    render();
  });
  render();
};
