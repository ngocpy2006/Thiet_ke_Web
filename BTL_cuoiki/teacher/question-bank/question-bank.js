/* Learnova – Ngân hàng câu hỏi (giáo viên). Chờ data-loader.js nạp CSV trước khi hiển thị. */
window.pageReady = Promise.all([window.dataReady, window.layoutReady]).then(function () {
  "use strict";
  const ME = "GV01"; // người dùng hiện tại
  const ASSIGNMENT_PAGE = "../../partial/assignment/assignment.html"; // mở bài được chọn bằng ?id=<id bài>
  const KEY = "qb_filters";
  const $ = (id) => document.getElementById(id);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const D = DB;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (iso) => { const d = new Date(iso); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); };
  const fold = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const now = () => new Date().toISOString();
  const DOTS = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  const SEARCH = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

  // CSV cũ chưa có hai trường giao diện này; không thêm câu hỏi hay giáo viên mẫu.
  D.questions.forEach(q => {
    if (q.visibility === undefined) q.visibility = "public";
    if (q.isFavorite === undefined) q.isFavorite = false;
  });

  /* ---------- Tra cứu + phân quyền ---------- */
  const nm = (list, id) => { const x = D[list].find((i) => i.id === id); return x ? x.name : "—"; };
  const who = (id) => { const t = D.teachers.find((x) => x.id === id); return t ? t.fullName : "—"; };
  const byId = (id) => D.questions.find((q) => q.id === id);
  const mine = (q) => q.createdBy === ME;
  // Quy tắc nghiệp vụ: câu của người khác chỉ hiện khi Public
  const visible = (q) => mine(q) || q.visibility === "public";
  const NO = "Chỉ người tạo câu hỏi mới được thực hiện";

  /* ---------- Trạng thái + giữ bộ lọc trong phiên (sessionStorage) ---------- */
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) { /* bỏ qua */ }
  const st = Object.assign({ tab: "all", q: "", topic: "", tag: "", type: "", diff: "", vis: "", sort: "recent", size: 8 }, saved, { page: 1, cur: null, sel: {} });
  const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ tab: st.tab, q: st.q, topic: st.topic, tag: st.tag, type: st.type, diff: st.diff, vis: st.vis, sort: st.sort, size: st.size })); } catch (e) { /* bỏ qua */ } };

  function fillFilters() {
    [["fTopic", "topics", "topic"], ["fTag", "tags", "tag"], ["fType", "questionTypes", "type"], ["fDiff", "difficulties", "diff"]].forEach(([id, l, k]) => {
      $(id).innerHTML = '<option value="">Tất cả</option>' + D[l].map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
      if (!D[l].some((x) => x.id === st[k])) st[k] = "";
      $(id).value = st[k];
    });
    $("fVis").value = st.vis; $("fSort").value = st.sort; $("q").value = st.q; $("fSize").value = st.size;
  }

  /* ---------- Lọc + sắp xếp ---------- */
  function list() {
    const q = fold(st.q.trim());
    const rows = D.questions.filter((x) => visible(x) &&
      (st.tab === "all" || (st.tab === "mine" && mine(x)) || (st.tab === "fav" && x.isFavorite)) &&
      (!st.topic || x.topicId === st.topic) && (!st.tag || x.tags.includes(st.tag)) && (!st.type || x.type === st.type) &&
      (!st.diff || x.difficulty === st.diff) && (!st.vis || x.visibility === st.vis) &&
      (!q || fold(`${x.id} ${x.content} ${nm("topics", x.topicId)}`).includes(q)));
    const lv = (x) => D.difficulties.findIndex((d) => d.id === x.difficulty);
    rows.sort((a, b) => st.sort === "old" ? a.updatedAt.localeCompare(b.updatedAt) : st.sort === "az" ? a.content.localeCompare(b.content, "vi")
      : st.sort === "level" ? lv(a) - lv(b) : b.updatedAt.localeCompare(a.updatedAt));
    return rows;
  }
  const pagesList = (n, c) => {
    const s = { 1: 1, [n]: 1 };
    for (let i = c - 1; i <= c + 1; i++) if (i > 0 && i <= n) s[i] = 1;
    if (c <= 3) for (let i = 1; i <= Math.min(5, n); i++) s[i] = 1;
    if (c >= n - 2) for (let i = Math.max(1, n - 4); i <= n; i++) s[i] = 1;
    const a = Object.keys(s).map(Number).sort((x, y) => x - y), out = [];
    a.forEach((p, i) => { if (i && p - a[i - 1] > 1) out.push("…"); out.push(p); });
    return out;
  };

  /* ---------- Render bảng ---------- */
  function render() {
    const vis = D.questions.filter(visible);
    $("cAll").textContent = vis.length; $("cMine").textContent = vis.filter(mine).length; $("cFav").textContent = vis.filter((x) => x.isFavorite).length;
    $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === st.tab));
    Object.keys(st.sel).forEach((id) => { const q = byId(id); if (!q || !visible(q)) delete st.sel[id]; });

    const rows = list(), pages = Math.max(1, Math.ceil(rows.length / st.size));
    st.page = Math.min(st.page, pages);
    const from = (st.page - 1) * st.size, part = rows.slice(from, from + st.size);
    const allSel = part.length && part.every((x) => st.sel[x.id]), someSel = part.some((x) => st.sel[x.id]);

    if (!D.questions.length) $("view").innerHTML = '<p class="empty">Ngân hàng chưa có câu hỏi. Hãy bấm “Tạo câu hỏi” để bắt đầu.</p>';
    else if (!part.length) $("view").innerHTML = '<p class="empty">Không tìm thấy câu hỏi phù hợp. <button type="button" class="link" data-clear>Xóa bộ lọc</button></p>';
    else $("view").innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th class="chk"><input type="checkbox" id="all" aria-label="Chọn tất cả câu đang hiển thị"${allSel ? " checked" : ""}></th>` +
      "<th>Câu hỏi</th><th>Chủ đề</th><th>Mức độ</th><th>Dạng</th><th>Nhãn</th><th>Visibility</th><th>Người tạo</th><th>Cập nhật</th><th>Yêu thích</th><th>Thao tác</th></tr></thead><tbody>" +
      part.map((x) => {
        const tags = x.tags.slice(0, 2).map((t) => `<span class="chip tag">${esc(nm("tags", t))}</span>`).join(" ") + (x.tags.length > 2 ? ` <small class="muted">+${x.tags.length - 2}</small>` : "");
        return `<tr data-id="${x.id}" class="${st.cur === x.id ? "cur" : ""}"><td class="chk"><input type="checkbox" class="sel" aria-label="Chọn câu ${x.id}"${st.sel[x.id] ? " checked" : ""}></td>` +
          `<td class="qc" title="${esc(x.content)}">${esc(x.content)}</td><td class="muted">${esc(nm("topics", x.topicId))}</td>` +
          `<td><span class="lv lv-${esc(x.difficulty)}">${esc(nm("difficulties", x.difficulty))}</span></td><td><span class="chip">${esc(nm("questionTypes", x.type))}</span></td><td>${tags}</td>` +
          `<td><span class="vis ${x.visibility === "public" ? "pub" : "pri"}">${x.visibility === "public" ? "Public" : "Private"}</span></td><td class="muted">${esc(who(x.createdBy))}</td><td class="muted">${fmt(x.updatedAt)}</td>` +
          `<td><button type="button" class="star" data-fav aria-pressed="${!!x.isFavorite}" aria-label="${x.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}">★</button></td>` +
          `<td><button type="button" class="more" data-more aria-haspopup="menu" aria-label="Thao tác câu ${x.id}">${DOTS}</button></td></tr>`;
      }).join("") + "</tbody></table></div>";
    const all = $("all"); if (all) all.indeterminate = !allSel && someSel;

    $("info").textContent = rows.length ? `Hiển thị ${from + 1}–${from + part.length} / ${rows.length} câu hỏi` : "Không có câu hỏi nào";
    const go = (p, label, dis, cur) => `<button type="button" data-p="${p}" aria-label="${label}"${dis ? " disabled" : ""}${cur ? ' aria-current="page"' : ""}>${cur || label.length > 3 ? label : label}</button>`;
    $("pager").innerHTML = go(st.page - 1, "‹", st.page <= 1) + pagesList(pages, st.page).map((p) => p === "…" ? '<span class="gap">…</span>' : go(p, p, false, p === st.page)).join("") + go(st.page + 1, "›", st.page >= pages);
    bulk(); preview();
  }

  /* ---------- Thao tác hàng loạt (kiểm tra quyền trên toàn bộ vùng chọn) ---------- */
  function bulk() {
    const ids = Object.keys(st.sel), el = $("bulk");
    el.hidden = !ids.length; if (!ids.length) return;
    const own = ids.every((id) => mine(byId(id)));
    const b = (act, label, off) => `<button type="button" class="btn ghost" data-bulk="${act}"${off ? ` disabled title="${NO}"` : ""}>${label}</button>`;
    el.innerHTML = `<b>Đã chọn ${ids.length} câu</b>` + b("add", "Thêm vào bài") + b("fav", "Thêm yêu thích") + b("pub", "Chuyển Public", !own) + b("pri", "Chuyển Private", !own) + b("del", "Xóa", !own) +
      '<button type="button" class="link" data-bulk="clear">Bỏ chọn</button>';
  }

  /* ---------- Panel xem trước ---------- */
  function answerView(q) {
    const ok = [].concat(q.answer);
    if (q.options) return `<ul class="pv-opts">${q.options.map((o) => `<li class="${ok.includes(o.id) ? "ok" : ""}"><b>${o.id}.</b> ${esc(o.text)}${ok.includes(o.id) ? " ✓" : ""}</li>`).join("")}</ul>`;
    if (q.type === "true_false") return `<p class="pv-ans">Đáp án đúng: <b>${q.answer ? "Đúng" : "Sai"}</b></p>`;
    return `<p class="pv-ans">Đáp án: <b>${esc(ok.join(" | "))}</b></p>`;
  }
  function preview() {
    const q = st.cur && byId(st.cur), el = $("preview");
    if (!q || !visible(q)) { el.innerHTML = '<h2 class="pv-title">Xem trước câu hỏi</h2><p class="empty">Chọn một câu hỏi trong bảng để xem chi tiết.</p>'; return; }
    el.innerHTML = `<header class="pv-head"><h2>Xem trước câu hỏi</h2><div class="pv-act"><button type="button" class="star" data-pfav aria-pressed="${!!q.isFavorite}" aria-label="${q.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}">★</button>` +
      `<button type="button" class="more" data-pmore aria-haspopup="menu" aria-label="Thao tác">${DOTS}</button></div></header><p class="pv-q">${esc(q.content)}</p>${answerView(q)}` +
      (q.explanation ? `<div class="pv-ex"><b>Lời giải</b><p>${esc(q.explanation)}</p></div>` : "") +
      `<dl class="pv-meta"><dt>Chủ đề</dt><dd>${esc(nm("topics", q.topicId))}</dd><dt>Nhãn</dt><dd>${q.tags.map((t) => `<span class="chip tag">${esc(nm("tags", t))}</span>`).join("") || "—"}</dd>` +
      `<dt>Dạng câu</dt><dd>${esc(nm("questionTypes", q.type))}</dd><dt>Mức độ</dt><dd>${esc(nm("difficulties", q.difficulty))}</dd><dt>Điểm</dt><dd>${q.points}</dd>` +
      `<dt>Visibility</dt><dd>${q.visibility === "public" ? "Public" : "Private"}</dd><dt>Người tạo</dt><dd>${esc(who(q.createdBy))}</dd><dt>Cập nhật</dt><dd>${fmt(q.updatedAt)}</dd></dl>`;
  }

  /* ---------- Toast + menu + hộp thoại dùng chung (không dùng alert/confirm) ---------- */
  let timer;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(timer); timer = setTimeout(() => t.classList.remove("show"), 3000); }
  const menu = $("menu"); let mItems = [], mBtn = null;
  const closeMenu = () => { menu.hidden = true; mBtn = null; };
  function showMenu(btn, items) {
    if (mBtn === btn && !menu.hidden) return closeMenu();
    mBtn = btn; mItems = items;
    menu.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" data-i="${i}"${it.off ? ` disabled title="${esc(it.off)}"` : ""}${it.danger ? ' class="danger"' : ""}>${esc(it.t)}</button>`).join("");
    menu.hidden = false;
    const r = btn.getBoundingClientRect();
    menu.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8)) + "px";
    menu.style.left = Math.max(8, r.right - menu.offsetWidth) + "px";
  }
  menu.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b || b.disabled) return; const it = mItems[+b.dataset.i]; closeMenu(); it.run(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu, [data-more], [data-pmore], [data-cat], #btnCreate")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu); window.addEventListener("scroll", closeMenu, true);

  const dlg = $("dlg");
  function openModal(cls, html, wire) { dlg.className = cls || ""; dlg.innerHTML = html; if (wire) wire(dlg); if (!dlg.open) dlg.showModal(); }
  const closeModal = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  function confirmBox(title, msg, label, ok, danger) {
    openModal("", `<div class="dlg-body"><h3>${title}</h3><p class="dmsg">${msg}</p><div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button>` +
      `<button class="btn${danger ? " danger" : ""}" type="button" id="okBtn">${label}</button></div></div>`, () => { $("okBtn").onclick = () => { closeModal(); ok(); }; });
  }
  const showErr = (root, err) => $$("[data-err]", root).forEach((el) => { const m = err[el.dataset.err] || ""; el.textContent = m; const w = el.closest(".fld"); if (w) w.classList.toggle("bad", !!m); });
  function commit(msg) { Store.save(); fillFilters(); render(); toast(msg); }

  /* ---------- Hành động trên câu hỏi ---------- */
  function setVis(ids, v) { ids.forEach((id) => { const q = byId(id); if (q && mine(q)) { q.visibility = v; q.updatedAt = now(); } }); commit(`Đã chuyển ${ids.length} câu sang ${v === "public" ? "Public" : "Private"}`); }
  function fav(ids, on) { ids.forEach((id) => { byId(id).isFavorite = on; }); commit(on ? `Đã thêm ${ids.length} câu vào yêu thích` : "Đã bỏ yêu thích"); }
  function dup(q) {
    const c = JSON.parse(JSON.stringify(q));
    Object.assign(c, { id: Store.nextId("Q", D.questions, 3), visibility: "private", isFavorite: false, createdBy: ME, source: "manual", refId: null, createdAt: now(), updatedAt: now() });
    D.questions.push(c); st.cur = c.id; commit("Đã nhân bản câu hỏi (bản sao ở chế độ Private)");
  }
  function delQ(ids) {
    confirmBox("Xóa câu hỏi", `Bạn sắp xóa <b>${ids.length}</b> câu hỏi. Thao tác này không thể hoàn tác.`, "Xóa", () => {
      // Câu đã nằm trong bài đã giao được giữ lại để không làm mất dữ liệu bài làm của học sinh
      const used = new Set(); D.assignments.forEach((a) => { if (a.published) a.items.forEach((i) => used.add(i.questionId)); });
      const ok = ids.filter((id) => !used.has(id)), skip = ids.length - ok.length;
      D.questions = D.questions.filter((q) => !ok.includes(q.id));
      D.assignments.forEach((a) => { if (!a.published) { a.items = a.items.filter((i) => !ok.includes(i.questionId)); a.totalPoints = a.items.reduce((s, i) => s + i.points, 0); } });
      ok.forEach((id) => { delete st.sel[id]; if (st.cur === id) st.cur = null; });
      commit(skip ? `Đã xóa ${ok.length} câu; ${skip} câu đang dùng trong bài đã giao nên được giữ lại` : `Đã xóa ${ok.length} câu hỏi`);
    }, true);
  }
  const qItems = (q) => { const m = mine(q); return [
    { t: "Xem chi tiết", run: () => { st.cur = q.id; render(); } },
    { t: "Sửa câu hỏi", off: !m && NO, run: () => openForm(q) },
    { t: "Thêm vào bài tập / bài kiểm tra", run: () => addTo([q.id]) },
    { t: q.visibility === "public" ? "Chuyển sang Private" : "Chuyển sang Public", off: !m && NO, run: () => setVis([q.id], q.visibility === "public" ? "private" : "public") },
    { t: q.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích", run: () => fav([q.id], !q.isFavorite) },
    { t: "Nhân bản câu hỏi", off: !m && NO, run: () => dup(q) },
    { t: "Xóa", danger: 1, off: !m && NO, run: () => delQ([q.id]) }
  ]; };

  /* ---------- Modal tạo / sửa câu hỏi ---------- */
  const opts = (l, sel) => D[l].map((x) => `<option value="${esc(x.id)}"${x.id === sel ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  function ansHtml(type, q) {
    if (type === "multiple_choice" || type === "multi_select") {
      const ok = q ? [].concat(q.answer) : [];
      return ["A", "B", "C", "D"].map((l) => { const o = q && q.options ? q.options.find((x) => x.id === l) : null;
        return `<div class="aopt"><input type="${type === "multi_select" ? "checkbox" : "radio"}" name="ok" value="${l}"${ok.includes(l) ? " checked" : ""} aria-label="Đáp án ${l} đúng"><span class="al">${l}</span><input type="text" name="o${l}" value="${esc(o ? o.text : "")}" placeholder="Đáp án ${l}" aria-label="Nội dung đáp án ${l}"></div>`; }).join("");
    }
    if (type === "true_false") return `<div class="chips"><label class="chk"><input type="radio" name="tf" value="true"${q && q.answer === true ? " checked" : ""}>Đúng</label><label class="chk"><input type="radio" name="tf" value="false"${q && q.answer === false ? " checked" : ""}>Sai</label></div>`;
    if (type === "short_answer") return `<input type="text" name="sa" value="${esc(q ? [].concat(q.answer).join(", ") : "")}" placeholder="Các đáp án chấp nhận, cách nhau bằng dấu phẩy" aria-label="Đáp án chấp nhận">`;
    return `<textarea name="es" rows="3" placeholder="Đáp án mẫu / gợi ý chấm (tùy chọn)">${esc(q && typeof q.answer === "string" ? q.answer : "")}</textarea>`;
  }
  function openForm(q) {
    const t0 = q ? q.type : "multiple_choice";
    openModal("wide", `<form class="dlg-body" novalidate><h3>${q ? "Sửa câu hỏi" : "Tạo câu hỏi"}</h3>` +
      `<label class="fld">Nội dung câu hỏi *<textarea name="qcontent" rows="3">${esc(q ? q.content : "")}</textarea><span class="err" data-err="content"></span></label>` +
      `<div class="cols"><label class="fld">Chủ đề *<select name="topic">${opts("topics", q && q.topicId)}</select></label><label class="fld">Dạng câu *<select name="qtype">${opts("questionTypes", t0)}</select></label></div>` +
      `<div class="cols"><label class="fld">Mức độ *<select name="diff">${opts("difficulties", q && q.difficulty)}</select></label><label class="fld">Điểm *<input name="points" type="number" min="0.25" step="0.25" value="${q ? q.points : 1}"><span class="err" data-err="points"></span></label></div>` +
      `<fieldset class="fld"><legend>Nhãn</legend><div class="chips">${D.tags.map((t) => `<label class="chk"><input type="checkbox" name="tag" value="${esc(t.id)}"${q && q.tags.includes(t.id) ? " checked" : ""}>${esc(t.name)}</label>`).join("")}</div></fieldset>` +
      `<fieldset class="fld"><legend>Đáp án *</legend><div id="ans">${ansHtml(t0, q)}</div><span class="err" data-err="ans"></span></fieldset>` +
      `<label class="fld">Lời giải<textarea name="exp" rows="2">${esc(q ? q.explanation || "" : "")}</textarea></label>` +
      `<fieldset class="fld"><legend>Quyền truy cập *</legend><div class="chips"><label class="chk"><input type="radio" name="vis" value="public"${q && q.visibility === "public" ? " checked" : ""}>Public – giáo viên khác có thể dùng</label>` +
      `<label class="chk"><input type="radio" name="vis" value="private"${q && q.visibility === "private" ? " checked" : ""}>Private – chỉ mình tôi</label></div><span class="err" data-err="vis"></span></fieldset>` +
      '<div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn" type="submit">Lưu</button></div></form>', (el) => {
        const f = $$("form", el)[0], fe = f.elements, acts = $$(".dlg-actions", f)[0];
        acts.insertAdjacentHTML("beforebegin", '<div class="pv-box" id="fPv" hidden></div>');
        acts.insertAdjacentHTML("afterbegin", '<button class="btn ghost pv-btn" type="button" id="fPvBtn">Xem trước</button>');
        $("fPvBtn").addEventListener("click", () => { const box = $("fPv"); box.hidden = !box.hidden; if (!box.hidden) box.innerHTML = draftPreview(f); });
        fe.qtype.addEventListener("change", () => { $("ans").innerHTML = ansHtml(fe.qtype.value, q && q.type === fe.qtype.value ? q : null); });
        f.addEventListener("submit", (e) => {
          e.preventDefault();
          const err = {}, type = fe.qtype.value, content = fe.qcontent.value.trim(), pts = parseFloat(fe.points.value), vis = fe.vis.value;
          let options = null, answer = null;
          if (!content) err.content = "Vui lòng nhập nội dung câu hỏi.";
          if (!(pts > 0)) err.points = "Điểm phải lớn hơn 0.";
          if (!vis) err.vis = "Vui lòng chọn Public hoặc Private."; // trường bắt buộc
          if (type === "multiple_choice" || type === "multi_select") {
            options = ["A", "B", "C", "D"].map((l) => ({ id: l, text: fe["o" + l].value.trim() })).filter((o) => o.text);
            const ok = $$('input[name="ok"]:checked', f).map((x) => x.value).filter((l) => options.some((o) => o.id === l));
            if (options.length < 2) err.ans = "Cần nhập ít nhất 2 đáp án."; else if (!ok.length) err.ans = "Hãy chọn đáp án đúng (trong các đáp án đã nhập)."; else answer = type === "multiple_choice" ? ok[0] : ok;
          } else if (type === "true_false") { if (!fe.tf.value) err.ans = "Hãy chọn Đúng hoặc Sai."; else answer = fe.tf.value === "true"; }
          else if (type === "short_answer") { const acc = fe.sa.value.split(",").map((s) => s.trim()).filter(Boolean); if (!acc.length) err.ans = "Nhập ít nhất một đáp án chấp nhận."; else answer = acc; }
          else answer = fe.es.value.trim();
          showErr(f, err); if (Object.keys(err).length) return;
          const rec = { content, topicId: fe.topic.value, type, difficulty: fe.diff.value, tags: $$('input[name="tag"]:checked', f).map((x) => x.value), options, answer, explanation: fe.exp.value.trim(), points: pts, visibility: vis, updatedAt: now() };
          if (q) Object.assign(q, rec);
          else { const n = Object.assign({ id: Store.nextId("Q", D.questions, 3), source: "manual", refId: null, status: "active", createdBy: ME, isFavorite: false, createdAt: now() }, rec); D.questions.push(n); st.cur = n.id; }
          closeModal(); commit(q ? "Đã sửa câu hỏi thành công" : "Đã tạo câu hỏi thành công");
        });
      });
  }

  /* ---------- Modal thêm câu hỏi vào bài (chỉ bài còn chỉnh sửa được) ---------- */
  function addTo(ids) {
    let pick = null;
    const rowsHtml = () => {
      const q = fold($("aq").value), k = $("aKind").value, s = $("aStat").value;
      const L = D.assignments.filter((a) => { const p = Store.phaseOf(a); return p !== "closed" && (!k || a.type === k) && (!s || p === s) && (!q || fold(a.title).includes(q)); });
      return L.length ? L.map((a) => { const p = Store.phaseOf(a), lock = p === "ongoing"; // bài đang giao: học sinh có thể đang làm → khóa
        return `<label class="arow${lock ? " off" : ""}"><input type="radio" name="asg" value="${a.id}"${lock ? " disabled" : ""}${pick === a.id ? " checked" : ""}><span><b>${esc(a.title)}</b><small>${a.type === "kiem_tra" ? "Kiểm tra" : "Bài tập"} · ${Store.phaseLabels[p]}${lock ? " · không thể chỉnh sửa" : ""}</small></span></label>`; }).join("")
        : '<p class="empty">Không có bài phù hợp.</p>';
    };
    openModal("", `<div class="dlg-body"><h3>Thêm câu hỏi vào bài</h3><p class="dmsg">Đã chọn ${ids.length} câu hỏi.</p>` +
      '<label class="fld">Tìm bài<input id="aq" type="search" placeholder="Nhập tên bài..."></label>' +
      '<div class="cols"><label class="fld">Loại bài<select id="aKind"><option value="">Tất cả</option><option value="bai_tap">Bài tập</option><option value="kiem_tra">Kiểm tra</option></select></label>' +
      '<label class="fld">Trạng thái<select id="aStat"><option value="">Tất cả</option><option value="draft">Bản nháp</option><option value="upcoming">Sắp giao</option><option value="ongoing">Đang giao</option></select></label></div>' +
      '<div class="alist" id="aList"></div><label class="chk"><input type="checkbox" id="aStay" checked>Thêm câu hỏi và tiếp tục ở lại Ngân hàng câu hỏi</label>' +
      '<div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn" type="button" id="aOk" disabled>Thêm vào bài</button></div></div>', () => {
        const draw = () => { $("aList").innerHTML = rowsHtml(); };
        draw(); ["aq", "aKind", "aStat"].forEach((i) => $(i).addEventListener("input", draw));
        $("aList").addEventListener("change", (e) => { pick = e.target.value; $("aOk").disabled = false; });
        $("aOk").addEventListener("click", () => {
          const a = D.assignments.find((x) => x.id === pick); let added = 0;
          ids.forEach((id) => { if (a.items.some((i) => i.questionId === id)) return; a.items.push({ questionId: id, points: byId(id).points }); added++; });
          a.totalPoints = a.items.reduce((s, i) => s + i.points, 0);
          a.topicIds = Array.from(new Set(a.items.map((i) => byId(i.questionId).topicId))); a.updatedAt = now();
          const stay = $("aStay").checked; st.sel = {}; closeModal();
          if (!stay) { Store.save(); location.href = ASSIGNMENT_PAGE + "?id=" + encodeURIComponent(a.id); return; }
          commit(added === ids.length ? `Đã thêm ${added} câu vào “${a.title}”` : `Đã thêm ${added} câu vào “${a.title}” (${ids.length - added} câu đã có sẵn)`);
        });
      });
  }

  /* ---------- Xem trước nháp trong form tạo/sửa ---------- */
  function draftPreview(f) {
    const fe = f.elements, type = fe.qtype.value, g = (n) => (fe[n] ? fe[n].value.trim() : "");
    let body;
    if (type === "multiple_choice" || type === "multi_select") {
      const ok = $$('input[name="ok"]:checked', f).map((x) => x.value);
      body = '<ul class="pv-opts">' + ["A", "B", "C", "D"].filter((l) => g("o" + l)).map((l) => `<li class="${ok.includes(l) ? "ok" : ""}"><b>${l}.</b> ${esc(g("o" + l))}${ok.includes(l) ? " ✓" : ""}</li>`).join("") + "</ul>";
    } else if (type === "true_false") body = `<p class="pv-ans">Đáp án đúng: <b>${fe.tf.value === "true" ? "Đúng" : fe.tf.value === "false" ? "Sai" : "—"}</b></p>`;
    else body = `<p class="pv-ans">Đáp án: <b>${esc(g(type === "short_answer" ? "sa" : "es") || "—")}</b></p>`;
    const sel = (n) => (fe[n].selectedOptions[0] ? fe[n].selectedOptions[0].text : "—");
    return `<p class="pv-q">${esc(g("qcontent") || "(Chưa nhập nội dung)")}</p>${body}` + (g("exp") ? `<div class="pv-ex"><b>Lời giải</b><p>${esc(g("exp"))}</p></div>` : "") +
      `<p class="dmsg">${esc(sel("topic"))} · ${esc(sel("qtype"))} · ${esc(sel("diff"))} · ${esc(g("points"))} điểm · ${fe.vis.value ? (fe.vis.value === "public" ? "Public" : "Private") : "Chưa chọn quyền truy cập"}</p>`;
  }

  /* ---------- Import Excel: file mẫu + kiểm tra định dạng + kiểm tra từng dòng ---------- */
  // 13 cột bắt buộc, đúng tên. File thiếu cột hoặc có cột lạ sẽ bị từ chối ngay.
  const COLS = ["question_content", "topic", "tag", "question_type", "difficulty", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation", "points", "visibility"];
  const TPL_NAME = "learnova-mau-import-cau-hoi.xlsx";
  const findBy = (list, v) => { const k = fold(String(v).trim()); return k ? D[list].find((x) => fold(x.name) === k || fold(x.id) === k) : null; };

  function downloadTpl() {
    if (!window.XLSX) return toast("Không tải được thư viện Excel. Hãy kiểm tra kết nối mạng rồi tải lại trang.");
    const tn = (id) => { const x = D.questionTypes.find((t) => t.id === id); return x ? x.name : id; };
    const t0 = D.topics[0] ? D.topics[0].name : "", tg = D.tags[0] ? D.tags[0].name : "", d0 = D.difficulties[0] ? D.difficulties[0].name : "", d1 = (D.difficulties[1] || D.difficulties[0] || {}).name || "";
    const sample = [
      ["Tập xác định của hàm số y = √(x − 1) là:", t0, tg, tn("multiple_choice"), d0, "[1; +∞)", "(1; +∞)", "(−∞; 1]", "ℝ", "A", "Biểu thức dưới căn phải không âm.", 1, "Public"],
      ["Chọn các khẳng định đúng về hàm số y = x²:", t0, tg, tn("multi_select"), d1, "Là hàm số chẵn", "Đồ thị đi qua gốc tọa độ", "Là hàm số lẻ", "Nghịch biến trên ℝ", "A,B", "", 1, "Private"],
      ["Hàm số y = x² là hàm số chẵn.", t0, tg, tn("true_false"), d0, "", "", "", "", "Đúng", "f(−x) = f(x).", 1, "Public"],
      ["Giá trị nhỏ nhất của y = x² − 6x + 10 là bao nhiêu?", t0, "", tn("short_answer"), d1, "", "", "", "", "1", "y = (x − 3)² + 1.", 1, "Public"],
      ["Khảo sát và vẽ đồ thị hàm số y = x³ − 3x.", t0, tg, tn("essay"), d1, "", "", "", "", "Đáp án mẫu: ...", "", 2, "Private"]
    ];
    const names = (l) => D[l].map((x) => x.name);
    const guide = [["Cột", "Bắt buộc", "Mô tả", "Giá trị hợp lệ"],
      ["question_content", "Có", "Nội dung câu hỏi", ""],
      ["topic", "Có", "Chủ đề, nhập đúng tên trong danh mục", names("topics").join(" | ")],
      ["tag", "Không", "Một hoặc nhiều nhãn, cách nhau bằng dấu phẩy", names("tags").join(" | ")],
      ["question_type", "Có", "Dạng câu", names("questionTypes").join(" | ")],
      ["difficulty", "Có", "Mức độ", names("difficulties").join(" | ")],
      ["option_a … option_d", "Có với dạng trắc nghiệm", "Nội dung 4 đáp án (cần ít nhất 2 đáp án); để trống với các dạng khác", ""],
      ["correct_answer", "Có (trừ tự luận)", "Trắc nghiệm 1 đáp án: A, B, C hoặc D. Nhiều đáp án: ví dụ A,C. Đúng/Sai: nhập Đúng hoặc Sai. Trả lời ngắn: các đáp án chấp nhận, cách nhau bằng dấu chấm phẩy (;). Tự luận: đáp án mẫu (tùy chọn)", ""],
      ["explanation", "Không", "Lời giải", ""],
      ["points", "Có", "Số lớn hơn 0, ví dụ 1 hoặc 0.5", ""],
      ["visibility", "Có", "Quyền truy cập", "Public | Private"]];
    const L = ["topics", "tags", "questionTypes", "difficulties"], cats = [["Chủ đề", "Nhãn", "Dạng câu", "Mức độ"]];
    for (let i = 0; i < Math.max(...L.map((l) => D[l].length)); i++) cats.push(L.map((l) => (D[l][i] ? D[l][i].name : "")));
    const wb = XLSX.utils.book_new(), sheet = (aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = w.map((x) => ({ wch: x })); return ws; };
    XLSX.utils.book_append_sheet(wb, sheet([COLS].concat(sample), COLS.map((c) => (c === "question_content" ? 48 : c === "explanation" ? 30 : 20))), "Câu hỏi");
    XLSX.utils.book_append_sheet(wb, sheet(guide, [22, 24, 70, 60]), "Hướng dẫn");
    XLSX.utils.book_append_sheet(wb, sheet(cats, [26, 26, 26, 26]), "Danh mục");
    XLSX.writeFile(wb, TPL_NAME); toast("Đã tải file Excel mẫu");
  }

  // Kiểm tra 1 dòng: trả về danh sách lỗi [cột, thông báo] và bản ghi hợp lệ (nếu không lỗi)
  function checkRow(r) {
    const err = [], g = (c) => String(r[c] == null ? "" : r[c]).trim();
    const content = g("question_content"); if (!content) err.push(["question_content", "Bắt buộc nhập"]);
    const topic = findBy("topics", g("topic")); if (!topic) err.push(["topic", g("topic") ? `“${g("topic")}” không có trong danh mục Chủ đề` : "Bắt buộc nhập"]);
    const type = findBy("questionTypes", g("question_type")); if (!type) err.push(["question_type", g("question_type") ? `“${g("question_type")}” không có trong danh mục Dạng câu` : "Bắt buộc nhập"]);
    const diff = findBy("difficulties", g("difficulty")); if (!diff) err.push(["difficulty", g("difficulty") ? `“${g("difficulty")}” không có trong danh mục Mức độ` : "Bắt buộc nhập"]);
    const tags = []; g("tag").split(/[,;]/).map((s) => s.trim()).filter(Boolean).forEach((t) => { const x = findBy("tags", t); if (x) tags.push(x.id); else err.push(["tag", `Nhãn “${t}” không có trong danh mục`]); });
    const pts = parseFloat(g("points").replace(",", ".")); if (!(pts > 0)) err.push(["points", "Phải là số lớn hơn 0"]);
    const vis = { "public": "public", "private": "private" }[fold(g("visibility"))]; if (!vis) err.push(["visibility", "Chỉ nhận Public hoặc Private"]);
    let options = null, answer = null; const ca = g("correct_answer");
    if (type) {
      if (type.id === "multiple_choice" || type.id === "multi_select") {
        options = ["a", "b", "c", "d"].map((l) => ({ id: l.toUpperCase(), text: g("option_" + l) })).filter((o) => o.text);
        const letters = ca.toUpperCase().split(/[,;\s]+/).filter(Boolean);
        if (options.length < 2) err.push(["option_a", "Cần nhập ít nhất 2 đáp án (option_a – option_d)"]);
        if (!ca) err.push(["correct_answer", "Bắt buộc nhập"]);
        else if (!letters.every((l) => options.some((o) => o.id === l))) err.push(["correct_answer", "Phải là chữ cái của đáp án đã nhập (A–D)"]);
        else if (type.id === "multiple_choice" && letters.length !== 1) err.push(["correct_answer", "Dạng 1 đáp án chỉ được chọn 1 chữ cái"]);
        else answer = type.id === "multiple_choice" ? letters[0] : Array.from(new Set(letters)).sort();
      } else if (type.id === "true_false") {
        const v = { dung: true, "true": true, sai: false, "false": false }[fold(ca)];
        if (v === undefined) err.push(["correct_answer", "Chỉ nhận Đúng hoặc Sai"]); else answer = v;
      } else if (type.id === "short_answer") {
        const acc = ca.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
        if (!acc.length) err.push(["correct_answer", "Bắt buộc nhập"]); else answer = acc;
      } else answer = ca; // tự luận / dạng tùy chỉnh: đáp án mẫu (không bắt buộc)
    }
    return { err, rec: err.length ? null : { content, topicId: topic.id, type: type.id, difficulty: diff.id, tags, options, answer, explanation: g("explanation"), points: pts, visibility: vis } };
  }

  // Đọc file: sai đuôi / sai dung lượng / không phải xlsx / sai cột → từ chối, không import gì
  function parseFile(file) {
    if (!/\.xlsx$/i.test(file.name)) return Promise.reject("File phải có đuôi .xlsx.");
    if (file.size > 2 * 1024 * 1024) return Promise.reject("File quá lớn (tối đa 2 MB).");
    return file.arrayBuffer().then((buf) => {
      const b = new Uint8Array(buf);
      if (b[0] !== 0x50 || b[1] !== 0x4B) throw "Đây không phải file Excel .xlsx hợp lệ.";
      let wb; try { wb = XLSX.read(buf, { type: "array" }); } catch (e) { throw "Không đọc được file. Hãy dùng đúng file mẫu."; }
      const name = wb.SheetNames.includes("Câu hỏi") ? "Câu hỏi" : wb.SheetNames[0];
      if (!name) throw "File không có sheet dữ liệu.";
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", blankrows: true });
      const head = (aoa[0] || []).map((h) => String(h).trim());
      const missing = COLS.filter((c) => !head.includes(c)), extra = head.filter((h) => h && !COLS.includes(h));
      if (missing.length || extra.length) throw "File không đúng mẫu." + (missing.length ? ` Thiếu cột: ${missing.join(", ")}.` : "") + (extra.length ? ` Cột không thuộc mẫu: ${extra.join(", ")}.` : "") + " Vui lòng tải file mẫu và nhập đúng định dạng.";
      const rows = [];
      aoa.slice(1).forEach((r, i) => {
        if (r.every((c) => String(c).trim() === "")) return;
        const o = {}; head.forEach((h, j) => { if (h) o[h] = r[j]; });
        rows.push(Object.assign({ line: i + 2, o }, checkRow(o)));
      });
      if (!rows.length) throw "File chưa có dòng dữ liệu nào.";
      if (rows.length > 500) throw "Mỗi lần import tối đa 500 câu hỏi.";
      return rows;
    });
  }

  function openImport() {
    openModal("xl", `<div class="dlg-body"><h3>Import câu hỏi từ Excel</h3><p class="dmsg">Chỉ nhận file <b>.xlsx</b> đúng mẫu (đủ ${COLS.length} cột). <button type="button" class="link" id="impTpl">Tải file mẫu</button></p>` +
      '<div class="drop" id="drop" tabindex="0" role="button" aria-label="Chọn hoặc kéo thả file Excel"><b>Kéo thả file .xlsx vào đây</b><span>hoặc bấm để chọn file</span></div>' +
      '<input type="file" id="impFile" accept=".xlsx" hidden><p class="dmsg" id="impName"></p><div id="impRes"></div>' +
      '<div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn" type="button" id="impOk" disabled>Import</button></div></div>', () => {
        const fail = (m) => { $("impRes").innerHTML = `<div class="imp-err" role="alert">${esc(typeof m === "string" ? m : "Không đọc được file. Hãy dùng đúng file mẫu.")}</div>`; };
        const take = (file) => {
          if (!file) return;
          $("impName").textContent = "File: " + file.name; $("impRes").innerHTML = ""; $("impOk").disabled = true; $("impOk").textContent = "Import";
          if (!window.XLSX) return fail("Không tải được thư viện đọc Excel. Hãy kiểm tra kết nối mạng rồi tải lại trang.");
          parseFile(file).then(showRes).catch(fail);
        };
        $("impTpl").onclick = downloadTpl;
        $("drop").onclick = () => $("impFile").click();
        $("drop").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("impFile").click(); } };
        $("drop").ondragover = (e) => { e.preventDefault(); $("drop").classList.add("over"); };
        $("drop").ondragleave = () => $("drop").classList.remove("over");
        $("drop").ondrop = (e) => { e.preventDefault(); $("drop").classList.remove("over"); take(e.dataTransfer.files[0]); };
        $("impFile").onchange = (e) => { take(e.target.files[0]); e.target.value = ""; };
      });
  }
  function showRes(rows) {
    const ok = rows.filter((r) => !r.err.length), bad = rows.length - ok.length;
    $("impRes").innerHTML = `<p class="imp-sum"><span class="badge ok">Hợp lệ: ${ok.length}</span><span class="badge ${bad ? "bad" : "off"}">Lỗi dữ liệu: ${bad}</span></p>` +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Dòng</th><th>Nội dung</th><th>Chủ đề</th><th>Dạng</th><th>Mức độ</th><th>Trạng thái</th><th>Chi tiết lỗi</th></tr></thead><tbody>' +
      rows.map((r) => `<tr><td>${r.line}</td><td class="qc" title="${esc(r.o.question_content)}">${esc(r.o.question_content)}</td><td class="muted">${esc(r.o.topic)}</td><td class="muted">${esc(r.o.question_type)}</td><td class="muted">${esc(r.o.difficulty)}</td>` +
        `<td>${r.err.length ? '<span class="badge bad">Lỗi dữ liệu</span>' : '<span class="badge ok">Hợp lệ</span>'}</td><td class="imp-e">${r.err.map((e) => `Dòng ${r.line} – <b>${e[0]}</b>: ${esc(e[1])}`).join("<br>")}</td></tr>`).join("") + "</tbody></table></div>";
    const b = $("impOk"); b.disabled = !ok.length; b.textContent = ok.length ? `Import ${ok.length} câu hợp lệ` : "Import";
    // Chỉ import dòng hợp lệ, và phải xác nhận trước
    b.onclick = () => { closeModal(); confirmBox("Xác nhận import", `Sẽ thêm <b>${ok.length}</b> câu hỏi hợp lệ vào ngân hàng.${bad ? ` <b>${bad}</b> dòng lỗi sẽ bị bỏ qua.` : ""}`, "Import", () => doImport(ok, bad)); };
  }
  function doImport(ok, bad) {
    ok.forEach((r) => D.questions.push(Object.assign({ id: Store.nextId("Q", D.questions, 3), source: "import", refId: null, status: "active", createdBy: ME, isFavorite: false, createdAt: now(), updatedAt: now() }, r.rec)));
    Object.assign(st, { tab: "all", sort: "recent", page: 1 }); persist();
    commit(bad ? `Import Excel có lỗi: đã thêm ${ok.length} câu, bỏ qua ${bad} dòng lỗi` : `Import Excel thành công: đã thêm ${ok.length} câu hỏi`);
  }

  /* ---------- Sự kiện tab Câu hỏi ---------- */
  const setF = (k) => (e) => { st[k] = e.target.value; st.page = 1; persist(); render(); };
  [["q", "q"], ["fTopic", "topic"], ["fTag", "tag"], ["fType", "type"], ["fDiff", "diff"], ["fVis", "vis"], ["fSort", "sort"]].forEach(([id, k]) => $(id).addEventListener(id === "q" ? "input" : "change", setF(k)));
  $("fSize").addEventListener("change", (e) => { st.size = +e.target.value; st.page = 1; persist(); render(); });
  const clear = () => { Object.assign(st, { q: "", topic: "", tag: "", type: "", diff: "", vis: "", page: 1 }); persist(); fillFilters(); render(); };
  $("btnClear").addEventListener("click", clear);
  $("btnCreate").addEventListener("click", (e) => showMenu(e.currentTarget, [
    { t: "Nhập thủ công", run: () => openForm(null) },
    { t: "Import Excel", run: openImport },
    { t: "Tải file Excel mẫu", run: downloadTpl }
  ]));
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { st.tab = b.dataset.tab; st.page = 1; persist(); render(); }));
  $("pager").addEventListener("click", (e) => { const b = e.target.closest("button[data-p]"); if (!b || b.disabled) return; st.page = +b.dataset.p; render(); });

  $("view").addEventListener("click", (e) => {
    if (e.target.closest("[data-clear]")) return clear();
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const q = byId(tr.dataset.id);
    if (e.target.closest("#all")) return; // xử lý ở sự kiện change
    if (e.target.closest(".sel")) return;
    if (e.target.closest("[data-fav]")) return fav([q.id], !q.isFavorite);
    if (e.target.closest("[data-more]")) { st.cur = q.id; return showMenu(e.target.closest("[data-more]"), qItems(q)); }
    st.cur = q.id; render();
  });
  $("view").addEventListener("change", (e) => {
    if (e.target.id === "all") { $$(".sel", $("view")).forEach((c) => { const id = c.closest("tr").dataset.id; if (e.target.checked) st.sel[id] = 1; else delete st.sel[id]; }); return render(); }
    if (e.target.classList.contains("sel")) { const id = e.target.closest("tr").dataset.id; if (e.target.checked) st.sel[id] = 1; else delete st.sel[id]; render(); }
  });
  $("preview").addEventListener("click", (e) => {
    const q = byId(st.cur); if (!q) return;
    if (e.target.closest("[data-pfav]")) return fav([q.id], !q.isFavorite);
    if (e.target.closest("[data-pmore]")) showMenu(e.target.closest("[data-pmore]"), qItems(q));
  });
  $("bulk").addEventListener("click", (e) => {
    const b = e.target.closest("[data-bulk]"); if (!b || b.disabled) return;
    const ids = Object.keys(st.sel), a = b.dataset.bulk;
    if (a === "clear") { st.sel = {}; return render(); }
    if (a === "add") return addTo(ids);
    if (a === "fav") return fav(ids, true);
    if (a === "pub" || a === "pri") return setVis(ids, a === "pub" ? "public" : "private");
    delQ(ids);
  });

  /* ---------- Tab “Quản lý bộ lọc”: CRUD danh mục ---------- */
  const G = [{ k: "topics", t: "Chủ đề" }, { k: "tags", t: "Nhãn" }, { k: "questionTypes", t: "Dạng câu" }, { k: "difficulties", t: "Mức độ" }];
  const SYSTEM_TYPES = ["multiple_choice", "multi_select", "true_false", "short_answer", "essay"]; // dạng gắn với cách chấm điểm
  const fq = {};
  const field = (g, q) => (g.k === "topics" ? [q.topicId] : g.k === "tags" ? q.tags : g.k === "questionTypes" ? [q.type] : [q.difficulty]);
  const usedBy = (g, id) => D.questions.filter((q) => field(g, q).includes(id)).length;
  function catList(g) {
    const q = fold(fq[g.k] || "");
    const L = D[g.k].filter((x) => fold(x.name).includes(q));
    $("cl-" + g.k).innerHTML = L.length ? L.map((x) => `<li><span>${esc(x.name)}</span><small>${usedBy(g, x.id)} câu</small><button type="button" class="more" data-cat="${g.k}" data-id="${esc(x.id)}" aria-haspopup="menu" aria-label="Thao tác ${esc(x.name)}">${DOTS}</button></li>`).join("") : '<li class="empty">Không có giá trị nào.</li>';
  }
  function renderCats() {
    $("fgrid").innerHTML = G.map((g) => `<section class="card" aria-label="${g.t}"><header class="card-head"><h2>${g.t}</h2><button type="button" class="btn sm" data-add="${g.k}">+ Thêm</button></header>` +
      `<label class="search">${SEARCH}<input type="search" data-fq="${g.k}" placeholder="Tìm..." aria-label="Tìm trong ${g.t}"></label><ul class="clist" id="cl-${g.k}"></ul></section>`).join("");
    G.forEach(catList);
  }
  function catForm(g, item) {
    openModal("", `<form class="dlg-body" novalidate><h3>${item ? "Sửa" : "Thêm"} ${g.t.toLowerCase()}</h3><label class="fld">Tên *<input name="cname" value="${esc(item ? item.name : "")}" autocomplete="off"><span class="err" data-err="name"></span></label>` +
      '<div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn" type="submit">Lưu</button></div></form>', (el) => {
        const f = $$("form", el)[0];
        f.addEventListener("submit", (e) => {
          e.preventDefault();
          const v = f.elements.cname.value.trim().replace(/\s+/g, " "), err = {};
          if (!v) err.name = "Vui lòng nhập tên.";
          else if (D[g.k].some((x) => x !== item && fold(x.name) === fold(v))) err.name = "Tên này đã tồn tại trong nhóm.";
          showErr(f, err); if (Object.keys(err).length) return;
          if (item) item.name = v;
          else {
            let id = g.k === "topics" ? Store.nextId("TP", D.topics, 2) : (slug(v) || "muc"); const base = id; let n = 2;
            while (D[g.k].some((x) => x.id === id)) id = base + "-" + n++;
            D[g.k].push(g.k === "topics" ? { id, name: v, grade: null } : g.k === "tags" ? { id, name: v, color: "#64748b" } : g.k === "questionTypes" ? { id, name: v, autoGrade: false } : { id, name: v });
          }
          closeModal(); Store.save(); fillFilters(); catList(g); render(); toast(item ? "Đã cập nhật giá trị" : "Đã thêm giá trị mới");
        });
      });
  }
  function catDel(g, item) {
    const n = usedBy(g, item.id), others = D[g.k].filter((x) => x !== item);
    const drop = () => { D[g.k] = D[g.k].filter((x) => x !== item); Store.save(); fillFilters(); catList(g); render(); };
    if (!n) return confirmBox(`Xóa “${esc(item.name)}”`, "Giá trị này chưa được câu hỏi nào sử dụng.", "Xóa", () => { drop(); toast("Đã xóa giá trị"); }, true);
    if (!others.length) return openModal("", `<div class="dlg-body"><h3>Không thể xóa</h3><p class="dmsg">Danh mục này đang được sử dụng bởi ${n} câu hỏi và không còn giá trị nào khác để chuyển sang.</p><div class="dlg-actions"><button class="btn" type="button" data-close>Đóng</button></div></div>`);
    // Danh mục đang được dùng: không xóa ngay, buộc chuyển các câu hỏi sang danh mục khác
    openModal("", `<div class="dlg-body"><h3>Danh mục đang được sử dụng</h3><p class="dmsg">Danh mục này đang được sử dụng bởi <b>${n}</b> câu hỏi. Hãy chuyển các câu hỏi sang danh mục khác trước khi xóa.</p>` +
      `<label class="fld">Chuyển sang<select id="moveTo">${others.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select></label>` +
      '<div class="dlg-actions"><button class="btn ghost" type="button" data-close>Hủy</button><button class="btn danger" type="button" id="mvOk">Chuyển và xóa</button></div></div>', () => {
        $("mvOk").onclick = () => {
          const to = $("moveTo").value;
          D.questions.forEach((q) => {
            if (g.k === "topics" && q.topicId === item.id) q.topicId = to;
            else if (g.k === "tags" && q.tags.includes(item.id)) q.tags = Array.from(new Set(q.tags.map((t) => (t === item.id ? to : t))));
            else if (g.k === "questionTypes" && q.type === item.id) q.type = to;
            else if (g.k === "difficulties" && q.difficulty === item.id) q.difficulty = to;
          });
          closeModal(); drop(); toast(`Đã chuyển ${n} câu hỏi và xóa danh mục`);
        };
      });
  }
  $("fgrid").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]"); if (add) return catForm(G.find((g) => g.k === add.dataset.add), null);
    const b = e.target.closest("[data-cat]"); if (!b) return;
    const g = G.find((x) => x.k === b.dataset.cat), item = D[g.k].find((x) => x.id === b.dataset.id);
    const lock = g.k === "questionTypes" && SYSTEM_TYPES.includes(item.id) ? "Dạng câu hệ thống gắn với cách chấm điểm, chỉ được đổi tên" : false;
    showMenu(b, [{ t: "Sửa", run: () => catForm(g, item) }, { t: "Xóa", danger: 1, off: lock, run: () => catDel(g, item) }]);
  });
  $("fgrid").addEventListener("input", (e) => { const k = e.target.dataset.fq; if (k) { fq[k] = e.target.value; catList(G.find((g) => g.k === k)); } });

  /* ---------- Chuyển tab Câu hỏi / Quản lý bộ lọc ---------- */
  function mainTab(t) {
    $("tabQ").setAttribute("aria-selected", t === "q"); $("tabF").setAttribute("aria-selected", t === "f");
    $("paneQ").hidden = t !== "q"; $("paneF").hidden = t !== "f";
    if (t === "f") renderCats();
  }
  $("tabQ").addEventListener("click", () => mainTab("q")); $("tabF").addEventListener("click", () => mainTab("f"));

  /* ---------- Chấm đỏ chuông thông báo ---------- */
  const unread = D.notifications.filter((n) => n.userId === ME && !n.read).length, dot = document.querySelector(".bell-dot"); if (dot) dot.hidden = !unread;

  fillFilters(); render();
}).catch(window.reportDataError);
