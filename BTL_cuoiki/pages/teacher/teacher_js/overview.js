/* Learnova – Trang Tổng quan (giáo viên). Cần nạp data.js TRƯỚC file này. */
(function () {
  "use strict";
  var DAY = 864e5, now = Date.now();
  var $ = function (id) { return document.getElementById(id); };

  if (!window.DB || !window.Store) {
    $("stats").innerHTML = '<p class="card empty">Không nạp được <code>data.js</code>. Hãy kiểm tra lại đường dẫn thẻ &lt;script&gt;.</p>';
    return;
  }

  var P = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    right: '<path d="m9 18 6-6-6-6"/>'
  };
  var svg = function (n) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + '</svg>'; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (iso) { var d = new Date(iso); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  function ago(iso) {
    var m = Math.floor((Date.now() - Date.parse(iso)) / 6e4);
    if (m < 1) return "Vừa xong";
    if (m < 60) return m + " phút trước";
    var h = Math.floor(m / 60); if (h < 24) return h + " giờ trước";
    var d = Math.floor(h / 24); return d < 30 ? d + " ngày trước" : fmt(iso);
  }
  function range(a, b) {
    var x = new Date(a), y = new Date(b);
    return x.getMonth() === y.getMonth()
      ? pad(x.getDate()) + " - " + pad(y.getDate()) + " Thg " + (y.getMonth() + 1)
      : pad(x.getDate()) + " Thg " + (x.getMonth() + 1) + " - " + pad(y.getDate()) + " Thg " + (y.getMonth() + 1);
  }

  var cn = {}, A = {}, S = {};
  DB.classes.forEach(function (c) { cn[c.id] = c.name; });
  DB.assignments.forEach(function (a) { A[a.id] = a; });
  DB.students.forEach(function (s) { S[s.id] = s; });
  var who = function (a) { return a.classIds.length ? a.classIds.map(function (i) { return cn[i]; }).join(", ") : a.studentIds.length + " học sinh"; };
  function dueTxt(a) {
    var d = new Date(a.dueAt), t = new Date(now); d.setHours(0, 0, 0, 0); t.setHours(0, 0, 0, 0);
    var n = Math.round((d - t) / DAY);
    return n < 0 ? "Quá hạn " + (-n) + " ngày" : n === 0 ? "Hạn hôm nay" : "Hạn " + n + " ngày";
  }
  var teacher = DB.teachers[0];

  /* ---------- Lời chào ---------- */
  $("greet").textContent = "Chào cô " + teacher.fullName.split(" ").pop() + "! Đây là những thông tin chính trong tuần này.";

  /* ---------- 4 thẻ số liệu ---------- */
  var ov = Store.overview(), wk = Store.weeklyProgress(null, 4), cur = wk[3].completion, prev = wk[2].completion;
  var soon48 = DB.assignments.filter(function (a) { return Store.phaseOf(a, now) === "ongoing" && Date.parse(a.dueAt) - now < 2 * DAY; }).length;
  var pending = DB.submissions.filter(function (s) { return s.status === "submitted"; }).length;
  var delta = cur != null && prev != null ? cur - prev : null;
  var cards = [
    { t: "Lớp đang dạy", v: ov.activeClasses, s: ov.totalStudents + " học sinh", i: "users", c: "blue" },
    { t: "Bài đang giao", v: ov.ongoingAssignments, s: soon48 + " bài sắp hết hạn", i: "file", c: "purple" },
    { t: "Tỷ lệ hoàn thành", v: cur == null ? "—" : cur + "%", i: "check", c: "green",
      s: delta == null ? "Chưa đủ dữ liệu so sánh" : '<b class="' + (delta >= 0 ? "up" : "down") + '">' + (delta > 0 ? "+" : "") + delta + '%</b> so với tuần trước' },
    { t: "Cần xử lý", v: pending, s: "Bài tự luận chưa chấm", i: "alert", c: "red" }
  ];
  $("stats").innerHTML = cards.map(function (c) {
    return '<a class="stat" href="#"><span class="tile ' + c.c + '">' + svg(c.i) + '</span><div class="stat-body">' +
      '<div class="stat-label"><span>' + c.t + '</span>' + svg("right") + '</div>' +
      '<p class="stat-value">' + c.v + '</p><p class="stat-sub" style="margin:0">' + c.s + '</p></div></a>';
  }).join("");

  /* ---------- Biểu đồ tiến độ hoàn thành ---------- */
  function chart(weeks) {
    var d = Store.weeklyProgress(null, weeks), last = d.length - 1;
    var grid = [100, 80, 60, 40, 20, 0].map(function (v) { return '<i class="gl" style="bottom:' + v + '%"><span>' + v + '%</span></i>'; }).join("");
    var cols = d.map(function (w, i) {
      return '<div class="g" title="' + w.label + ": " + w.assignments + ' bài">' + (w.completion == null ? "<em>—</em>"
        : '<div class="b' + (i === last ? " now" : "") + '" style="--h:' + w.completion + '%"><span>' + w.completion + "%</span></div>") + "</div>";
    }).join("");
    var xs = d.map(function (w) { return "<div><b>" + w.label + "</b><small>" + range(w.from, w.to) + "</small></div>"; }).join("");
    var el = $("chart");
    el.setAttribute("aria-label", "Tỷ lệ nộp bài theo tuần: " + d.map(function (w) { return w.label + " " + (w.completion == null ? "chưa có dữ liệu" : w.completion + "%"); }).join(", "));
    el.innerHTML = '<div class="plot">' + grid + '<div class="groups">' + cols + '</div></div><div class="xl">' + xs + "</div>";
  }
  chart(4);
  $("fPeriod").addEventListener("change", function (e) { chart(+e.target.value); });

  /* ---------- Việc cần xử lý ---------- */
  var todo = [], pend = {};
  DB.submissions.forEach(function (s) { if (s.status === "submitted") pend[s.assignmentId] = (pend[s.assignmentId] || 0) + 1; });
  var top = Object.keys(pend).sort(function (x, y) { return pend[y] - pend[x]; })[0];
  if (top) todo.push({ k: "bad", t: "Chấm " + pend[top] + " bài tự luận", s: A[top].title + " · " + who(A[top]) + " · " + dueTxt(A[top]), n: pend[top] });
  var drafts = DB.assignments.filter(function (a) { return !a.published; });
  if (drafts.length) todo.push({ k: "warn", t: "Hoàn thiện bài nháp", s: drafts[0].title + " · " + who(drafts[0]), n: drafts.length });
  var next = DB.assignments.filter(function (a) { return Store.phaseOf(a, now) === "ongoing"; })
    .sort(function (x, y) { return Date.parse(x.dueAt) - Date.parse(y.dueAt); })[0];
  if (next) { var ns = Store.assignmentStats(next), miss = ns.targets - ns.submitted;
    if (miss > 0) todo.push({ k: "warn", t: miss + " học sinh chưa nộp bài", s: next.title + " · " + dueTxt(next), n: miss }); }
  var unread = DB.notifications.filter(function (n) { return n.userId === teacher.id && !n.read; }).length;
  if (unread) todo.push({ k: "info", t: "Thông báo chưa đọc", s: "Có hoạt động mới từ học sinh", n: unread });
  $("todo").innerHTML = todo.length ? todo.map(function (x) {
    return '<li><i class="dot ' + x.k + '"></i><div class="todo-main"><b>' + esc(x.t) + "</b><small>" + esc(x.s) + '</small></div><span class="pill ' + x.k + '">' + x.n + "</span></li>";
  }).join("") : '<li class="empty">Không có việc nào cần xử lý.</li>';

  /* ---------- Bài tập & kiểm tra gần đây ---------- */
  var recent = DB.assignments.filter(function (a) { return a.published; })
    .sort(function (x, y) { return Date.parse(y.publishedAt) - Date.parse(x.publishedAt); }).slice(0, 5);
  $("recent").innerHTML = recent.map(function (a) {
    var r = Store.phaseOf(a, now) === "upcoming" ? null : Math.round(Store.assignmentStats(a).rate * 100);
    return "<tr><td>" + esc(a.title) + '</td><td class="muted">' + esc(who(a)) + '</td><td class="muted">' + fmt(a.startAt) + '</td><td class="muted">' + fmt(a.dueAt) + "</td><td>" +
      (r == null ? '<span class="muted">Sắp giao</span>' : '<div class="rate"><i><s class="' + (r >= 90 ? "hi" : "") + '" style="width:' + r + '%"></s></i><span>' + r + "%</span></div>") +
      "</td><td>" + svg("right") + "</td></tr>";
  }).join("");

  /* ---------- Hoạt động học sinh gần đây ---------- */
  $("acts").innerHTML = DB.submissions.slice().sort(function (x, y) { return x.submittedAt < y.submittedAt ? 1 : -1; }).slice(0, 4).map(function (s) {
    var st = S[s.studentId], a = A[s.assignmentId], ini = st.fullName.trim().split(" ").pop().charAt(0);
    return '<li><span class="av t' + (ini.charCodeAt(0) % 4) + '">' + esc(ini) + '</span><div class="act-main"><b>' + esc(st.fullName) +
      "</b><small>đã nộp bài " + esc(a.title) + " (" + esc(cn[st.classId]) + ")</small></div><time>" + ago(s.submittedAt) + "</time></li>";
  }).join("");

  /* ---------- Chấm đỏ chuông thông báo ---------- */
  var dot = document.querySelector(".bell-dot"), bell = document.querySelector(".bell");
  if (dot) dot.hidden = !unread;
  if (bell) bell.setAttribute("aria-label", unread ? "Thông báo (" + unread + " chưa đọc)" : "Thông báo");
})();
