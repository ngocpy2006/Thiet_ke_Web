/* Learnova: đọc assets/data.csv. Mọi trang chờ window.dataReady trước khi dùng DB/Store. */
(function (global) {
  "use strict";

  const csvURL = new URL("data.csv", document.currentScript.src);
  const STORAGE_KEY = "learnova_csv_db_v1";
  const ARRAY_COLLECTIONS = [
    "teachers", "classes", "students", "parents", "topics", "difficulties",
    "questionTypes", "tags", "referenceDocs", "questions", "assignments",
    "submissions", "notifications", "comments", "reports"
  ];
  const DAY = 864e5;
  const PHASE_LABELS = { draft: "Bản nháp", upcoming: "Sắp giao", ongoing: "Đang giao", closed: "Đã giao" };
  const ls = (() => { try { return global.localStorage; } catch (_) { return null; } })();
  const content = document.querySelector("main.content");
  const status = document.createElement("p");
  status.id = "data-status";
  status.className = "card";
  status.setAttribute("role", "status");
  status.textContent = "Đang nạp dữ liệu...";
  if (content) {
    content.setAttribute("aria-busy", "true");
    content.prepend(status);
  }

  global.reportDataError = function (error) {
    console.error("[Learnova] Không nạp được dữ liệu:", error);
    status.setAttribute("role", "alert");
    status.textContent = location.protocol === "file:"
      ? "Hãy mở trang bằng Live Server để nạp dữ liệu."
      : "Không nạp được dữ liệu. " + error.message;
    if (content) {
      content.removeAttribute("aria-busy");
      if (!status.isConnected) content.prepend(status);
    }
  };

  // CSV hỗ trợ BOM, CRLF, dấu phẩy/xuống dòng trong ô và dấu nháy kép được escape.
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [], field = "", quoted = false, closedQuote = false;
    function finishField() {
      row.push(field);
      field = "";
      closedQuote = false;
    }
    function finishRow() {
      finishField();
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closedQuote = true; }
        } else field += ch;
      } else if (ch === ",") finishField();
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        finishRow();
      } else if (closedQuote) {
        if (ch !== " " && ch !== "\t") throw new Error("CSV có ký tự sau dấu nháy đóng.");
      } else if (ch === '"') {
        if (field !== "") throw new Error("CSV có dấu nháy không hợp lệ.");
        quoted = true;
      } else field += ch;
    }
    if (quoted) throw new Error("CSV thiếu dấu nháy đóng.");
    if (field !== "" || row.length || closedQuote) finishRow();
    return rows;
  }

  function decodeDatabase(text) {
    const rows = parseCSV(text);
    const headers = rows.shift();
    if (!headers || headers.join(",") !== "collection,id,label,json") {
      throw new Error("CSV cần các cột collection,id,label,json.");
    }
    const db = { meta: null, adminContact: null };
    ARRAY_COLLECTIONS.forEach(name => { db[name] = []; });
    const ids = new Map();
    rows.forEach((row, index) => {
      if (row.length !== 4) throw new Error("CSV: bản ghi " + (index + 2) + " không đủ 4 cột.");
      const [collection, id, , json] = row;
      if (!Object.hasOwn(db, collection)) throw new Error("CSV có bảng không hỗ trợ: " + collection);
      let record;
      try { record = JSON.parse(json); }
      catch (_) { throw new Error("CSV: JSON không hợp lệ ở bản ghi " + (index + 2) + "."); }
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("CSV: bản ghi " + (index + 2) + " phải là một đối tượng JSON.");
      }
      const key = collection + ":" + id;
      if (ids.has(key)) throw new Error("CSV có mã bản ghi trùng: " + key);
      ids.set(key, true);
      if (Array.isArray(db[collection])) {
        if (!id || record.id !== id) throw new Error("CSV có mã JSON không khớp ở bản ghi " + (index + 2) + ".");
        db[collection].push(record);
      } else {
        if (db[collection] !== null) throw new Error("CSV có nhiều bản ghi " + collection + ".");
        db[collection] = record;
      }
    });
    if (!db.meta || !db.teachers.length) throw new Error("CSV thiếu thông tin năm học hoặc giáo viên.");
    return db;
  }

  // Bản lưu chỉnh sửa chỉ dùng lại khi nội dung CSV không thay đổi.
  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return text.length + ":" + (hash >>> 0).toString(16);
  }

  // Giai đoạn của bài: draft | upcoming (sắp giao) | ongoing (đang giao) | closed (đã giao/hết hạn)
  function phaseOf(a, now) {
    now = now || Date.now();
    if (!a.published) return "draft";
    if (now < Date.parse(a.startAt)) return "upcoming";
    if (now <= Date.parse(a.dueAt)) return "ongoing";
    return "closed";
  }

  // Thống kê đúng/sai theo chủ đề. Chỉ kết luận "yếu" khi đủ dữ liệu (>= 3 câu) và đúng < 60%.
  function topicStats(subs, qMap) {
    var m = {};
    subs.forEach(function (s) {
      if (s.status !== "graded") return;
      s.answers.forEach(function (a) {
        var q = qMap[a.questionId];
        if (!q || a.isCorrect === null) return;
        var t = m[q.topicId] || (m[q.topicId] = { topicId: q.topicId, total: 0, correct: 0 });
        t.total++;
        if (a.isCorrect) t.correct++;
      });
    });
    return Object.keys(m).map(function (k) {
      var t = m[k], rate = t.correct / t.total;
      return { topicId: t.topicId, total: t.total, correct: t.correct, rate: rate, enough: t.total >= 3, weak: t.total >= 3 && rate < 0.6 };
    }).sort(function (a, b) { return a.rate - b.rate; });
  }

  async function loadData() {
    const response = await fetch(csvURL, { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được assets/data.csv (HTTP " + response.status + ").");
    const text = await response.text();
    const sourceDb = decodeDatabase(text);
    const source = fingerprint(text);
    let db = structuredClone(sourceDb);
    try {
      const saved = ls && JSON.parse(ls.getItem(STORAGE_KEY) || "null");
      if (saved && saved.source === source && saved.db && saved.db.meta
          && ARRAY_COLLECTIONS.every(name => Array.isArray(saved.db[name]))
          && saved.db.teachers.length) db = saved.db;
    } catch (error) {
      console.warn("[Learnova] Không đọc được bản lưu, dùng dữ liệu CSV.", error);
    }

    function persist(value) {
      try { if (ls) ls.setItem(STORAGE_KEY, JSON.stringify({ source: source, db: value })); }
      catch (error) { console.warn("[Learnova] Không lưu được thay đổi trên trình duyệt.", error); }
    }

  function qMap() { var m = {}; db.questions.forEach(function (x) { m[x.id] = x; }); return m; }
  function targetsOf(a) {
    return db.students.filter(function (s) { return a.classIds.indexOf(s.classId) >= 0 || a.studentIds.indexOf(s.id) >= 0; });
  }
  function assignmentStats(a) {
    var t = targetsOf(a).length, subs = db.submissions.filter(function (x) { return x.assignmentId === a.id; });
    return { targets: t, submitted: subs.length, graded: subs.filter(function (x) { return x.status === "graded"; }).length,
      pending: subs.filter(function (x) { return x.status === "submitted"; }).length, rate: t ? subs.length / t : 0 };
  }

  var Store = {
    phaseLabels: PHASE_LABELS,
    phaseOf: phaseOf,
    targetsOf: targetsOf,
    assignmentStats: assignmentStats,
    topicStats: function (subs) { return topicStats(subs, qMap()); },

    save: function () { persist(db); },
    reset: function () {
      var fresh = structuredClone(sourceDb);
      Object.keys(db).forEach(function (k) { delete db[k]; });
      Object.assign(db, fresh);
      persist(db);
      return db;
    },
    // Đăng nhập thử: trả về người dùng (không kèm mật khẩu) hoặc null
    login: function (username, password) {
      var u = db.teachers.concat(db.students, db.parents).find(function (x) { return x.username === username && x.password === password; });
      if (!u) return null;
      var copy = Object.assign({}, u); delete copy.password; return copy;
    },
    // Sinh id mới: Store.nextId("Q", DB.questions, 3) → "Q041"
    nextId: function (prefix, list, width) {
      var max = 0;
      list.forEach(function (x) { var m = String(x.id).match(/(\d+)$/); if (m) max = Math.max(max, +m[1]); });
      return prefix + String(max + 1).padStart(width || 3, "0");
    },

    // 4 thẻ số liệu ở trang Tổng quan
    overview: function () {
      var act = db.classes.filter(function (c) { return c.status === "active"; });
      var ids = act.map(function (c) { return c.id; }), t = 0, s = 0;
      db.assignments.filter(function (a) { return phaseOf(a) === "closed" && Date.now() - Date.parse(a.dueAt) <= 30 * DAY; })
        .forEach(function (a) { var st = assignmentStats(a); t += st.targets; s += st.submitted; });
      return {
        activeClasses: act.length,
        totalStudents: db.students.filter(function (x) { return ids.indexOf(x.classId) >= 0; }).length,
        ongoingAssignments: db.assignments.filter(function (a) { return phaseOf(a) === "ongoing"; }).length,
        completionRate: t ? Math.round(s / t * 100) : null
      };
    },

    // Biểu đồ "Tiến độ lớp học": completion = % nộp bài, goodRate = % bài đạt từ 6,5 điểm trở lên; null = chưa đủ dữ liệu
    weeklyProgress: function (classId, weeks) {
      weeks = weeks || 4;
      var now = Date.now(), out = [];
      for (var w = weeks - 1; w >= 0; w--) {
        var to = now - w * 7 * DAY, from = to - 7 * DAY;
        var list = db.assignments.filter(function (a) {
          var d = Date.parse(a.dueAt);
          return a.published && d > from && d <= to && (!classId || a.classIds.indexOf(classId) >= 0);
        });
        var targets = 0, subs = [];
        list.forEach(function (a) {
          var ts = targetsOf(a).filter(function (s) { return !classId || s.classId === classId; });
          var ids = ts.map(function (s) { return s.id; });
          targets += ts.length;
          subs = subs.concat(db.submissions.filter(function (x) { return x.assignmentId === a.id && ids.indexOf(x.studentId) >= 0; }));
        });
        var gr = subs.filter(function (x) { return x.status === "graded"; });
        out.push({
          label: "Tuần " + (weeks - w), from: new Date(from).toISOString(), to: new Date(to).toISOString(), assignments: list.length,
          completion: targets ? Math.round(subs.length / targets * 100) : null,
          goodRate: gr.length ? Math.round(gr.filter(function (x) { return x.score10 >= 6.5; }).length / gr.length * 100) : null
        });
      }
      return out;
    },

    // Khối "Hoạt động gần đây"
    recentActivities: function (limit) {
      var cls = function (id) { return (db.classes.find(function (c) { return c.id === id; }) || {}).name; };
      var aMap = {}, sMap = {}, ev = [];
      db.assignments.forEach(function (a) { aMap[a.id] = a; });
      db.students.forEach(function (s) { sMap[s.id] = s; });
      db.assignments.forEach(function (a) {
        if (a.published) ev.push({ type: "assign", at: a.publishedAt, text: "Bạn đã giao bài mới", detail: a.title + " (" + a.classIds.map(cls).join(", ") + ")", link: { page: "assignment-detail", id: a.id } });
      });
      db.submissions.slice().sort(function (x, y) { return x.submittedAt < y.submittedAt ? 1 : -1; }).slice(0, 8).forEach(function (s) {
        var st = sMap[s.studentId];
        ev.push({ type: "submit", at: s.submittedAt, text: "Học sinh đã nộp bài", detail: st.fullName + " (" + cls(st.classId) + ")", link: { page: "result-detail", id: s.id } });
      });
      db.submissions.filter(function (s) { return s.gradedBy === "GV01"; }).sort(function (x, y) { return x.gradedAt < y.gradedAt ? 1 : -1; }).slice(0, 3).forEach(function (s) {
        ev.push({ type: "grade", at: s.gradedAt, text: "Bạn đã chấm bài", detail: aMap[s.assignmentId].title + " – " + sMap[s.studentId].fullName, link: { page: "result-detail", id: s.id } });
      });
      return ev.sort(function (x, y) { return x.at < y.at ? 1 : -1; }).slice(0, limit || 5);
    }
  };

    global.DB = db;
    global.Store = Store;
    return db;
  }

  global.dataReady = loadData();
  global.dataReady.then(() => {
    status.remove();
    if (content) content.removeAttribute("aria-busy");
    document.dispatchEvent(new CustomEvent("data:ready"));
  }).catch(global.reportDataError);
})(window);
