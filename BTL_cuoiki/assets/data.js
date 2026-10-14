/* =====================================================================
   LEARNOVA – BỘ DỮ LIỆU MẪU DÙNG CHUNG (Giáo viên / Học sinh / Phụ huynh)
   ---------------------------------------------------------------------
   • Nạp bằng <script src=".../js/data.js"></script> TRƯỚC các file js khác.
   • Sau khi nạp có 2 biến toàn cục:
       DB    – toàn bộ dữ liệu (classes, students, questions, assignments...)
       Store – tiện ích: save(), reset(), login(), nextId(), phaseOf()...
   • Dữ liệu được sinh một lần (cố định, không ngẫu nhiên giữa các lần tải)
     rồi lưu vào localStorage. Thêm/sửa/xóa xong chỉ cần gọi Store.save().
     Muốn quay về dữ liệu gốc: Store.reset().
   • Mốc thời gian (ngày giao, hạn nộp...) tính theo NGÀY SINH DỮ LIỆU, nên
     luôn có đủ bài "đã giao / đang giao / sắp giao".
   • Tài khoản demo (mật khẩu 123456): gv.thulan | hs2026001 | ph2026001
   ===================================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "learnova_db_v1";
  var SEED_VERSION = 1;
  var DAY = 864e5;
  var HOUR = 36e5;
  var PHASE_LABELS = { draft: "Bản nháp", upcoming: "Sắp giao", ongoing: "Đang giao", closed: "Đã giao" };

  var ls = (function () { try { return global.localStorage || null; } catch (e) { return null; } })();

  /* ===================== HÀM DÙNG CHUNG ===================== */

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

  /* ===================== SINH DỮ LIỆU GỐC ===================== */

  function buildSeed() {
    var NOW = Date.now();
    var midnight = new Date(NOW); midnight.setHours(0, 0, 0, 0);
    var at = function (d, h, m) { return new Date(midnight.getTime() + d * DAY + ((h || 0) * 60 + (m || 0)) * 60000).toISOString(); };

    var seed = 20260901; // bộ sinh số giả ngẫu nhiên cố định
    var rnd = function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    var between = function (a, b) { return a + rnd() * (b - a); };
    var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    var pad = function (n, w) { return String(n).padStart(w || 3, "0"); };
    var round1 = function (x) { return Math.round(x * 10) / 10; };

    /* ---------- 1. Tài khoản giáo viên + liên hệ admin ---------- */
    var teachers = [{
      id: "GV01", role: "teacher", fullName: "Nguyễn Thu Lan", gender: "female", dob: "1988-05-14",
      subject: "Toán", school: "THPT Learnova", email: "thulan@learnova.vn", phone: "0912 345 678",
      username: "gv.thulan", password: "123456", avatar: null,
      settings: { language: "vi", theme: "light", notifyEmail: true, notifyBrowser: true },
      security: { twoFactor: false, lastPasswordChange: at(-45) }
    }];
    var adminContact = { name: "Admin Learnova", email: "support@learnova.vn", phone: "1900 1234", hours: "Thứ 2 – Thứ 6, 8:00 – 17:00" };

    /* ---------- 2. Danh mục: chủ đề, độ khó, dạng câu, nhãn ---------- */
    var topics = [
      { id: "TP01", name: "Hàm số và đồ thị", grade: 10 },
      { id: "TP02", name: "Phương trình bậc hai", grade: 10 },
      { id: "TP03", name: "Vectơ", grade: 10 },
      { id: "TP04", name: "Lượng giác", grade: 11 },
      { id: "TP05", name: "Dãy số – Cấp số", grade: 11 },
      { id: "TP06", name: "Giới hạn", grade: 11 },
      { id: "TP07", name: "Đạo hàm", grade: 12 },
      { id: "TP08", name: "Nguyên hàm – Tích phân", grade: 12 }
    ];
    var difficulties = [
      { id: "nb", name: "Nhận biết" }, { id: "th", name: "Thông hiểu" },
      { id: "vd", name: "Vận dụng" }, { id: "vdc", name: "Vận dụng cao" }
    ];
    var PEN = { nb: 0, th: 0.05, vd: 0.13, vdc: 0.25 }; // độ khó trừ vào xác suất làm đúng
    var questionTypes = [
      { id: "multiple_choice", name: "Trắc nghiệm 1 đáp án", autoGrade: true },
      { id: "multi_select", name: "Trắc nghiệm nhiều đáp án", autoGrade: true },
      { id: "true_false", name: "Đúng / Sai", autoGrade: true },
      { id: "short_answer", name: "Trả lời ngắn", autoGrade: true },
      { id: "essay", name: "Tự luận (giáo viên chấm)", autoGrade: false }
    ];
    var tags = [
      { id: "co-ban", name: "Cơ bản", color: "#3b82f6" }, { id: "on-tap", name: "Ôn tập chương", color: "#eab308" },
      { id: "nang-cao", name: "Nâng cao", color: "#f97316" }, { id: "giua-ky", name: "Giữa kỳ", color: "#8b5cf6" },
      { id: "thi-thu", name: "Thi thử THPT", color: "#ef4444" }, { id: "15-phut", name: "15 phút", color: "#10b981" }
    ];

    /* ---------- 3. Lớp học ---------- */
    var classDefs = [["10A1", 10, 41], ["10A2", 10, 40], ["11A1", 11, 42], ["11A2", 11, 40], ["12A1", 12, 41], ["12A2", 12, 41]];
    var classes = classDefs.map(function (d, i) {
      return { id: "L" + d[0], name: d[0], grade: d[1], subject: "Toán", teacherId: "GV01", schoolYear: "2026-2027",
        room: "P." + (201 + i), status: "active", description: "Lớp " + d[0] + " – Toán " + d[1], createdAt: at(-60, 8) };
    });

    /* ---------- 4. Học sinh + phụ huynh (mỗi học sinh 1 phụ huynh) ---------- */
    var FAMILY = ["Nguyễn", "Nguyễn", "Nguyễn", "Trần", "Trần", "Lê", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
    var NAMES = {
      male: { mid: ["Văn", "Đức", "Minh", "Quang", "Hữu", "Gia", "Anh", "Thành"], given: ["Hùng", "Dũng", "Nam", "Khoa", "Long", "Phúc", "Quân", "Huy", "Tuấn", "Bình", "Đạt", "Kiên", "Sơn", "Thắng", "Hiếu", "Việt", "Khang", "Nhật", "Tâm", "Trung"] },
      female: { mid: ["Thị", "Thu", "Ngọc", "Khánh", "Phương", "Mai", "Bảo", "Diệu"], given: ["Lan", "Hoa", "Linh", "Trang", "Hương", "Ngân", "Thảo", "Chi", "Vy", "Nhi", "Yến", "Hà", "My", "Quỳnh", "Uyên", "Thư", "Trinh", "Dung", "Anh", "Mai"] }
    };
    var PINNED = { L10A1: ["Nguyễn Văn An", "male"], L11A2: ["Trần Thị Mai", "female"] }; // khớp thiết kế
    var students = [], parents = [], gen = {}, used = new Set(), n = 0;
    Object.keys(PINNED).forEach(function (k) { used.add(PINNED[k][0]); });

    classDefs.forEach(function (d, ci) {
      var c = classes[ci];
      var gradeTopics = topics.filter(function (t) { return t.grade === d[1]; }).map(function (t) { return t.id; });
      for (var i = 0; i < d[2]; i++) {
        n++;
        var pinned = i === 0 ? PINNED[c.id] : null;
        var gender = pinned ? pinned[1] : (rnd() < 0.5 ? "male" : "female");
        var name = pinned ? pinned[0] : "";
        while (!pinned && (!name || used.has(name))) {
          var p = NAMES[gender];
          name = pick(FAMILY) + " " + pick(p.mid) + " " + pick(p.given);
        }
        used.add(name);
        var born = 2010 - (d[1] - 10) - (rnd() < 0.25 ? 1 : 0);
        var username = "hs2026" + pad(n);
        students.push({
          id: "HS" + pad(n), role: "student", code: "HS2026" + pad(n), fullName: name, gender: gender,
          dob: born + "-" + pad(1 + Math.floor(rnd() * 12), 2) + "-" + pad(1 + Math.floor(rnd() * 28), 2),
          classId: c.id, email: username + "@learnova.vn", username: username, password: "123456",
          parentId: "PH" + pad(n), status: "active", joinedAt: at(-60, 8)
        });
        // năng lực ẩn dùng để sinh bài làm (không xuất ra dữ liệu)
        gen["HS" + pad(n)] = { ab: clamp(0.80 + (rnd() + rnd() + rnd() - 1.5) * 0.35, 0.3, 0.98), slope: between(-0.01, 0.025), weak: rnd() < 0.5 ? pick(gradeTopics) : null };

        var father = rnd() < 0.5, pg = NAMES[father ? "male" : "female"];
        parents.push({
          id: "PH" + pad(n), role: "parent", relation: father ? "Bố" : "Mẹ", childIds: ["HS" + pad(n)],
          fullName: name.split(" ")[0] + " " + pick(father ? ["Văn", "Đức", "Quang", "Minh"] : ["Thị", "Thu", "Ngọc", "Mai"]) + " " + pick(pg.given),
          email: "ph2026" + pad(n) + "@learnova.vn", phone: "09" + pad(Math.floor(rnd() * 1e8), 8),
          username: "ph2026" + pad(n), password: "123456"
        });
      }
    });

    /* ---------- 5. Ngân hàng câu hỏi (40 câu / 8 chủ đề) ---------- */
    var questions = [], qn = 0;
    function q(type, topicId, diff, content, options, answer, explanation) {
      var tg = diff === "nb" ? ["co-ban"] : diff === "th" ? ["on-tap"] : diff === "vd" ? ["nang-cao"] : ["nang-cao", "thi-thu"];
      if (type === "short_answer" || type === "true_false") tg.push("15-phut");
      if ((topicId === "TP07" || topicId === "TP08") && diff !== "nb") tg.push("giua-ky");
      questions.push({
        id: "Q" + pad(++qn), type: type, topicId: topicId, difficulty: diff, tags: tg, content: content,
        options: options ? options.map(function (t, i) { return { id: "ABCD"[i], text: t }; }) : null,
        answer: answer, explanation: explanation, points: type === "essay" ? 2 : 1,
        source: "bank", refId: null, status: "active", createdBy: "GV01", createdAt: at(-40, 9), updatedAt: at(-40, 9)
      });
    }
    var MC = "multiple_choice", MS = "multi_select", TF = "true_false", SA = "short_answer", ES = "essay";

    // TP01 – Hàm số và đồ thị
    q(MC, "TP01", "nb", "Tập xác định của hàm số y = √(x − 1) là:", ["[1; +∞)", "(1; +∞)", "(−∞; 1]", "ℝ"], "A", "Biểu thức dưới dấu căn phải không âm: x − 1 ≥ 0 ⇔ x ≥ 1.");
    q(MC, "TP01", "th", "Đỉnh của parabol y = x² − 4x + 3 là:", ["I(2; −1)", "I(−2; −1)", "I(2; 1)", "I(1; 0)"], "A", "Hoành độ đỉnh x = −b/(2a) = 2; y(2) = 4 − 8 + 3 = −1.");
    q(MC, "TP01", "th", "Hàm số y = −2x + 5 là hàm số:", ["Đồng biến trên ℝ", "Nghịch biến trên ℝ", "Đồng biến trên (0; +∞)", "Không đơn điệu trên ℝ"], "B", "Hệ số góc a = −2 < 0 nên hàm số nghịch biến trên ℝ.");
    q(TF, "TP01", "th", "Hàm số y = x² là hàm số chẵn.", null, true, "f(−x) = (−x)² = x² = f(x) với mọi x nên là hàm số chẵn.");
    q(SA, "TP01", "vd", "Giá trị nhỏ nhất của hàm số y = x² − 6x + 10 là bao nhiêu?", null, ["1"], "y = (x − 3)² + 1 ≥ 1, dấu bằng xảy ra khi x = 3.");
    // TP02 – Phương trình bậc hai
    q(MC, "TP02", "nb", "Tập nghiệm của phương trình x² − 5x + 6 = 0 là:", ["{2; 3}", "{−2; −3}", "{1; 6}", "{−1; −6}"], "A", "Tổng hai nghiệm bằng 5, tích bằng 6 nên các nghiệm là 2 và 3.");
    q(MC, "TP02", "th", "Phương trình x² − 2x + m = 0 có nghiệm kép khi m bằng:", ["0", "1", "2", "−1"], "B", "Δ' = 1 − m = 0 ⇔ m = 1.");
    q(MS, "TP02", "vd", "Chọn các phương trình có hai nghiệm phân biệt:", ["x² − 3x + 2 = 0", "x² + 2x + 1 = 0", "x² + x + 1 = 0", "2x² − 5x − 3 = 0"], ["A", "D"], "Δ lần lượt bằng 1; 0; −3; 49. Chỉ phương trình A và D có Δ > 0.");
    q(SA, "TP02", "vd", "Tổng hai nghiệm của phương trình 2x² − 7x + 3 = 0 là bao nhiêu? (nhập số thập phân hoặc phân số)", null, ["3.5", "7/2"], "Theo Vi-ét: x₁ + x₂ = −b/a = 7/2 = 3,5.");
    q(ES, "TP02", "vdc", "Cho phương trình x² − 2(m + 1)x + m² + 2 = 0. Tìm m để phương trình có hai nghiệm phân biệt x₁, x₂ thỏa mãn x₁² + x₂² = 10.", null,
      "Δ' = 2m − 1 > 0 ⇒ m > 1/2. Vi-ét: x₁ + x₂ = 2(m + 1), x₁x₂ = m² + 2. x₁² + x₂² = (x₁ + x₂)² − 2x₁x₂ = 2m² + 8m = 10 ⇒ m = 1 hoặc m = −5. Đối chiếu điều kiện: m = 1.",
      "Thang điểm: điều kiện Δ' (0,5đ); Vi-ét (0,5đ); giải ra m (0,5đ); kết luận đúng (0,5đ).");
    // TP03 – Vectơ
    q(MC, "TP03", "nb", "Cho hai điểm A(1; 2) và B(3; 5). Tọa độ vectơ AB là:", ["(2; 3)", "(4; 7)", "(−2; −3)", "(3; 2)"], "A", "AB = (3 − 1; 5 − 2) = (2; 3).");
    q(MC, "TP03", "th", "Cho a = (1; −2) và b = (3; 4). Tọa độ vectơ a + b là:", ["(4; 2)", "(2; −6)", "(4; −2)", "(−2; 6)"], "A", "a + b = (1 + 3; −2 + 4) = (4; 2).");
    q(MC, "TP03", "th", "Cho a = (1; 2) và b = (3; −1). Tích vô hướng a·b bằng:", ["5", "1", "−1", "0"], "B", "a·b = 1·3 + 2·(−1) = 1.");
    q(TF, "TP03", "nb", "Hai vectơ cùng phương thì luôn cùng hướng.", null, false, "Hai vectơ cùng phương có thể cùng hướng hoặc ngược hướng.");
    q(MC, "TP03", "vd", "Cho tam giác ABC có A(0; 0), B(4; 0), C(0; 3). Độ dài trung tuyến AM (M là trung điểm BC) bằng:", ["2,5", "2", "3", "√6"], "A", "M(2; 1,5) nên AM = √(4 + 2,25) = 2,5.");
    // TP04 – Lượng giác
    q(MC, "TP04", "nb", "Với mọi x, giá trị của sin²x + cos²x bằng:", ["0", "1", "2", "sin 2x"], "B", "Đây là hệ thức lượng giác cơ bản.");
    q(MC, "TP04", "th", "Nghiệm của phương trình sin x = 1/2 trong đoạn [0; 2π] là:", ["x = π/6 hoặc x = 5π/6", "x = π/3 hoặc x = 2π/3", "x = π/6 hoặc x = 7π/6", "x = π/3 hoặc x = 5π/3"], "A", "sin x = sin(π/6) ⇒ x = π/6 hoặc x = π − π/6 = 5π/6.");
    q(MC, "TP04", "th", "Chu kỳ tuần hoàn của hàm số y = cos 2x là:", ["π", "2π", "π/2", "4π"], "A", "T = 2π/|2| = π.");
    q(MS, "TP04", "th", "Chọn các hàm số có chu kỳ tuần hoàn nhỏ nhất bằng 2π:", ["y = sin x", "y = cos x", "y = tan x", "y = sin 2x"], ["A", "B"], "tan x có chu kỳ π; sin 2x có chu kỳ π.");
    q(SA, "TP04", "vd", "Số nghiệm của phương trình cos x = 1 trong đoạn [0; 4π] là bao nhiêu?", null, ["3"], "cos x = 1 ⇔ x = k2π; trong [0; 4π] có x = 0, 2π, 4π.");
    // TP05 – Dãy số, cấp số
    q(MC, "TP05", "nb", "Cấp số cộng (uₙ) có u₁ = 2 và công sai d = 3. Số hạng u₅ bằng:", ["14", "17", "11", "15"], "A", "u₅ = u₁ + 4d = 2 + 12 = 14.");
    q(MC, "TP05", "th", "Cấp số nhân có u₁ = 3 và công bội q = 2. Tổng 4 số hạng đầu bằng:", ["45", "48", "24", "93"], "A", "S₄ = 3 + 6 + 12 + 24 = 45.");
    q(TF, "TP05", "th", "Dãy số uₙ = 1/n là dãy số giảm.", null, true, "uₙ₊₁ − uₙ = 1/(n + 1) − 1/n < 0 với mọi n ≥ 1.");
    q(SA, "TP05", "vd", "Cho cấp số cộng có u₁ = 5 và u₁₀ = 32. Công sai d bằng bao nhiêu?", null, ["3"], "u₁₀ = u₁ + 9d ⇒ d = (32 − 5)/9 = 3.");
    q(MC, "TP05", "vd", "Cho cấp số nhân có u₂ = 6 và u₅ = 48. Công bội q bằng:", ["2", "3", "4", "8"], "A", "q³ = u₅/u₂ = 8 ⇒ q = 2.");
    // TP06 – Giới hạn
    q(MC, "TP06", "nb", "lim (n → ∞) 1/n bằng:", ["0", "1", "+∞", "−∞"], "A", "Khi n tăng vô hạn thì 1/n tiến về 0.");
    q(MC, "TP06", "th", "lim (x → 2) (x² − 4)/(x − 2) bằng:", ["0", "2", "4", "+∞"], "C", "(x² − 4)/(x − 2) = x + 2 → 4.");
    q(MC, "TP06", "th", "lim (x → +∞) (2x² + 1)/(x² − 3) bằng:", ["1", "2", "0", "+∞"], "B", "Chia cả tử và mẫu cho x² thì giới hạn bằng 2.");
    q(SA, "TP06", "vd", "Tính lim (n → ∞) (3n + 1)/(n + 2).", null, ["3"], "Chia cả tử và mẫu cho n: (3 + 1/n)/(1 + 2/n) → 3.");
    q(TF, "TP06", "th", "lim (x → 0) sin x / x = 0.", null, false, "Giới hạn cơ bản: lim (x → 0) sin x / x = 1.");
    // TP07 – Đạo hàm
    q(MC, "TP07", "nb", "Đạo hàm của hàm số y = x³ là:", ["3x²", "x²", "3x", "x³/3"], "A", "(xⁿ)' = n·xⁿ⁻¹.");
    q(MC, "TP07", "th", "Đạo hàm của hàm số y = sin x là:", ["cos x", "−cos x", "−sin x", "tan x"], "A", "(sin x)' = cos x.");
    q(MC, "TP07", "vd", "Hàm số y = x³ − 3x đạt cực tiểu tại:", ["x = 1", "x = −1", "x = 0", "x = 3"], "A", "y' = 3x² − 3 = 0 ⇔ x = ±1; y'' = 6x, y''(1) = 6 > 0 nên cực tiểu tại x = 1.");
    q(MS, "TP07", "th", "Chọn các khẳng định đúng:", ["(x²)' = 2x", "(cos x)' = sin x", "(eˣ)' = eˣ", "(ln x)' = 1/x với x > 0"], ["A", "C", "D"], "(cos x)' = −sin x nên khẳng định B sai.");
    q(ES, "TP07", "vdc", "Cho hàm số y = x³ − 3x² + 2. Khảo sát chiều biến thiên và tìm các điểm cực trị của hàm số.", null,
      "y' = 3x² − 6x = 3x(x − 2). Hàm số đồng biến trên (−∞; 0) và (2; +∞), nghịch biến trên (0; 2). Cực đại tại x = 0 (y = 2); cực tiểu tại x = 2 (y = −2).",
      "Thang điểm: tính y' (0,5đ); xét dấu y' (0,5đ); kết luận chiều biến thiên (0,5đ); điểm cực trị (0,5đ).");
    // TP08 – Nguyên hàm, tích phân
    q(MC, "TP08", "nb", "Nguyên hàm của hàm số f(x) = 2x là:", ["x² + C", "2x² + C", "x + C", "2 + C"], "A", "(x²)' = 2x.");
    q(MC, "TP08", "th", "Tích phân ∫₀¹ x dx bằng:", ["1/2", "1", "0", "2"], "A", "∫₀¹ x dx = [x²/2]₀¹ = 1/2.");
    q(MC, "TP08", "th", "Tích phân ∫₁² (1/x) dx bằng:", ["ln 2", "1", "ln 3", "1/2"], "A", "∫₁² (1/x) dx = [ln x]₁² = ln 2.");
    q(SA, "TP08", "vd", "Tính ∫₀² (3x² + 1) dx.", null, ["10"], "= [x³ + x]₀² = 8 + 2 = 10.");
    q(TF, "TP08", "th", "∫ cos x dx = −sin x + C.", null, false, "∫ cos x dx = sin x + C.");

    // Nguồn câu hỏi: ngân hàng / tài liệu tham khảo / nhập thủ công (GV_US08)
    var REF = { Q001: "TL01", Q002: "TL01", Q003: "TL01", Q017: "TL02", Q019: "TL02", Q022: "TL02", Q033: "TL03", Q039: "TL03" };
    questions.forEach(function (x) {
      if (REF[x.id]) { x.source = "reference"; x.refId = REF[x.id]; }
      else if (x.id === "Q010" || x.id === "Q024") x.source = "manual";
    });
    var referenceDocs = [
      { id: "TL01", title: "SGK Toán 10 – Hàm số bậc hai", fileType: "pdf", grade: 10, uploadedAt: at(-50, 10) },
      { id: "TL02", title: "Đề cương ôn tập giữa kỳ Toán 11", fileType: "docx", grade: 11, uploadedAt: at(-48, 10) },
      { id: "TL03", title: "Chuyên đề Đạo hàm – Tích phân nâng cao", fileType: "pdf", grade: 12, uploadedAt: at(-46, 10) }
    ].map(function (d) {
      d.questionIds = questions.filter(function (x) { return x.refId === d.id; }).map(function (x) { return x.id; });
      return d;
    });
    var qById = {};
    questions.forEach(function (x) { qById[x.id] = x; });

    /* ---------- 6. Bài tập & bài kiểm tra ---------- */
    var assignments = [], cfg = {};
    function asg(id, title, type, desc, classIds, qids, start, due, minutes, rate, extra) {
      extra = extra || {};
      var items = qids.map(function (id2) { return { questionId: id2, points: qById[id2].points }; });
      var published = extra.published !== false;
      var pub = published ? new Date(Math.min(midnight.getTime() + (start - 1) * DAY + 8 * HOUR, NOW - 2 * HOUR)).toISOString() : null;
      assignments.push({
        id: id, title: title, type: type, description: desc, subject: "Toán",
        topicIds: Array.from(new Set(qids.map(function (x) { return qById[x].topicId; }))),
        classIds: classIds, studentIds: extra.studentIds || [],
        items: items, totalPoints: items.reduce(function (s, i) { return s + i.points; }, 0),
        durationMinutes: minutes, startAt: at(start, 7), dueAt: at(due, 23, 59),
        published: published, publishedAt: pub,
        viewPolicy: type === "kiem_tra" ? { score: "after_grading", answers: "after_deadline" } : { score: "after_submit", answers: "after_grading" },
        createdBy: "GV01", createdAt: pub ? new Date(Date.parse(pub) - HOUR).toISOString() : at(-1, 9), updatedAt: pub || at(-1, 9)
      });
      cfg[id] = rate;
    }
    var weakest = students.filter(function (s) { return s.classId === "L11A1"; })
      .sort(function (a, b) { return gen[a.id].ab - gen[b.id].ab; }).slice(0, 6).map(function (s) { return s.id; });

    // Đang giao (khớp mục "Bài tập cần chú ý" trong thiết kế)
    asg("A01", "Ôn tập chương 3: Phương trình bậc hai", "bai_tap", "Ôn tập kiến thức chương 3 trước buổi kiểm tra.", ["L10A1"], ["Q006", "Q007", "Q008", "Q009", "Q010"], -4, 3, 0, 0.3);
    asg("A02", "Bài tập về nhà – Hàm số", "bai_tap", "Luyện tập tập xác định, tính đơn điệu và parabol.", ["L10A2"], ["Q001", "Q002", "Q003", "Q004", "Q005"], -5, 2, 0, 0.3);
    asg("A03", "Kiểm tra 15 phút – Chương 2: Dãy số", "kiem_tra", "Kiểm tra nhanh về cấp số cộng và cấp số nhân.", ["L11A1"], ["Q021", "Q022", "Q023", "Q024", "Q025"], -1, 1, 15, 0.35);
    asg("A04", "Bài tập nâng cao", "bai_tap", "Bài tập vận dụng cao về lượng giác, dãy số và giới hạn.", ["L11A2"], ["Q019", "Q020", "Q025", "Q028", "Q029"], -3, 1, 0, 0.55);
    asg("A05", "Ôn tập giữa kỳ", "kiem_tra", "Đề kiểm tra giữa kỳ phần Đạo hàm và Nguyên hàm – Tích phân.", ["L12A1", "L12A2"], ["Q031", "Q032", "Q033", "Q034", "Q035", "Q036", "Q037", "Q039"], -2, 1, 45, 0.3);
    asg("A13", "Bài bổ trợ – Cấp số cộng, cấp số nhân", "bai_tap", "Bài bổ trợ dành riêng cho các học sinh cần củng cố cấp số.", [], ["Q021", "Q022", "Q023", "Q024"], -2, 4, 0, 0.5, { studentIds: weakest });
    // Đã giao (hết hạn)
    asg("A06", "Kiểm tra 45 phút – Hàm số và đồ thị", "kiem_tra", "Kiểm tra 45 phút chương Hàm số và đồ thị.", ["L10A1", "L10A2"], ["Q001", "Q002", "Q003", "Q004", "Q005"], -11, -10, 45, 0.95);
    asg("A07", "Bài tập Vectơ trong mặt phẳng", "bai_tap", "Luyện tập tọa độ vectơ, tích vô hướng.", ["L10A1", "L10A2"], ["Q011", "Q012", "Q013", "Q014", "Q015"], -9, -6, 0, 0.9);
    asg("A08", "Kiểm tra 15 phút – Lượng giác", "kiem_tra", "Kiểm tra 15 phút phần Lượng giác.", ["L11A1", "L11A2"], ["Q016", "Q017", "Q018", "Q019", "Q020"], -9, -8, 15, 0.93);
    asg("A09", "Kiểm tra 45 phút – Đạo hàm", "kiem_tra", "Kiểm tra 45 phút chương Đạo hàm.", ["L12A1", "L12A2"], ["Q031", "Q032", "Q033", "Q034", "Q035"], -13, -12, 45, 0.94);
    asg("A10", "Bài tập Giới hạn", "bai_tap", "Luyện tập các dạng giới hạn cơ bản.", ["L11A1"], ["Q026", "Q027", "Q028", "Q029", "Q030"], -6, -3, 0, 0.88);
    asg("A14", "Kiểm tra 15 phút – Phương trình bậc hai", "kiem_tra", "Kiểm tra 15 phút phần Phương trình bậc hai.", ["L10A1", "L10A2"], ["Q006", "Q007", "Q008", "Q009"], -26, -25, 15, 0.9);
    asg("A15", "Bài tập Lượng giác cơ bản", "bai_tap", "Làm quen các công thức và phương trình lượng giác cơ bản.", ["L11A1", "L11A2"], ["Q016", "Q017", "Q018"], -21, -19, 0, 0.9);
    asg("A16", "Bài tập Nguyên hàm – Tích phân cơ bản", "bai_tap", "Luyện tập nguyên hàm và tích phân cơ bản.", ["L12A1", "L12A2"], ["Q036", "Q037", "Q038", "Q039"], -20, -18, 0, 0.9);
    // Sắp giao + bản nháp
    asg("A11", "Kiểm tra 15 phút – Nguyên hàm", "kiem_tra", "Kiểm tra 15 phút phần Nguyên hàm – Tích phân.", ["L12A2"], ["Q036", "Q037", "Q038", "Q039", "Q040"], 2, 3, 15, 0);
    asg("A12", "Bài tập Phương trình bậc hai (nâng cao)", "bai_tap", "Bản nháp: bài nâng cao, giao sau khi chốt đáp án.", ["L10A2"], ["Q008", "Q009", "Q010"], 4, 8, 0, 0, { published: false });

    /* ---------- 7. Bài làm của học sinh (tự chấm phần trắc nghiệm) ---------- */
    var ESSAY = {
      Q010: [
        "Δ' = 2m − 1 > 0 ⇒ m > 1/2. Theo Vi-ét: x₁ + x₂ = 2(m + 1), x₁x₂ = m² + 2. Khi đó x₁² + x₂² = 2m² + 8m = 10 ⇒ m = 1 hoặc m = −5. Đối chiếu điều kiện, chọn m = 1.",
        "Δ' = 2m − 1 > 0 nên m > 1/2. Dùng Vi-ét ra 2m² + 8m = 10 ⇒ m = 1 hoặc m = −5 (chưa đối chiếu điều kiện).",
        "Em mới viết được hệ thức Vi-ét: x₁ + x₂ = 2(m + 1), x₁x₂ = m² + 2, chưa giải tiếp được."
      ],
      Q035: [
        "y' = 3x² − 6x = 3x(x − 2). y' > 0 trên (−∞; 0) ∪ (2; +∞), y' < 0 trên (0; 2). Hàm số đạt cực đại tại x = 0 (y = 2), cực tiểu tại x = 2 (y = −2).",
        "y' = 3x² − 6x, y' = 0 ⇔ x = 0 hoặc x = 2. Cực đại tại x = 0, cực tiểu tại x = 2 (chưa tính giá trị cực trị).",
        "y' = 3x² − 6x. Em chưa xét dấu được y'."
      ]
    };
    var FEEDBACK = {
      hi: ["Bài làm tốt, trình bày rõ ràng.", "Rất tốt! Em nắm chắc kiến thức."],
      mid: ["Bài làm khá, cần cẩn thận hơn ở các câu vận dụng.", "Em xem lại các câu sai và đối chiếu lời giải nhé."],
      lo: ["Em cần ôn lại kiến thức nền tảng và làm thêm bài cơ bản.", "Em nên trao đổi thêm với cô trong giờ phụ đạo."]
    };
    var submissions = [], sn = 0, subMap = {};

    assignments.filter(function (a) { return a.published; }).forEach(function (a) {
      var startT = Date.parse(a.startAt), dueT = Date.parse(a.dueAt), endT = Math.min(dueT, NOW);
      if (endT <= startT) return; // chưa mở bài
      var closed = dueT < NOW;
      var hasEssay = a.items.some(function (i) { return qById[i.questionId].type === "essay"; });
      students.filter(function (s) { return a.classIds.indexOf(s.classId) >= 0 || a.studentIds.indexOf(s.id) >= 0; }).forEach(function (st) {
        var g = gen[st.id];
        if (rnd() > clamp(cfg[a.id] + (g.ab - 0.7) * 0.3, 0, 1)) return; // học sinh chưa nộp
        var t = startT + rnd() * (endT - startT);
        var ab = g.ab + g.slope * ((t - (NOW - 30 * DAY)) / (7 * DAY));
        var pending = false;
        var answers = a.items.map(function (it) {
          var qq = qById[it.questionId];
          var p = clamp(ab - PEN[qq.difficulty] - (g.weak === qq.topicId ? 0.22 : 0) + between(-0.05, 0.05), 0.05, 0.98);
          if (qq.type === "essay") {
            var lvl = p > 0.72 ? 0 : p > 0.45 ? 1 : 2, txt = ESSAY[qq.id][lvl];
            if (rnd() < (closed ? 0.12 : 0.85)) { pending = true; return { questionId: qq.id, answer: txt, isCorrect: null, points: null }; }
            var pts = [2, 1, 0.5][lvl];
            return { questionId: qq.id, answer: txt, isCorrect: pts === qq.points, points: pts };
          }
          var ok = rnd() < p, ans;
          if (qq.type === "multiple_choice") ans = ok ? qq.answer : pick(["A", "B", "C", "D"].filter(function (l) { return l !== qq.answer; }));
          else if (qq.type === "multi_select") {
            if (ok) ans = qq.answer.slice();
            else {
              var set = new Set(qq.answer), l = pick(["A", "B", "C", "D"]);
              if (set.has(l)) set.delete(l); else set.add(l);
              if (!set.size) set.add(pick(["A", "B", "C", "D"]));
              ans = Array.from(set).sort();
            }
          }
          else if (qq.type === "true_false") ans = ok ? qq.answer : !qq.answer;
          else ans = ok ? qq.answer[0] : String(Math.round(parseFloat(qq.answer[0]) + pick([-2, -1, 1, 2])));
          return { questionId: qq.id, answer: ans, isCorrect: ok, points: ok ? qq.points : 0 };
        });
        var earned = answers.reduce(function (s, x) { return s + (x.points || 0); }, 0);
        var graded = !pending, score10 = graded ? round1(earned / a.totalPoints * 10) : null;
        var dur = Math.round(between(0.45, 0.95) * (a.durationMinutes || 40) * 60);
        var rec = {
          id: "SB" + pad(++sn, 4), assignmentId: a.id, studentId: st.id, status: graded ? "graded" : "submitted",
          startedAt: new Date(t - dur * 1000).toISOString(), submittedAt: new Date(t).toISOString(), durationSec: dur,
          answers: answers, score: graded ? earned : null, maxScore: a.totalPoints, score10: score10,
          gradedAt: graded ? new Date(Math.min(t + between(0.2, 2) * HOUR, NOW)).toISOString() : null,
          gradedBy: graded ? (hasEssay ? "GV01" : "auto") : null,
          confirmed: graded && closed,
          feedback: graded && rnd() < 0.15 ? pick(FEEDBACK[score10 >= 8 ? "hi" : score10 >= 5 ? "mid" : "lo"]) : null
        };
        submissions.push(rec);
        subMap[a.id + "|" + st.id] = rec;
      });
    });
    var byStudent = {};
    submissions.forEach(function (s) { (byStudent[s.studentId] = byStudent[s.studentId] || []).push(s); });

    /* ---------- 8. Thông báo (GV / HS / PH) ---------- */
    var notifications = [], nn = 0;
    function note(userId, role, type, title, message, link, createdAt, read, meta) {
      notifications.push({ id: "N" + pad(++nn, 4), userId: userId, role: role, type: type, title: title, message: message, link: link, meta: meta || {}, createdAt: createdAt, read: read });
    }
    var stById = {};
    students.forEach(function (s) { stById[s.id] = s; });
    assignments.filter(function (a) { return a.published; }).forEach(function (a) {
      var startT = Date.parse(a.startAt), dueT = Date.parse(a.dueAt), label = a.type === "kiem_tra" ? "Bài kiểm tra mới: " : "Bài tập mới: ";
      var targets = students.filter(function (s) { return a.classIds.indexOf(s.classId) >= 0 || a.studentIds.indexOf(s.id) >= 0; });
      var submitted = 0, pendingEssay = 0, lastSub = null;
      targets.forEach(function (st) {
        var sub = subMap[a.id + "|" + st.id];
        note(st.id, "student", "assignment_new", label + a.title, "Giáo viên Nguyễn Thu Lan vừa giao bài mới.", { page: "assignment-detail", id: a.id }, a.publishedAt, !!sub || rnd() < 0.35, { assignmentId: a.id, dueAt: a.dueAt });
        if (startT <= NOW && dueT >= NOW && dueT - NOW < 2.5 * DAY && !sub)
          note(st.id, "student", "deadline_reminder", "Sắp đến hạn: " + a.title, "Bài sắp hết hạn, hãy hoàn thành sớm nhé.", { page: "assignment-detail", id: a.id }, new Date(NOW - between(0, 6) * HOUR).toISOString(), false, { assignmentId: a.id, dueAt: a.dueAt });
        if (sub) {
          submitted++; if (sub.status === "submitted") pendingEssay++;
          if (!lastSub || sub.submittedAt > lastSub) lastSub = sub.submittedAt;
        }
        if (sub && sub.status === "graded") {
          note(st.id, "student", "result_published", "Đã có kết quả: " + a.title, "Điểm của bạn: " + sub.score10 + "/10.", { page: "result-detail", id: sub.id }, sub.gradedAt, rnd() < 0.6, { assignmentId: a.id, submissionId: sub.id });
          note(st.parentId, "parent", "child_result", "Kết quả của " + st.fullName, a.title + ": " + sub.score10 + "/10.", { page: "result-detail", id: sub.id }, sub.gradedAt, rnd() < 0.5, { studentId: st.id, assignmentId: a.id, submissionId: sub.id });
        }
      });
      if (startT <= NOW && dueT >= NOW) {
        note("GV01", "teacher", "submission", submitted + "/" + targets.length + " học sinh đã nộp bài", a.title, { page: "assignment-results", id: a.id }, lastSub || a.publishedAt, false, { assignmentId: a.id });
        if (dueT - NOW < 2.5 * DAY) note("GV01", "teacher", "deadline_reminder", "Bài sắp đến hạn", a.title, { page: "assignment-results", id: a.id }, new Date(NOW - HOUR).toISOString(), false, { assignmentId: a.id });
      }
      if (pendingEssay > 0)
        note("GV01", "teacher", "need_grading", "Có " + pendingEssay + " bài tự luận chờ chấm", a.title, { page: "assignment-results", id: a.id }, lastSub, false, { assignmentId: a.id });
    });

    /* ---------- 9. Nhận xét của giáo viên + báo cáo học tập ---------- */
    var COMMENT = [
      "Em học tập rất tốt, nắm vững kiến thức và hoàn thành bài đúng hạn. Cần tiếp tục phát huy và thử sức với bài nâng cao.",
      "Em có tiến bộ, làm bài khá chắc. Cần chú ý hơn ở các câu vận dụng.",
      "Em nắm kiến thức ở mức trung bình. Nên ôn lại lý thuyết và làm thêm bài tập cơ bản.",
      "Kết quả còn thấp, em cần ôn lại kiến thức nền tảng. Cô sẽ hỗ trợ thêm trong giờ phụ đạo."
    ];
    var comments = [], cn = 0, avg = function (arr) { return arr.reduce(function (s, x) { return s + x.score10; }, 0) / arr.length; };
    students.forEach(function (st) {
      var g = (byStudent[st.id] || []).filter(function (s) { return s.status === "graded"; }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; });
      if (g.length < 2 || rnd() > 0.2) return;
      var times = rnd() < 0.3 ? 2 : 1;
      for (var k = 0; k < times; k++) {
        var older = times === 2 && k === 0, part = older ? g.slice(0, Math.ceil(g.length / 2)) : g, a = avg(part);
        comments.push({ id: "NX" + pad(++cn), studentId: st.id, teacherId: "GV01", content: COMMENT[a >= 8.5 ? 0 : a >= 7 ? 1 : a >= 5 ? 2 : 3],
          assignmentId: part[part.length - 1].assignmentId, visibleToParent: true, createdAt: at(older ? -14 : -3, 10), updatedAt: at(older ? -14 : -3, 10) });
      }
    });

    var d0 = new Date(NOW), pFrom = new Date(d0.getFullYear(), d0.getMonth() - 1, 1), pTo = new Date(d0.getFullYear(), d0.getMonth(), 0, 23, 59, 59);
    var period = { type: "month", label: "Tháng " + (pFrom.getMonth() + 1) + "/" + pFrom.getFullYear(), from: pFrom.toISOString(), to: pTo.toISOString() };
    var reports = [], bn = 0;
    classes.forEach(function (c) {
      students.filter(function (s) { return s.classId === c.id; }).slice(0, 3).forEach(function (st) {
        var sel = (byStudent[st.id] || []).filter(function (s) { return s.submittedAt >= period.from && s.submittedAt <= period.to; });
        var gr = sel.filter(function (s) { return s.status === "graded"; }).sort(function (a, b) { return a.submittedAt < b.submittedAt ? -1 : 1; });
        var summary = null;
        if (gr.length >= 2) {
          var ts = topicStats(gr, qById), half = Math.floor(gr.length / 2), trend = null;
          if (gr.length >= 4) { var diff = avg(gr.slice(half)) - avg(gr.slice(0, half)); trend = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat"; }
          summary = { submitted: sel.length, graded: gr.length, avgScore: round1(avg(gr)), trend: trend, topics: ts,
            weakTopics: ts.filter(function (t) { return t.weak; }).map(function (t) { return t.topicId; }),
            strongTopics: ts.filter(function (t) { return t.enough && t.rate >= 0.8; }).map(function (t) { return t.topicId; }) };
        } // summary = null ⇒ giao diện hiển thị "Chưa đủ dữ liệu"
        var cm = comments.filter(function (x) { return x.studentId === st.id; }).pop(), sent = rnd() < 0.8;
        reports.push({ id: "BC" + pad(++bn), studentId: st.id, classId: c.id, period: period, status: sent ? "sent" : "draft",
          createdAt: at(-2, 9), sentAt: sent ? at(-1, 8) : null, summary: summary, teacherComment: cm ? cm.content : null });
      });
    });

    return {
      meta: { seedVersion: SEED_VERSION, seededAt: new Date(NOW).toISOString(), schoolYear: "2026-2027", demoPassword: "123456" },
      adminContact: adminContact,
      teachers: teachers, classes: classes, students: students, parents: parents,
      topics: topics, difficulties: difficulties, questionTypes: questionTypes, tags: tags,
      referenceDocs: referenceDocs, questions: questions,
      assignments: assignments, submissions: submissions,
      notifications: notifications, comments: comments, reports: reports
    };
  }

  /* ===================== LƯU TRỮ (localStorage) ===================== */
  function persist(o) {
    try { if (ls) ls.setItem(STORAGE_KEY, JSON.stringify(o)); }
    catch (e) { console.warn("[Learnova] Không lưu được dữ liệu (localStorage đầy?)", e); }
  }
  function load() {
    try {
      if (ls) {
        var raw = ls.getItem(STORAGE_KEY);
        if (raw) { var o = JSON.parse(raw); if (o && o.meta && o.meta.seedVersion === SEED_VERSION) return o; }
      }
    } catch (e) { console.warn("[Learnova] Không đọc được dữ liệu cũ, tạo dữ liệu mới", e); }
    var fresh = buildSeed();
    persist(fresh);
    return fresh;
  }
  var db = load();

  /* ===================== TIỆN ÍCH TRUY VẤN ===================== */
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
      var fresh = buildSeed();
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
})(typeof window !== "undefined" ? window : globalThis);
