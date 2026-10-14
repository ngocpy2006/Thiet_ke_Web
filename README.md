# Thiet_ke_Web
Web phục vụ môn TK Web
`BTL_cuoiki/
├─ index.html                          Đăng nhập, chuyển trang theo vai trò
├─ assets/
│  └─ image/Logo.png
—---─ data.csv
├─ style.css
├─ main.js
│
├─ partial/                            Thành phần dùng chung cho 3 vai trò
│  ├─ sidebar/
│  │  ├─ sidebar.html
│  │  ├─ sidebar.css
│  │  └─ sidebar.js                     menu của 3 vai trò + đánh dấu mục đang chọn
│  ├─ topbar/
│  │  ├─ topbar.html
│  │  ├─ topbar.css
│  │  └─ topbar.js
│  ├─ footer/
│  │  ├─ footer.html
│  │  └─ footer.css
│  ├─ notification/                     trang THÔNG BÁO dùng chung
│  │  ├─ notification.html
│  │  ├─ notification.css
│  │  └─ notification.js
│  ├─ assignment/                   form danh sách bài chung 3 đối tượng
│  │  ├─ assignment.html
│  │  ├─ assignment.css
│  │  └─ assignment.js
│  └─ account                      form tài khoản chung 3 đối tượng
│     ├─ account.html
│     ├─ account.css
│     └─ account.js
│
├─ teacher/
│  ├─ overview/                  TỔNG QUAN
│  │  ├─ overview.html
│  │  ├─ overview.css
│  │  └─ overview.js
│  ├─ classes/                   DANH SÁCH LỚP
│  │  ├─ classes.html
│  │  ├─ classes.css
│  │  └─ classes.js
│  ├─ students/                  DANH SÁCH HỌC SINH
│  │  ├─ students.html
│  │  ├─ students.css
│  │  └─ students.js
│  ├─ question-bank/             NGÂN HÀNG CÂU HỎI
│  │  ├─ question-bank.html
│  │  ├─ question-bank.css
│  │  └─ question-bank.js
│  ├─ assignment-detail/              CHI TIẾT BÀI
│  │  ├─ assignment-detail.html
│  │  ├─ assignment-detail.css
│  │  └─ assignment-detail.js
│  ├─ create-assignment/         TẠO BÀI TẬP / BÀI KIỂM TRA
│  │  ├─ create-assignment.html
│  │  ├─ create-assignment.css
│  │  └─ create-assignment.js
|    |---ket_qua
│  ├─ analytics/                 PHÂN TÍCH CHUYÊN SÂU (4 bộ lọc: lớp, học sinh, thời gian, bài kiểm tra)
│  │  ├─ analytics.html
│  │  ├─ analytics.css
│  │  └─ analytics.js
│  ├─ submissions/               DANH SÁCH BÀI LÀM
│  │  ├─ submissions.html
│  │  ├─ submissions.css
│  │  └─ submissions.js
│  ├─ result-students/                DS HỌC SINH LÀM BÀI
│  │  ├─ result-students.html
│  │  ├─ result-students.css
│  │  └─ result-students.js
│  ├─ submission-detail/         CHI TIẾT BÀI LÀM CỦA HS (chấm tại đây)
│  │  ├─ submission-detail.html
│  │  ├─ submission-detail.css
│  │  └─ submission-detail.js
|    |    connect.js
├─ student/
│  ├─ assignment-detail/         THÔNG TIN BÀI (nút Làm bài)
│  │  ├─ assignment-detail.html
│  │  ├─ assignment-detail.css
│  │  └─ assignment-detail.js
│  ├─ exam/                      LÀM BÀI / KIỂM TRA
│  │  ├─ exam.html
│  │  ├─ exam.css
│  │  └─ exam.js
│  ├─ history/                   LỊCH SỬ BÀI LÀM
│  │  ├─ history.html
│  │  ├─ history.css
│  │  └─ history.js
│  ├─ result-detail/             CHI TIẾT KẾT QUẢ
│  │  ├─ result-detail.html
│  │  ├─ result-detail.css
│  │  └─ result-detail.js
│  ├─ analytics/                 PHÂN TÍCH HỌC TẬP (giống phân tích theo HS của giáo viên)
│  │  ├─ analytics.html
│  │  ├─ analytics.css
│  │  └─ analytics.js
│
└─ parent/                       làm nhanh: lấy html/css của các trang đã làm, đổi tiêu đề
   ├─ assignments/               DANH SÁCH BÀI KIỂM TRA CỦA CON (lấy của học sinh)
   │  ├─ assignments.html
   │  ├─ assignments.css
   │  └─ assignments.js
   ├─ result-detail/             CHI TIẾT BÀI LÀM (lấy của học sinh)
   │  ├─ result-detail.html
   │  ├─ result-detail.css
   │  └─ result-detail.js
   ├─ report/                    BÁO CÁO HỌC TẬP (giống phân tích chuyên sâu: học sinh, thời gian, bài kiểm tra)
   │  ├─ report.html
   │  ├─ report.css
   │  └─ report.js


