<!-- 
Sync Impact Report:
- Version change: 1.1.0 -> 1.2.0
- Added sections: Principle VIII (Code Formatting)
- Modified principles: 
  - Principle I updated to enforce clear code flow between UI client, service flow, repository, and database.
  - Principle V updated to enforce strict adherence to DESIGN.md tokens and theming even when mimicking images.
  - Principle VII updated to prioritize code-graph-review before reviewing specific routes/components.
- Templates requiring updates: ✅ updated (N/A for constitution self-update)
-->
# Cloud-AI Constitution

## Core Principles

### I. Yêu cầu rõ ràng code flow & tính năng
Mọi chức năng, module mới đều cần được đặc tả và xác nhận rõ ràng trước khi tiến hành viết code. Bắt buộc phải có sự phân định rõ ràng code flow giữa các tầng: UI client, flow service, repository, và database. Hạn chế tối đa việc đoán ý dẫn đến code sai lệch so với logic kinh doanh.

### II. Test cho mọi business rule quan trọng
Bắt buộc phải có test cases cho các luồng xử lý dữ liệu và business rules cốt lõi. Ưu tiên test sớm (TDD/BDD tùy ngữ cảnh) để đảm bảo chất lượng.

### III. API trả lỗi nhất quán
Các API endpoint bắt buộc phải tuân thủ chuẩn format lỗi thống nhất. Mã HTTP Status, mã lỗi nội bộ (nếu có), và message lỗi cần được chuẩn hóa.

### IV. Không over-engineer
Kiến trúc, pattern, và logic phải đủ dùng cho hiện tại (YAGNI). Tránh thêm các layers, abstractions không cần thiết làm hệ thống phức tạp và khó bảo trì.

### V. UX đơn giản, Validation Client/Server & Design System Compliance
Mọi đầu vào từ người dùng phải được validate ở cả phía Client và Server. Giao diện người dùng phải mượt mà, sử dụng transition phù hợp.
**Đặc biệt:** Các UI components bắt buộc phải tuân thủ rule thiết kế của file `DESIGN.md`. Cho dù có dựa vào hình ảnh tham khảo để dựng layout/khung thiết kế, việc sử dụng design tokens và màu sắc theme tuyệt đối phải theo chuẩn của `DESIGN.md`. Không tự ý hardcode màu sắc ngoài hệ thống token.

### VI. Bảo mật theo role/permission
Hệ thống xác thực và phân quyền phải được áp dụng chặt chẽ từ Frontend đến Backend. Các tác vụ nhạy cảm phải được kiểm tra Role và Permission phù hợp.

### VII. Code Review & Impact Analysis ưu tiên Graph
Khi review code, **ưu tiên sử dụng `code-graph-review`** để đánh giá toàn diện các liên kết feature, function và flow trong project trước, sau đó mới đi sâu vào review các route và component cụ thể được đề cập update.

### VIII. Chuẩn hóa Code Formatting
Sau khi cập nhật code, bắt buộc phải chạy format theo cấu hình ESLint của dự án để đảm bảo tính nhất quán về style code trước khi commit/merge.

## Architecture & UX Requirements

- Giao diện: Icon cần dùng semantic theme tokens (ví dụ: `--app-icon`, `--app-icon-muted`). Tuyệt đối không hardcode color bằng hex hay các màu trực tiếp kiểu `text-white`, `text-black` trừ khi là brand asset cố định.
- Chuyển cảnh (Transitions): Yêu cầu tính tinh tế (subtle) để giữ độ mượt mà.

## Governance & Review Process

- Amendments phải được sự đồng ý của Product Owner/Lead.
- Toàn bộ thay đổi phải tuân theo Core Principles trên. Nếu có vi phạm (ví dụ API lỗi không đúng chuẩn, hoặc UX code hardcode color không theo DESIGN.md) thì Pull Request sẽ bị reject.

**Version**: 1.2.0 | **Ratified**: 2026-05-05 | **Last Amended**: 2026-05-05
