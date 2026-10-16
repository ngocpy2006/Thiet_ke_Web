/* Danh sách bài: HTML/CSS trong partial/assignment, dữ liệu từ assets/data.csv. */
window.pageReady = Promise.all([window.dataReady, window.layoutReady]).then(function () {
  "use strict";
  if (window.APP.role === "student") return window.renderStudentAssignments();
  const $ = id => document.getElementById(id);
  const PAGE_SIZE = 8;
  const phaseClass = { draft: "status-draft", upcoming: "status-upcoming", ongoing: "status-open", closed: "status-closed" };
  const state = { phase: "", query: "", classId: "", type: "", sort: "recent", page: 1 };
  const tabs = Array.from(document.querySelectorAll(".assignments-card [data-phase]"));
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fold = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const date = value => Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value)) : "—";
  const time = value => Number.isFinite(Date.parse(value)) ? timeFormat.format(new Date(value)) : "";
  const typeLabel = value => value === "kiem_tra" || value === "test" ? "Bài kiểm tra" : "Bài tập";
  const normalizeType = value => value === "test" ? "kiem_tra" : value === "homework" ? "bai_tap" : value;
  const docIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>';
  const eyeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';

  DB.classes.forEach(item => $("assignment-class").add(new Option(item.name, item.id)));
  const requestedClass = new URLSearchParams(location.search).get("lop");
  if (DB.classes.some(item => item.id === requestedClass)) {
    state.classId = requestedClass;
    $("assignment-class").value = requestedClass;
  }

  function recipients(assignment) {
    const names = (assignment.classIds || []).map(id => (DB.classes.find(item => item.id === id) || { name: id }).name);
    if ((assignment.studentIds || []).length) names.push(assignment.studentIds.length + " học sinh riêng");
    return names.join(", ") || "Chưa chọn";
  }
  function statistics(assignment) {
    const stats = Store.assignmentStats(assignment);
    const graded = DB.submissions.filter(item => item.assignmentId === assignment.id && item.status === "graded" && Number.isFinite(item.score10));
    stats.average = graded.length ? (graded.reduce((sum, item) => sum + item.score10, 0) / graded.length).toFixed(1) : "—";
    stats.percent = Math.round(stats.rate * 100);
    return stats;
  }
  function matches() {
    const query = fold(state.query.trim());
    return DB.assignments.filter(item => (!query || fold(item.title).includes(query))
      && (!state.type || normalizeType(item.type) === state.type)
      && (!state.classId || Store.targetsOf(item).some(student => student.classId === state.classId)
        || (item.classIds || []).includes(state.classId)));
  }
  function filtered(base) {
    const items = base.filter(item => !state.phase || Store.phaseOf(item) === state.phase);
    items.sort((a, b) => {
      const created = item => Date.parse(item.createdAt || item.publishedAt) || 0;
      if (state.sort === "old") return created(a) - created(b);
      if (state.sort === "deadline") {
        const due = item => Date.parse(item.dueAt) || Infinity;
        return due(a) - due(b);
      }
      return created(b) - created(a);
    });
    return items;
  }
  function render() {
    const base = matches();
    tabs.forEach(tab => {
      const active = tab.dataset.phase === state.phase;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.querySelector(".tab-count").textContent = base.filter(item => !tab.dataset.phase || Store.phaseOf(item) === tab.dataset.phase).length;
    });
    const items = filtered(base);
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * PAGE_SIZE;
    $("assignment-rows").innerHTML = items.slice(start, start + PAGE_SIZE).map(item => {
      const phase = Store.phaseOf(item);
      const stats = statistics(item);
      return '<tr data-assignment-id="' + esc(item.id) + '">'
        + '<td><div class="assignment-title"><span class="assignment-icon">' + docIcon + '</span><span><strong>' + esc(item.title) + '</strong><small>Tạo ' + date(item.createdAt) + '</small></span></div></td>'
        + '<td>' + esc(recipients(item)) + '</td><td><span class="type-badge ' + (normalizeType(item.type) === "kiem_tra" ? "type-test" : "type-homework") + '">' + typeLabel(item.type) + '</span></td>'
        + '<td>' + date(item.dueAt) + '<br><small>' + time(item.dueAt) + '</small></td>'
        + '<td class="progress-cell"><div class="progress-meta"><span>' + stats.submitted + '/' + stats.targets + ' học sinh</span><strong>' + stats.percent + '%</strong></div><div class="progress-track"><div class="progress-bar" style="width:' + Math.min(100, stats.percent) + '%"></div></div></td>'
        + '<td><span class="score">' + stats.average + '</span></td>'
        + '<td><span class="status-badge ' + phaseClass[phase] + '">' + Store.phaseLabels[phase] + '</span></td>'
        + '<td><button type="button" class="action-btn" data-view="' + esc(item.id) + '" aria-label="Xem bài: ' + esc(item.title) + '">' + eyeIcon + '</button></td></tr>';
    }).join("") || '<tr><td colspan="8" class="assignment-empty">Không có bài phù hợp với bộ lọc.</td></tr>';
    $("assignment-summary").textContent = items.length
      ? "Hiển thị " + (start + 1) + "–" + Math.min(start + PAGE_SIZE, items.length) + " trong " + items.length + " bài"
      : "Hiển thị 0 bài";
    const pagination = $("assignment-pages");
    pagination.replaceChildren();
    function pageButton(label, page, disabled, active) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-btn";
      button.textContent = label;
      button.disabled = disabled;
      button.setAttribute("aria-label", label === "‹" ? "Trang trước" : label === "›" ? "Trang sau" : "Trang " + page);
      if (active) { button.classList.add("is-active"); button.setAttribute("aria-current", "page"); }
      button.addEventListener("click", () => { state.page = page; render(); });
      pagination.append(button);
    }
    pageButton("‹", state.page - 1, state.page === 1, false);
    for (let page = 1; page <= pages; page++) pageButton(String(page), page, false, page === state.page);
    pageButton("›", state.page + 1, state.page === pages, false);
  }

  function selectTab(tab, focus) {
    state.phase = tab.dataset.phase;
    state.page = 1;
    render();
    $("assignments-panel").setAttribute("aria-labelledby", tab.id);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab, false));
    tab.addEventListener("keydown", event => {
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
        : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); selectTab(tabs[next], true); }
    });
  });
  $("assignment-search").addEventListener("input", event => { state.query = event.target.value; state.page = 1; render(); });
  [["assignment-class", "classId"], ["assignment-type", "type"], ["assignment-sort", "sort"]].forEach(([id, key]) => {
    $(id).addEventListener("change", event => { state[key] = event.target.value; state.page = 1; render(); });
  });

  function showDetails(id) {
    const assignment = DB.assignments.find(item => item.id === id);
    if (!assignment) return;
    const stats = statistics(assignment);
    const dialog = $("assignment-detail");
    $("assignment-detail-title").textContent = assignment.title;
    $("assignment-detail-content").innerHTML =
      '<p class="assignment-description">' + esc(assignment.description || "Chưa có mô tả.") + '</p>'
      + '<dl class="assignment-facts">'
      + '<div><dt>Lớp / học sinh</dt><dd>' + esc(recipients(assignment)) + '</dd></div>'
      + '<div><dt>Loại bài</dt><dd>' + typeLabel(assignment.type) + '</dd></div>'
      + '<div><dt>Trạng thái</dt><dd>' + Store.phaseLabels[Store.phaseOf(assignment)] + '</dd></div>'
      + '<div><dt>Bắt đầu</dt><dd>' + date(assignment.startAt) + ' ' + time(assignment.startAt) + '</dd></div>'
      + '<div><dt>Hạn nộp</dt><dd>' + date(assignment.dueAt) + ' ' + time(assignment.dueAt) + '</dd></div>'
      + '<div><dt>Thời gian làm bài</dt><dd>' + (assignment.durationMinutes ? esc(assignment.durationMinutes) + ' phút' : 'Không giới hạn') + '</dd></div>'
      + '<div><dt>Đã nộp</dt><dd>' + stats.submitted + '/' + stats.targets + ' học sinh</dd></div>'
      + '<div><dt>Điểm trung bình / 10</dt><dd>' + stats.average + '</dd></div>'
      + '<div><dt>Điểm tối đa</dt><dd>' + esc(assignment.totalPoints) + '</dd></div></dl>'
      + '<h4>Câu hỏi (' + assignment.items.length + ')</h4><ol class="assignment-questions">'
      + assignment.items.map(item => {
        const question = DB.questions.find(record => record.id === item.questionId);
        return '<li>' + esc(question ? question.content : "Không tìm thấy câu hỏi " + item.questionId) + ' <small>(' + esc(item.points) + ' điểm)</small></li>';
      }).join("") + '</ol>';
    if (!dialog.open) dialog.showModal();
  }
  $("assignment-rows").addEventListener("click", event => {
    const button = event.target.closest("[data-view]");
    if (button) showDetails(button.dataset.view);
  });
  $("assignment-detail").addEventListener("click", event => {
    if (event.target === $("assignment-detail")) $("assignment-detail").close();
  });
  render();
  const requestedId = new URLSearchParams(location.search).get("id");
  if (requestedId) showDetails(requestedId);
}).catch(window.reportDataError);
