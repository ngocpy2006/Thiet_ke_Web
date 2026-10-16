# Giao diện học sinh

Mở thư mục BTL_cuoiki bằng Live Server.

- Lớp học: student/classes/classes.html
- Danh sách bài: partial/assignment/assignment.html?role=student&phase=ongoing
- Thông tin bài: student/assignment-detail/assignment-detail.html
- Làm bài: student/exam/exam.html
- Lịch sử: student/history/history.html
- Kết quả và phân tích: đã có khung chung, nội dung chưa được triển khai.

main.js tải sidebar, topbar, footer từ partial. sidebar.js chọn menu theo PAGE.role;
topbar.js hiển thị hồ sơ cùng vai trò từ DB. Khi chưa có đăng nhập, dùng bản ghi đầu
tiên của vai trò; có thể cấu hình PAGE.userId. Đây là lựa chọn hồ sơ demo, không phải
cơ chế xác thực/phân quyền.

Mỗi thư mục trang chứa HTML, CSS riêng và JS cấu hình PAGE. student.css bổ sung
bố cục học sinh, dùng biến màu/font của style.css. Nội dung mẫu của developer được
giữ; chức năng làm bài, nộp bài và thống kê dữ liệu chưa được triển khai ở đợt này.

Danh sách bài dùng chung HTML chính ở partial/assignment/assignment.html.
student-assignment.html chỉ chứa nội dung học sinh; không chứa sidebar/topbar/footer.
teacher dùng assignment.js hiện có, student dùng student-assignment.js để chuyển tab.

Các file cũ được lưu trong bản sao ZIP tại tool/backups trước khi chuẩn hóa.
