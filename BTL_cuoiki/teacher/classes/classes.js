/* Learnova – Trang Danh sách lớp (giáo viên). Chờ data-loader.js nạp CSV trước khi hiển thị. */
window.pageReady = Promise.all([window.dataReady, window.layoutReady]).then(function () {
  "use strict";
  var STUDENT_PAGE = "students.html"; // đổi cho khớp tên trang "Danh sách học sinh" của bạn (nhận ?lop=<id lớp>)
  var PAGE_SIZE = 8;
  var $ = function (id) { return document.getElementById(id); };


  var P = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    dot: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    cal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
  };
  var svg = function (n) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + "</svg>"; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (iso) { var d = new Date(iso); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  var fold = function (s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); };
  var slug = function (s) { return fold(s).toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  var codeOf = function (c) { return c.code || slug(c.subject) + "-" + c.name.toUpperCase(); };
  var link = function (c) { return STUDENT_PAGE + "?lop=" + encodeURIComponent(c.id); };
  var byId = function (id) { return DB.classes.filter(function (c) { return c.id === id; })[0]; };

  var st = { q: "", status: "", sort: "name", view: "list", page: 1 }, editing = null, menuId = null, timer;

  /* ---------- Dữ liệu hiển thị: sĩ số + hoạt động gần nhất của từng lớp ---------- */
  function model() {
    var cnt = {}, last = {};
    DB.students.forEach(function (s) { cnt[s.classId] = (cnt[s.classId] || 0) + 1; });
    DB.assignments.forEach(function (a) {
      if (!a.published) return;
      var seen = {};
      Store.targetsOf(a).forEach(function (s) {
        if (seen[s.classId]) return;
        seen[s.classId] = 1;
        if (!last[s.classId] || a.publishedAt > last[s.classId].publishedAt) last[s.classId] = a;
      });
    });
    return DB.classes.map(function (c) { return { c: c, n: cnt[c.id] || 0, a: last[c.id] || null, title: c.subject + " " + c.name, code: codeOf(c) }; });
  }

  /* ---------- Thẻ số liệu ---------- */
  function stats(all) {
    var act = all.filter(function (r) { return r.c.status === "active"; }).length;
    var stu = all.reduce(function (s, r) { return s + r.n; }, 0);
    var cards = [
      ["Tổng số lớp", all.length, "", "users", "blue"],
      ["Tổng học sinh", stu, all.length ? "Trung bình " + Math.round(stu / all.length) + " học sinh/lớp" : "—", "users", "purple"],
      ["Đang hoạt động", act, "Đang giảng dạy", "dot", "green"],
      ["Lưu trữ", all.length - act, "Không còn giảng dạy", "cal", "gray"]
    ];
    $("stats").innerHTML = cards.map(function (c) {
      return '<div class="stat static"><span class="tile ' + c[4] + '">' + svg(c[3]) + '</span><div class="stat-body"><div class="stat-label"><span>' + c[0] +
        '</span></div><p class="stat-value">' + c[1] + '</p><p class="stat-sub" style="margin:0">' + c[2] + "</p></div></div>";
    }).join("");
  }

  /* ---------- Dựng bảng / lưới ---------- */
  var act = function (r) { return r.a ? "<div>Giao bài: " + esc(r.a.title) + "</div><small>" + fmt(r.a.publishedAt) + "</small>" : '<span class="muted">Không có hoạt động gần đây</span>'; };
  var badge = function (c) { return c.status === "active" ? '<span class="badge ok">Đang hoạt động</span>' : '<span class="badge off">Lưu trữ</span>'; };
  var more = function (r) { return '<button class="more" type="button" data-id="' + esc(r.c.id) + '" aria-haspopup="menu" aria-label="Thao tác lớp ' + esc(r.title) + '">' + svg("dots") + "</button>"; };
  var name = function (r) { return '<a class="cls-link" href="' + esc(link(r.c)) + '"><b>' + esc(r.title) + "</b></a>"; };

  function table(part) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Tên lớp</th><th>Mã lớp</th><th>Sĩ số</th><th>Trạng thái</th><th>Hoạt động gần đây</th><th>Thao tác</th></tr></thead><tbody>' +
      part.map(function (r) {
        return "<tr><td>" + name(r) + '</td><td class="muted">' + esc(r.code) + "</td><td>" + r.n + "</td><td>" + badge(r.c) + '</td><td class="act">' + act(r) + "</td><td>" + more(r) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function grid(part) {
    return '<div class="cgrid">' + part.map(function (r) {
      return '<article class="ccard"><div class="ch">' + name(r) + more(r) + '</div><small class="muted">' + esc(r.code) + " · " + r.n + " học sinh</small><div>" + badge(r.c) + '</div><div class="act">' + act(r) + "</div></article>";
    }).join("") + "</div>";
  }
  function pager(pages) {
    var h = '<button type="button" data-p="' + (st.page - 1) + '" aria-label="Trang trước"' + (st.page <= 1 ? " disabled" : "") + ">‹</button>";
    for (var i = 1; i <= pages; i++) h += '<button type="button" data-p="' + i + '"' + (i === st.page ? ' aria-current="page"' : "") + ">" + i + "</button>";
    $("pager").innerHTML = h + '<button type="button" data-p="' + (st.page + 1) + '" aria-label="Trang sau"' + (st.page >= pages ? " disabled" : "") + ">›</button>";
  }

  function render() {
    var all = model(); stats(all);
    var q = fold(st.q.trim());
    var rows = all.filter(function (r) { return (!st.status || r.c.status === st.status) && (!q || fold(r.title + " " + r.code).indexOf(q) >= 0); });
    rows.sort(function (x, y) {
      if (st.sort === "size") return y.n - x.n;
      if (st.sort === "recent") return (y.a ? Date.parse(y.a.publishedAt) : 0) - (x.a ? Date.parse(x.a.publishedAt) : 0);
      return x.c.name.localeCompare(y.c.name, "vi", { numeric: true });
    });
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); st.page = Math.min(st.page, pages);
    var from = (st.page - 1) * PAGE_SIZE, part = rows.slice(from, from + PAGE_SIZE);
    $("view").innerHTML = !part.length ? '<p class="empty">Không tìm thấy lớp phù hợp.</p>' : st.view === "grid" ? grid(part) : table(part);
    $("info").textContent = rows.length ? "Hiển thị " + (from + 1) + " - " + (from + part.length) + " trên " + rows.length + " lớp" : "Không có lớp nào";
    pager(pages);
  }

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(timer); timer = setTimeout(function () { t.classList.remove("show"); }, 2500);
  }

  /* ---------- Tìm kiếm / lọc / sắp xếp / đổi kiểu xem / phân trang ---------- */
  $("q").addEventListener("input", function (e) { st.q = e.target.value; st.page = 1; render(); });
  $("fStatus").addEventListener("change", function (e) { st.status = e.target.value; st.page = 1; render(); });
  $("fSort").addEventListener("change", function (e) { st.sort = e.target.value; st.page = 1; render(); });
  [["vList", "list"], ["vGrid", "grid"]].forEach(function (p) {
    $(p[0]).addEventListener("click", function () {
      st.view = p[1];
      $("vList").setAttribute("aria-pressed", st.view === "list"); $("vGrid").setAttribute("aria-pressed", st.view === "grid");
      render();
    });
  });
  $("pager").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-p]"); if (!b || b.disabled) return;
    st.page = +b.dataset.p; render();
  });

  /* ---------- Menu thao tác ---------- */
  var menu = $("menu");
  function closeMenu() { menu.hidden = true; menuId = null; }
  $("view").addEventListener("click", function (e) {
    var b = e.target.closest(".more"); if (!b) return;
    var same = menuId === b.dataset.id && !menu.hidden; closeMenu(); if (same) return;
    menuId = b.dataset.id;
    var c = byId(menuId);
    $("mView").href = link(c);
    $("mArchive").textContent = c.status === "active" ? "Lưu trữ lớp" : "Khôi phục lớp";
    menu.hidden = false;
    var r = b.getBoundingClientRect();
    menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8) + "px";
    menu.style.left = Math.max(8, r.right - menu.offsetWidth) + "px";
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".menu, .more")) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);

  menu.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var c = byId(menuId); closeMenu(); if (!c) return;
    if (b.dataset.act === "edit") return openForm(c);
    if (b.dataset.act === "archive") {
      c.status = c.status === "active" ? "archived" : "active"; Store.save(); render();
      return toast(c.status === "active" ? "Đã khôi phục lớp " + c.name : "Đã lưu trữ lớp " + c.name);
    }
    var n = DB.students.filter(function (s) { return s.classId === c.id; }).length;
    if (n > 0) return alert("Lớp " + c.name + " còn " + n + " học sinh nên không thể xóa. Bạn có thể lưu trữ lớp thay vì xóa.");
    if (!confirm("Xóa lớp " + c.name + "? Hành động này không thể hoàn tác.")) return;
    DB.classes.splice(DB.classes.indexOf(c), 1);
    DB.assignments.forEach(function (a) { a.classIds = a.classIds.filter(function (i) { return i !== c.id; }); });
    Store.save(); render(); toast("Đã xóa lớp " + c.name);
  });

  /* ---------- Hộp thoại thêm / sửa lớp ---------- */
  var dlg = $("dlg"), form = $("form");
  function showErr(err) {
    Array.prototype.forEach.call(form.querySelectorAll("[data-err]"), function (el) {
      var m = err[el.dataset.err] || ""; el.textContent = m; el.parentNode.classList.toggle("bad", !!m);
    });
  }
  function openForm(c) {
    editing = c || null;
    var f = form.elements;
    $("dlgTitle").textContent = c ? "Chỉnh sửa lớp" : "Thêm lớp";
    f.cname.value = c ? c.name : ""; f.grade.value = c ? c.grade : "10"; f.subject.value = c ? c.subject : "Toán";
    f.room.value = c && c.room ? c.room : ""; f.desc.value = c && c.description ? c.description : "";
    showErr({}); dlg.showModal(); f.cname.focus();
  }
  $("btnAdd").addEventListener("click", function () { openForm(null); });
  $("cancel").addEventListener("click", function () { dlg.close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements, nm = f.cname.value.trim().toUpperCase().replace(/\s+/g, ""), subject = f.subject.value.trim(), err = {};
    if (!nm) err.cname = "Vui lòng nhập tên lớp.";
    else if (!/^[0-9A-Z]{2,12}$/.test(nm)) err.cname = "Tên lớp chỉ gồm chữ và số, ví dụ 10A1.";
    else if (DB.classes.some(function (c) { return c !== editing && c.name.toUpperCase() === nm; })) err.cname = "Tên lớp này đã tồn tại.";
    if (!subject) err.subject = "Vui lòng nhập môn học.";
    showErr(err); if (Object.keys(err).length) return;
    var data = { name: nm, grade: +f.grade.value, subject: subject, code: slug(subject) + "-" + nm, room: f.room.value.trim(), description: f.desc.value.trim() };
    if (editing) Object.assign(editing, data);
    else {
      var id = "L" + nm; while (byId(id)) id += "_";
      DB.classes.push(Object.assign({ id: id, teacherId: DB.teachers[0].id, schoolYear: DB.meta.schoolYear, status: "active", createdAt: new Date().toISOString() }, data));
    }
    Store.save(); dlg.close(); render(); toast(editing ? "Đã cập nhật lớp " + nm : "Đã thêm lớp " + nm);
  });

  /* ---------- Chấm đỏ chuông thông báo ---------- */
  var unread = DB.notifications.filter(function (n) { return n.userId === DB.teachers[0].id && !n.read; }).length;
  var dot = document.querySelector(".bell-dot"); if (dot) dot.hidden = !unread;

  render();
}).catch(window.reportDataError);
