<!-- 
Sync Impact Report:
- Version change: 1.4.0 -> 1.4.1
- Added sections: None
- Modified principles: Principle VI (AI Agent generated project-detail env exception for `VITE_STORE_SLUG`)
- Removed sections: None
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ no changes needed
  - .specify/templates/spec-template.md ✅ no changes needed
  - .specify/templates/tasks-template.md ✅ no changes needed
  - AGENTS.md ⚠ pending (existing import convention follow-up remains)
- Follow-up TODOs: Audit existing imports across codebase for compliance with Principle X; migrate non-compliant imports in a separate cleanup pass
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

AI Agent không được sửa repository-level hoặc Builder application `.env`/secret files. Ngoại lệ hẹp: khi feature yêu cầu đồng bộ selected store slug, AI Agent chỉ được thêm hoặc cập nhật `VITE_STORE_SLUG` trong generated project-detail `.env` files, đồng thời phải giữ nguyên các biến env không liên quan.

### VII. Code Review & Impact Analysis ưu tiên Graph
Khi review code, **ưu tiên sử dụng `code-graph-review`** để đánh giá toàn diện các liên kết feature, function và flow trong project trước, sau đó mới đi sâu vào review các route và component cụ thể được đề cập update.

### VIII. Chuẩn hóa Code Formatting
Sau khi cập nhật code, bắt buộc phải chạy format theo cấu hình ESLint của dự án để đảm bảo tính nhất quán về style code trước khi commit/merge.

### IX. Database JSON Type Convention
Tất cả các field JSON trong database (PostgreSQL) bắt buộc sử dụng type `json`, **không được dùng** `jsonb`. Việc dùng `json` bảo toàn định dạng gốc (whitespace, thứ tự key), giúp dữ liệu dễ đọc, debug, và kiểm soát diff chính xác hơn. Các schema Drizzle ORM mới và migration mới phải dùng `json()` thay vì `jsonb()`.

### X. Import Alias Convention
Bắt buộc sử dụng alias `@/` (tương đương `src/`) hoặc `@app/` (tương đương `app/`) cho mọi import giữa các folder. Không sử dụng `../` hoặc `~` để import file từ folder khác.

**Quy tắc:**
- **Cùng folder**: Được phép dùng `./filename` (ví dụ: `./utils.ts`)
- **Khác folder**: Bắt buộc dùng `@/path/to/file` hoặc `@app/path/to/file`
- **Không được**: Dùng `../` hoặc `~` cho bất kỳ import nào

**Ví dụ đúng:**
```tsx
// File: src/components/projects/ProjectCard.tsx
import { Button } from "@/components/ui/button";        // khác folder → dùng @/
import { formatDate } from "@/utils/date";               // khác folder → dùng @/
import { ProjectList } from "./ProjectList";             // cùng folder → dùng ./
```

**Ví dụ sai:**
```tsx
import { Button } from "../../ui/button";    // SAI: dùng ../../ thay vì @/
import { utils } from "~/lib/utils";         // SAI: dùng ~ thay vì @/
```

**Lý do:** Alias giúp import path ổn định khi di chuyển file, dễ đọc hơn, và tránh lỗi "relative path hell" khi refactor. Cấu hình `tsconfig.json` đã có sẵn `paths` mapping cho `@/*` và `@app/*`.

## Architecture & UX Requirements

- Giao diện: Icon cần dùng semantic theme tokens (ví dụ: `--app-icon`, `--app-icon-muted`). Tuyệt đối không hardcode color bằng hex hay các màu trực tiếp kiểu `text-white`, `text-black` trừ khi là brand asset cố định.
- Chuyển cảnh (Transitions): Yêu cầu tính tinh tế (subtle) để giữ độ mượt mà.

## Governance & Review Process

- Amendments phải được sự đồng ý của Product Owner/Lead.
- Toàn bộ thay đổi phải tuân theo Core Principles trên. Nếu có vi phạm (ví dụ API lỗi không đúng chuẩn, hoặc UX code hardcode color không theo DESIGN.md) thì Pull Request sẽ bị reject.

**Version**: 1.4.1 | **Ratified**: 2026-05-05 | **Last Amended**: 2026-05-18
