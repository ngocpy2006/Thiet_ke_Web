/* Learnova – Trang Danh sách học sinh (giáo viên). Chờ data-loader.js nạp CSV trước khi hiển thị.
   Mở trang với ?lop=<id lớp> (vd students.html?lop=L10A1) để chọn sẵn lớp. */
window.pageReady = Promise.all([window.dataReady, window.layoutReady]).then(function () {
  "use strict";
  var PAGE_SIZE = 8;
  var $ = function (id) { return document.getElementById(id); };


  var P = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    bars: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
    dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'
  };
  var svg = function (n) { return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + P[n] + "</svg>"; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (iso) { var d = new Date(iso); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  var fold = function (s) { return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); };
  var cById = function (id) { return DB.classes.filter(function (c) { return c.id === id; })[0]; };
  var sById = function (id) { return DB.students.filter(function (s) { return s.id === id; })[0]; };

  var want = new URLSearchParams(location.search).get("lop");
  var st = { cid: cById(want) ? want : (DB.classes[0] ? DB.classes[0].id : ""), q: "", status: "", page: 1 };
  var editing = null, menuId = null, timer;

  /* ---------- Chọn lớp ---------- */
  function classOptions() {
    $("fClass").innerHTML = DB.classes.map(function (c) {
      var n = DB.students.filter(function (s) { return s.classId === c.id; }).length;
      return '<option value="' + esc(c.id) + '"' + (c.id === st.cid ? " selected" : "") + ">" + esc(c.subject + " " + c.name) + " - " + n + " học sinh</option>";
    }).join("");
  }

  /* ---------- Thẻ số liệu ---------- */
  function recent() { // bài đã kết thúc gần nhất của lớp
    var best = null;
    DB.assignments.forEach(function (a) {
      if (Store.phaseOf(a) !== "closed" || !Store.targetsOf(a).some(function (s) { return s.classId === st.cid; })) return;
      if (!best || a.dueAt > best.dueAt) best = a;
    });
    if (!best) return null;
    var ids = {}, t = Store.targetsOf(best).filter(function (s) { return s.classId === st.cid; });
    t.forEach(function (s) { ids[s.id] = 1; });
    return { n: DB.submissions.filter(function (x) { return x.assignmentId === best.id && ids[x.studentId]; }).length, t: t.length, title: best.title };
  }
  function stats(list) {
    var f = list.filter(function (s) { return s.gender === "female"; }).length;
    var act = list.filter(function (s) { return s.status === "active"; }).length, lock = list.length - act, r = recent();
    var cards = [
      ["Tổng học sinh", list.length, f + " nữ · " + (list.length - f) + " nam", "users", "blue"],
      ["Đang hoạt động", act, '<span class="gdot' + (lock ? " warn" : "") + '"></span>' + lock + " tài khoản tạm khóa", "check", "green"],
      ["Hoàn thành bài gần nhất", r && r.t ? Math.round(r.n / r.t * 100) + "%" : "—", r ? r.n + "/" + r.t + " học sinh" : "Chưa có bài nào kết thúc", "bars", "purple"]
    ];
    $("stats").innerHTML = cards.map(function (c) {
      return '<div class="stat static"><span class="tile ' + c[4] + '">' + svg(c[3]) + '</span><div class="stat-body"><div class="stat-label"><span>' + c[0] +
        '</span></div><p class="stat-value">' + c[1] + '</p><p class="stat-sub" style="margin:0">' + c[2] + "</p></div></div>";
    }).join("");
  }

  /* ---------- Bảng ---------- */
  var sdot = function (s) { return s.status === "active" ? '<span class="sdot">Hoạt động</span>' : '<span class="sdot off">Tạm khóa</span>'; };
  var more = function (s) { return '<button class="more" type="button" data-id="' + esc(s.id) + '" aria-haspopup="menu" aria-label="Thao tác học sinh ' + esc(s.fullName) + '">' + svg("dots") + "</button>"; };
  function pager(pages) {
    var h = '<button type="button" data-p="' + (st.page - 1) + '" aria-label="Trang trước"' + (st.page <= 1 ? " disabled" : "") + ">‹</button>";
    for (var i = 1; i <= pages; i++) h += '<button type="button" data-p="' + i + '"' + (i === st.page ? ' aria-current="page"' : "") + ">" + i + "</button>";
    $("pager").innerHTML = h + '<button type="button" data-p="' + (st.page + 1) + '" aria-label="Trang sau"' + (st.page >= pages ? " disabled" : "") + ">›</button>";
  }
  function render() {
    classOptions();
    var list = DB.students.filter(function (s) { return s.classId === st.cid; });
    stats(list);
    var q = fold(st.q.trim());
    var rows = list.filter(function (s) { return (!st.status || s.status === st.status) && (!q || fold(s.fullName + " " + s.code + " " + s.email).indexOf(q) >= 0); });
    rows.sort(function (a, b) { return a.joinedAt < b.joinedAt ? 1 : a.joinedAt > b.joinedAt ? -1 : a.id.localeCompare(b.id); });
    var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); st.page = Math.min(st.page, pages);
    var from = (st.page - 1) * PAGE_SIZE, part = rows.slice(from, from + PAGE_SIZE);
    $("view").innerHTML = !part.length ? '<p class="empty">' + (list.length ? "Không tìm thấy học sinh phù hợp." : "Lớp này chưa có học sinh.") + "</p>" :
      '<div class="table-wrap"><table class="table"><thead><tr><th>Họ và tên</th><th>Mã học sinh</th><th>Email</th><th>Trạng thái</th><th>Ngày tham gia</th><th>Thao tác</th></tr></thead><tbody>' +
      part.map(function (s) {
        return "<tr><td><b>" + esc(s.fullName) + '</b></td><td class="muted">' + esc(s.code) + '</td><td class="email">' + esc(s.email) + "</td><td>" + sdot(s) +
          '</td><td class="muted">' + fmt(s.joinedAt) + "</td><td>" + more(s) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    $("info").textContent = rows.length ? "Hiển thị " + (from + 1) + " - " + (from + part.length) + " trên " + rows.length + " học sinh" : "Không có học sinh nào";
    pager(pages);
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(timer); timer = setTimeout(function () { t.classList.remove("show"); }, 2500);
  }

  /* ---------- Chọn lớp / tìm kiếm / lọc / phân trang ---------- */
  $("fClass").addEventListener("change", function (e) {
    st.cid = e.target.value; st.page = 1; render();
    try { history.replaceState(null, "", "?lop=" + encodeURIComponent(st.cid)); } catch (x) { /* mở bằng file:// có thể không cho đổi URL */ }
  });
  $("q").addEventListener("input", function (e) { st.q = e.target.value; st.page = 1; render(); });
  $("fStatus").addEventListener("change", function (e) { st.status = e.target.value; st.page = 1; render(); });
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
    $("mLock").textContent = sById(menuId).status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản";
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
    var s = sById(menuId); closeMenu(); if (!s) return;
    if (b.dataset.act === "edit") return openForm(s);
    if (b.dataset.act === "lock") {
      s.status = s.status === "active" ? "locked" : "active"; Store.save(); render();
      return toast((s.status === "active" ? "Đã mở khóa tài khoản " : "Đã khóa tài khoản ") + s.fullName);
    }
    var nSub = DB.submissions.filter(function (x) { return x.studentId === s.id; }).length;
    if (!confirm("Xóa học sinh " + s.fullName + (nSub ? " cùng " + nSub + " bài làm của em" : "") + "? Hành động này không thể hoàn tác.")) return;
    DB.students.splice(DB.students.indexOf(s), 1);
    DB.submissions = DB.submissions.filter(function (x) { return x.studentId !== s.id; });
    DB.notifications = DB.notifications.filter(function (n) { return n.userId !== s.id && n.userId !== s.parentId; });
    DB.comments = DB.comments.filter(function (c) { return c.studentId !== s.id; });
    DB.reports = DB.reports.filter(function (r) { return r.studentId !== s.id; });
    DB.parents = DB.parents.filter(function (p) { return p.id !== s.parentId; });
    DB.assignments.forEach(function (a) { a.studentIds = a.studentIds.filter(function (i) { return i !== s.id; }); });
    Store.save(); render(); toast("Đã xóa học sinh " + s.fullName);
  });

  /* ---------- Hộp thoại thêm / sửa học sinh ---------- */
  var dlg = $("dlg"), form = $("form");
  function showErr(err) {
    Array.prototype.forEach.call(form.querySelectorAll("[data-err]"), function (el) {
      var m = err[el.dataset.err] || ""; el.textContent = m; el.parentNode.classList.toggle("bad", !!m);
    });
  }
  function openForm(s) {
    editing = s || null;
    var f = form.elements;
    $("dlgTitle").textContent = s ? "Chỉnh sửa học sinh" : "Thêm học sinh";
    f.sname.value = s ? s.fullName : ""; f.gender.value = s ? s.gender : "male"; f.dob.value = s ? s.dob || "" : "";
    f.email.value = s ? s.email : ""; f.cls.innerHTML = $("fClass").innerHTML; f.cls.value = s ? s.classId : st.cid;
    showErr({}); dlg.showModal(); f.sname.focus();
  }
  $("btnAdd").addEventListener("click", function () { openForm(null); });
  $("cancel").addEventListener("click", function () { dlg.close(); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements, nm = f.sname.value.trim().replace(/\s+/g, " "), email = f.email.value.trim(), dob = f.dob.value, err = {};
    if (!nm) err.sname = "Vui lòng nhập họ và tên.";
    else if (nm.length < 2) err.sname = "Họ và tên quá ngắn.";
    if (!email) err.email = "Vui lòng nhập email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "Email không đúng định dạng.";
    else if (DB.students.some(function (s) { return s !== editing && s.email.toLowerCase() === email.toLowerCase(); })) err.email = "Email này đã được dùng.";
    if (dob && Date.parse(dob) > Date.now()) err.dob = "Ngày sinh không được ở tương lai.";
    showErr(err); if (Object.keys(err).length) return;
    var data = { fullName: nm, gender: f.gender.value, dob: dob, email: email, classId: f.cls.value };
    if (editing) Object.assign(editing, data);
    else {
      var id = Store.nextId("HS", DB.students, 3), num = id.slice(2);
      DB.students.push(Object.assign({ id: id, role: "student", code: "HS2026" + num, username: "hs2026" + num, password: "123456", parentId: null, status: "active", joinedAt: new Date().toISOString() }, data));
    }
    st.cid = data.classId; st.page = 1;
    Store.save(); dlg.close(); render(); toast(editing ? "Đã cập nhật học sinh " + nm : "Đã thêm học sinh " + nm);
  });

  /* ---------- Chấm đỏ chuông thông báo ---------- */
  var unread = DB.notifications.filter(function (n) { return n.userId === DB.teachers[0].id && !n.read; }).length;
  var dot = document.querySelector(".bell-dot"); if (dot) dot.hidden = !unread;

  render();
}).catch(window.reportDataError);
