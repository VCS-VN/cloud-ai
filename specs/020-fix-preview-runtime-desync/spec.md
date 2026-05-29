# Feature Specification: Fix preview runtime state desync

**Feature Branch**: `020-fix-preview-runtime-desync`
**Created**: 2026-05-29
**Status**: Draft
**Input**: User description: "Preview chạy không ổn định: sau khi init project và bấm Start preview, server vẫn ghi nhận process trong pm2 nhưng UI tiếp tục hiển thị nút Start (badge Stopped/Error). Cần làm cho trang preview hiển thị đúng khi process thực sự đang chạy, và tự khôi phục các project đang stuck mà không cần thao tác tay."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bấm Start preview ngay sau khi init project và thấy storefront load (Priority: P1)

Sau khi vừa khởi tạo một project mới, người dùng bấm nút Start trên preview panel. Hệ thống chuẩn bị runtime, dev server thực sự lên, và trong vài giây kế tiếp người dùng thấy badge chuyển sang trạng thái "Running" và iframe preview render storefront thay vì tiếp tục hiện nút Start.

**Why this priority**: Đây là happy path quan trọng nhất của tính năng preview. Nếu thao tác đầu tiên này đã sai, mọi flow downstream (chỉnh sửa, redesign, kiểm thử) đều hỏng theo. Đây cũng là lỗi user đang phàn nàn: pm2 ghi nhận process nhưng UI vẫn báo Start. Sửa được path này trả lại trải nghiệm cốt lõi.

**Independent Test**: Init một project mới, bấm Start preview, quan sát preview panel trong vòng 30 giây. Tiêu chí pass: badge chuyển sang Running và iframe hiển thị storefront mà không cần bấm thêm bất kỳ nút nào hoặc reload trang.

**Acceptance Scenarios**:

1. **Given** một project vừa init xong và chưa từng chạy preview, **When** người dùng bấm Start, **Then** trong khoảng thời gian dev server lên và phản hồi bình thường, UI chuyển sang Running và render iframe preview, không hiện lại nút Start.
2. **Given** dev server đã hoạt động ổn định ở phía hạ tầng nội bộ, **When** UI poll trạng thái runtime, **Then** UI báo Running ngay từ chu kỳ poll đầu tiên xác nhận được process đang sống và đã có địa chỉ preview hợp lệ.
3. **Given** runtime thực sự đã sẵn sàng nhưng tầng định tuyến công khai (Cloudflare/tunnel) chưa kịp propagate, **When** hệ thống quyết định trạng thái Running, **Then** quyết định này không phụ thuộc vào việc tầng công khai đã reachable hay chưa.

---

### User Story 2 - Project đang stuck tự khôi phục sau deploy fix (Priority: P1)

Một số project hiện tại đang ở trạng thái stuck: pm2 vẫn ghi nhận process đang chạy nhưng UI hiện badge Stopped hoặc Error kèm nút Start. Sau khi fix được deploy, người dùng quay lại trang project mà không cần thao tác đặc biệt nào, UI tự cập nhật về Running trong vòng một chu kỳ poll.

**Why this priority**: Đồng hạng P1 với User Story 1 vì đây là cách user đang gặp lỗi thoát khỏi trạng thái sai mà không cần liên hệ support hoặc xoá project. Nếu thiếu story này, fix chỉ áp dụng cho project tương lai và mọi project đang stuck phải xử lý thủ công.

**Independent Test**: Trên một project đang stuck (badge Stopped/Error nhưng pm2 báo process online và đã có địa chỉ preview/cổng), mở trang project sau khi fix deploy. Tiêu chí pass: trong vòng một chu kỳ poll, badge tự chuyển Running và iframe hiển thị storefront, không cần xoá project, không cần restart server, không cần migration thủ công.

**Acceptance Scenarios**:

1. **Given** một project đang ở trạng thái Error nhưng process thực tế đang chạy và đã có địa chỉ preview/cổng, **When** UI poll trạng thái, **Then** trạng thái được nâng cấp lên Running và thông điệp lỗi cũ không còn hiển thị bên cạnh badge.
2. **Given** một project đang ở trạng thái Stopped nhưng process thực tế đang chạy và đã có địa chỉ preview/cổng, **When** UI poll trạng thái, **Then** trạng thái được nâng cấp lên Running.
3. **Given** một project đã được người dùng chủ động tắt preview (không còn được phép chạy) nhưng vì lý do nào đó vẫn còn process tồn lưu, **When** UI poll trạng thái, **Then** trạng thái KHÔNG bị nâng cấp lên Running; quy trình dọn dẹp riêng sẽ chịu trách nhiệm xoá process tồn lưu đó.

---

### User Story 3 - Trạng thái UI luôn nhất quán với thực tế process (Priority: P2)

Người dùng nhìn vào preview panel và badge luôn phản ánh thực tế: nếu process thực sự đang chạy và phục vụ được request, badge là Running; nếu process thực sự không chạy hoặc không phục vụ được, badge không phải Running. Không có trường hợp UI báo một đằng, hạ tầng một nẻo trong thời gian dài.

**Why this priority**: P2 vì đây là invariant chất lượng tổng quát giúp ngăn lỗi tương tự xuất hiện trở lại với hình thái khác. Hai story trên đã đủ giải quyết user complaint hiện tại; story này bảo đảm hệ thống không trôi dạt sang một mismatch mới.

**Independent Test**: Mô phỏng các tổ hợp trạng thái lưu trữ × trạng thái process × cờ enabled × có/không có địa chỉ preview, gọi API lấy trạng thái runtime, so kết quả với bảng quyết định. Tiêu chí pass: mọi tổ hợp đều khớp bảng — nâng cấp đúng tổ hợp cần nâng cấp, không nâng cấp các tổ hợp còn lại.

**Acceptance Scenarios**:

1. **Given** trạng thái lưu trữ cho biết runtime đáng lẽ đang Running nhưng process thực tế không tồn tại hoặc không khoẻ, **When** API lấy trạng thái được gọi, **Then** UI nhận về một trạng thái không phải Running phản ánh đúng thực tế.
2. **Given** trạng thái lưu trữ là Stopped/Error trong khi process thực tế đang khoẻ và có đủ địa chỉ preview/cổng, và preview vẫn được phép chạy, **When** API lấy trạng thái được gọi, **Then** trạng thái trả về là Running và thông điệp lỗi cũ không còn xuất hiện.
3. **Given** preview đang Running nhưng thiếu địa chỉ preview hoặc thiếu cổng, **When** API lấy trạng thái được gọi, **Then** hệ thống không khẳng định Running mà phản ánh đúng dữ liệu thiếu.

---

### Edge Cases

- Ngay sau khi process được start, trong vài giây đầu Vite có thể chưa biên dịch xong: hệ thống cần xác định "đang chạy" dựa trên tín hiệu hạ tầng nội bộ, không phụ thuộc tầng định tuyến công khai.
- Project vừa được người dùng yêu cầu tắt: nếu process tồn lưu vẫn còn, UI không được "hồi sinh" preview — tránh xung đột với quy trình dọn dẹp.
- Project chưa từng start preview: trạng thái mặc định không được tự dưng trở thành Running chỉ vì có một process trùng tên đâu đó.
- App server vừa restart: có thể tồn tại process cũ từ phiên trước. UI phải hiển thị đúng theo nguyên tắc "process khoẻ + được phép chạy + có đủ thông tin truy cập" mới là Running.
- Khi nâng cấp trạng thái lên Running, các thông điệp lỗi cũ trong trạng thái lưu trữ phải được xoá để UI không hiện cùng lúc badge Running và một dòng lỗi cũ gây hiểu nhầm.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST quyết định "preview đã sẵn sàng" sau khi khởi tạo dev server dựa trên một tín hiệu phục vụ ở tầng hạ tầng nội bộ (loopback) thay vì tầng truy cập công khai (Cloudflare/tunnel/DNS), để tránh phụ thuộc vào độ trễ propagate ngoài tầm kiểm soát.
- **FR-002**: Hệ thống MUST tự động đồng bộ trạng thái runtime với thực tế process mỗi lần truy vấn trạng thái: nếu trạng thái lưu trữ không phải Running nhưng process thực tế đang khoẻ và đã có đủ thông tin truy cập (địa chỉ preview, cổng), và preview vẫn được phép chạy, thì trạng thái trả về phải là Running.
- **FR-003**: Hệ thống MUST không nâng cấp trạng thái lên Running cho các project đã bị chủ động tắt preview, kể cả khi process tồn lưu vẫn còn ở hạ tầng. Trách nhiệm dọn process tồn lưu thuộc về quy trình dọn dẹp riêng đã có sẵn.
- **FR-004**: Hệ thống MUST không nâng cấp trạng thái lên Running khi thiếu địa chỉ preview hoặc thiếu cổng, vì đây là điều kiện tối thiểu để UI có thể render iframe.
- **FR-005**: Khi nâng cấp trạng thái lên Running, hệ thống MUST xoá thông điệp lỗi và phân loại lỗi đang lưu trong trạng thái runtime để UI không hiển thị lỗi cũ song song với badge Running.
- **FR-006**: Hệ thống MUST tiếp tục hạ cấp trạng thái khỏi Running khi process thực tế không còn khoẻ (đã có hành vi này trước đây và phải được giữ nguyên).
- **FR-007**: Hệ thống MUST không yêu cầu thao tác thủ công (chạy script, can thiệp database, restart server, xoá project) để khôi phục các project đang stuck sau khi fix được áp dụng. Việc khôi phục phải tự động xảy ra trong chu kỳ poll trạng thái thông thường của UI.
- **FR-008**: Hành vi đối xử với các project đã tắt preview MUST không thay đổi: cờ "không được phép chạy" vẫn là tín hiệu kết thúc cho live status; quy trình dọn dẹp định kỳ vẫn xoá các process tồn lưu của project nhóm này.
- **FR-009**: Hệ thống MUST không thay đổi giao diện preview panel: UI hiện hành đã có sẵn các trạng thái cần thiết, chỉ cần dữ liệu trạng thái trả về đúng là UI sẽ hiển thị đúng.
- **FR-010**: Hệ thống MUST giữ nguyên hành vi của tầng định tuyến công khai (xác thực truy cập, proxy đến cổng nội bộ, dọn DNS khi xoá project) — fix không được mở rộng phạm vi sang các thành phần này.

### Key Entities *(include if feature involves data)*

- **Trạng thái runtime của project preview**: bản ghi mô tả tình trạng dev server cho một project, gồm các trường có ý nghĩa nghiệp vụ: trạng thái logic (đang cài đặt / đã cài / đang khởi động / đang chạy / đã dừng / lỗi / đang sửa), cờ "được phép chạy", địa chỉ preview, cổng nội bộ, mô tả lỗi gần nhất, phân loại lỗi gần nhất, dấu vết thời gian. Đây là nguồn dữ liệu mà UI poll và hiển thị.
- **Tín hiệu sống của process preview**: thông tin về process đang chạy thực tế ở hạ tầng quản lý process, đại diện cho "thực tế" so với "trạng thái lưu trữ". Có giá trị: đang khoẻ, đã dừng, không tìm thấy, đang khởi động, lỗi.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi bấm Start preview cho một project vừa init, từ thời điểm hạ tầng xác nhận process khoẻ và đã có địa chỉ preview/cổng, UI hiển thị trạng thái Running trong vòng tối đa một chu kỳ poll thông thường (≤ 3 giây), 100% trên các lần thử trong môi trường tích hợp.
- **SC-002**: 100% project đang stuck với hình thái "process thực sự đang chạy + đã có địa chỉ preview + được phép chạy + UI hiển thị Stopped/Error" tự khôi phục về Running mà không cần thao tác tay sau khi fix được deploy.
- **SC-003**: 0 project đã bị chủ động tắt preview bị nâng cấp ngược lên Running do quy tắc đồng bộ mới.
- **SC-004**: Việc xác định "preview đã sẵn sàng" sau khi start không còn phụ thuộc vào độ trễ propagate của tầng định tuyến công khai: trong môi trường mô phỏng tầng công khai chưa reachable nhưng process nội bộ đã sẵn sàng, kết quả Start preview trả về thành công và trạng thái lưu trữ là Running.
- **SC-005**: Số ticket/feedback liên quan đến "không thấy preview dù pm2 vẫn chạy" giảm xuống 0 trong 30 ngày sau khi deploy.
- **SC-006**: Khi UI hiển thị Running, không có trường hợp nào kèm theo dòng thông điệp lỗi cũ — kiểm chứng bằng cách scan tất cả trạng thái runtime trả về cho UI sau fix.

## Assumptions

- Hạ tầng quản lý process hiện tại (pm2) cung cấp tín hiệu sống đáng tin cậy cho mỗi project; quyết định nâng cấp trạng thái dựa vào tín hiệu này là an toàn.
- Dev server của project khi đã sẵn sàng sẽ phản hồi request đến cổng loopback nội bộ trong khoảng thời gian ngắn (thấp hơn nhiều so với cửa sổ chờ hiện tại 45 giây), không cần endpoint health riêng.
- UI hiện hành đã có poll trạng thái runtime đều đặn; việc tự khôi phục không cần thay đổi UI, chỉ cần dữ liệu trả về đúng.
- Quy trình dọn dẹp định kỳ (reconciler) đang chịu trách nhiệm xoá process tồn lưu cho project đã tắt preview tiếp tục hoạt động và đủ tốt — fix không cần can thiệp.
- Lịch sử lỗi không cần được giữ trong trạng thái runtime sau khi nâng cấp Running; log phía server đủ cho mục đích điều tra sau này.
- Phạm vi mode triển khai cho người dùng đang gặp lỗi là môi trường có địa chỉ preview công khai (Cloudflare tunnel + tên miền). Fix vẫn áp dụng tốt cho môi trường dev nội bộ vì cùng một logic trạng thái, nhưng môi trường dev không phải là nơi triệu chứng phát sinh.
