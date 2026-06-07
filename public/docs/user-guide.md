# Hướng dẫn sử dụng Cloud AI Builder

Cloud AI Builder giúp bạn dựng một storefront hoàn chỉnh chỉ bằng cách trò chuyện với AI. Bạn không cần biết code, không cần lo về kỹ thuật — chỉ cần mô tả cửa hàng bạn muốn, AI sẽ lo phần còn lại.

Tài liệu này dành cho chủ shop, nhà bán lẻ, và đội ngũ vận hành tại Việt Nam. Bạn sẽ học cách tạo dự án đầu tiên, làm việc với AI, hiểu các thông báo trong quá trình dựng, và xử lý khi gặp trục trặc.

---

## Mục lục

1. [Bắt đầu](#bat-dau)
2. [Khám phá workspace](#workspace)
3. [Trò chuyện với AI](#chat)
4. [Hiểu thông báo và tiến trình](#tien-trinh)
5. [Trả lời câu hỏi của AI](#clarification)
6. [Quản lý preview](#preview)
7. [Xem code](#code-view)
8. [Cài đặt dự án](#settings)
9. [Khi gặp sự cố](#troubleshoot)
10. [Mẹo và phím tắt](#tips)
11. [Câu hỏi thường gặp](#faq)

---

## 1. Bắt đầu {#bat-dau}

### Đăng nhập

Bạn đăng nhập Cloud AI Builder bằng tài khoản OAuth. Truy cập trang chủ rồi bấm **Đăng nhập** — hệ thống sẽ chuyển sang trang xác thực, sau đó tự động đưa bạn về **Dashboard**.

> **Mẹo:** Nếu bạn đã đăng nhập rồi mà vào lại trang chủ, app sẽ tự đưa bạn thẳng vào **Dashboard**. Ngược lại, nếu bạn chưa đăng nhập mà mở một trang dự án, app sẽ đưa bạn về trang đăng nhập trước.

### Tạo dự án đầu tiên

Có hai cách bắt đầu một dự án mới:

**Từ trang chủ:** Bạn sẽ thấy phần giới thiệu cùng 6 gợi ý sẵn — ví dụ *Fashion store homepage*, *Product collection page*. Bấm vào một gợi ý để điền sẵn ô prompt, hoặc tự nhập mô tả riêng của bạn. Sau đó bấm gửi.

**Từ Dashboard:** Sau khi đăng nhập, bạn sẽ thấy lời chào *"What should we build, {tên bạn}?"* và một ô nhập prompt. Mô tả cửa hàng bạn muốn dựng rồi gửi.

Khi bạn gửi prompt, hệ thống sẽ:
1. Tạo một dự án mới
2. Chuyển bạn vào trang chi tiết của dự án (URL dạng `/projects/<id>`)
3. AI bắt đầu phân tích yêu cầu và dựng cửa hàng cho bạn

> **Mẹo viết prompt tốt:** Càng cụ thể càng tốt. Thay vì *"Tạo cho tôi một shop"*, hãy thử *"Tạo cửa hàng quần áo nữ phong cách tối giản, tông màu pastel, có trang chủ với banner lớn và khu sản phẩm nổi bật"*.

### Trang quản lý dự án

Truy cập `/projects` để xem toàn bộ dự án của bạn:

- **Chế độ hiển thị:** Bấm để chuyển giữa **Grid** (lưới thẻ) và **List** (danh sách).
- **Tìm kiếm:** Gõ tên dự án vào ô tìm kiếm để lọc nhanh.
- **Sắp xếp:** Mặc định sắp theo *Last edited* (chỉnh sửa gần nhất).
- **Mỗi thẻ dự án** hiển thị: tên, badge trạng thái (**Draft**, **Generating**, **Ready**, **Failed**), ngày cập nhật, và ảnh thumbnail.

Khi bạn chưa có dự án nào, trang sẽ hiển thị empty state mời bạn tạo dự án đầu tiên.

---

## 2. Khám phá workspace {#workspace}

Mỗi dự án mở ra trong một workspace 3 cột:

| Cột | Vị trí | Nội dung |
|-----|--------|----------|
| Trái | Chat | Lịch sử trò chuyện với AI |
| Giữa | Preview / Code | Xem giao diện đang dựng hoặc xem code (đọc) |
| Phải | Tuỳ ngữ cảnh | Thông tin bổ sung |

### Resize và ẩn cột chat

- **Kéo viền cột chat** để thay đổi độ rộng. Tối thiểu 320px, tối đa 55% chiều rộng màn hình.
- Kích thước bạn chọn **được lưu lại** trong trình duyệt — lần sau quay lại vẫn giữ nguyên.
- Bấm nút **Hide chat** để gập cột chat lại nếu cần thêm không gian xem preview. Bấm lại để mở ra.

### Header của chat

Phía trên cột chat có:

- Tên dự án và badge trạng thái
- Badge **Processing** khi AI đang chạy một run
- Ngày cập nhật gần nhất
- Nút **Back** đưa bạn về danh sách dự án
- Nút **Settings** mở drawer cài đặt
- Nút **Hide chat** để gập cột chat

---

## 3. Trò chuyện với AI {#chat}

Mọi tương tác với AI diễn ra qua khung soạn tin (composer) ở dưới cùng cột chat.

### Soạn tin và gửi

- Ô nhập tối đa **12.000 ký tự**.
- Bấm **Enter** để gửi. **Shift + Enter** để xuống dòng.
- Khi AI đang xử lý, ô nhập sẽ bị khoá — bạn không thể gửi tin mới cho đến khi run hiện tại kết thúc.

### Reasoning Effort

Ngay trên ô nhập có dropdown **Reasoning Effort** với 4 mức:

| Mức | Khi nên dùng |
|-----|--------------|
| **low** | Yêu cầu đơn giản, đổi màu, đổi text |
| **medium** *(mặc định)* | Hầu hết thay đổi giao diện thông thường |
| **high** | Thay đổi phức tạp, nhiều trang cùng lúc |
| **xhigh** | Tái cấu trúc lớn, logic phức tạp |

Mức cao hơn cho kết quả kỹ hơn nhưng chậm hơn. Bắt đầu ở **medium**, chỉ tăng khi bạn thấy AI hiểu chưa đủ.

### Plan mode

Bật toggle **Plan mode** (chuyển sang màu xanh chanh) để AI **lên kế hoạch trước** thay vì làm ngay. Trong chế độ này, AI sẽ:

1. Phân tích yêu cầu của bạn
2. Trả về một kế hoạch chi tiết
3. Chờ bạn duyệt **Approve** hoặc từ chối **Reject**

> **Khi nào dùng Plan mode:** Khi bạn muốn yêu cầu thay đổi lớn và muốn xem AI sẽ làm gì trước khi đụng vào dự án. Cách này giúp tránh hối tiếc và tiết kiệm thời gian xử lý.

### Dừng giữa chừng

Khi AI đang chạy, nút **Send** sẽ chuyển thành nút **Stop**. Bấm Stop để huỷ run hiện tại an toàn — phần đã làm sẽ được giữ lại, AI sẽ dừng ở bước kế tiếp.

### Lỗi khi gửi

| Tình huống | Thông báo |
|------------|-----------|
| Để trống prompt | *"Enter a prompt before sending."* |
| Vượt 12.000 ký tự | Báo lỗi vượt giới hạn |
| Đang có run khác | *"This project already has an active builder run."* |

---

## 4. Hiểu thông báo và tiến trình {#tien-trinh}

Khi AI làm việc, bạn sẽ thấy nhiều loại tin nhắn xuất hiện trong cột chat. Hiểu được ý nghĩa giúp bạn yên tâm và biết khi nào cần can thiệp.

### Bố cục tin nhắn

- **Tin của bạn** căn phải, bong bóng xanh.
- **Tin của AI** căn trái, được nhóm theo từng run với viền trái phân biệt.
- Tin được sắp xếp theo thời gian tạo, mới nhất ở dưới cùng.

### Cuộn và tải tin cũ

- Khi tin mới đến và bạn đang ở gần đáy, app **tự cuộn xuống** cho bạn.
- Khi cuộn lên xa, một nút nổi **Jump to latest** xuất hiện để đưa bạn về tin mới nhất ngay.
- Cuộn lên đầu sẽ tự kích hoạt tải thêm tin cũ. Bạn cũng có thể bấm **Load older messages** để tải thủ công.
- Khi AI đang xử lý, một skeleton bubble (bong bóng xám) xuất hiện ở cuối cùng để cho biết tin mới sắp đến.

### Các giai đoạn (phase) trong run

Trong khi AI làm việc, bạn sẽ thấy các giai đoạn được cập nhật liên tục:

| Giai đoạn | Ý nghĩa |
|-----------|---------|
| Đang đọc cấu trúc trang | AI đang xem trạng thái hiện tại của dự án |
| Đang lên kế hoạch chỉnh sửa | AI đang suy nghĩ về thay đổi cần làm |
| Đang chuẩn bị bản nháp | AI bắt đầu soạn nội dung |
| Đang dựng các trang/khối | AI tạo trang và phần giao diện |
| Đang kiểm tra preview | AI xem kết quả vừa dựng |
| Đang tự sửa các lỗi nhỏ | AI tự khắc phục vấn đề phát sinh |
| Đang lưu thay đổi | AI ghi lại kết quả |
| Đang chờ bạn xác nhận lựa chọn | AI cần bạn trả lời câu hỏi |
| Hoàn tất | Run kết thúc thành công |
| Đã xảy ra lỗi | Run gặp vấn đề |
| Đã huỷ | Run đã bị dừng |

### Phần giao diện AI đang chỉnh

Cùng với phase, bạn sẽ thấy AI thông báo đang làm việc với phần nào của cửa hàng:

- **Trang:** trang chủ, trang danh sách sản phẩm, trang chi tiết sản phẩm, trang giỏ hàng, trang thanh toán
- **Khu vực:** khung chung của site, phần hero, khối sản phẩm, khu sản phẩm, phần đầu trang, phần chân trang
- **Thành phần:** ngăn kéo giỏ hàng, banner khuyến mãi, hệ thống thiết kế
- Hoặc *"một phần của giao diện"* khi không phân loại cụ thể

> **Quyền riêng tư của bạn:** Bạn sẽ **không bao giờ** thấy tên file, tên framework, hay đoạn code kỹ thuật trong các thông báo. Cloud AI Builder có chính sách giữ ngôn ngữ thân thiện với người dùng phổ thông — mọi nội dung kỹ thuật đều được dịch sang ngôn ngữ thường ngày.

### Tin tổng kết

Khi run hoàn tất, AI gửi một tin tổng kết ngắn gọn (tối đa khoảng 400 ký tự). Nếu vì lý do nào đó AI không đưa được tổng kết, bạn sẽ thấy thông báo mặc định *"Đã hoàn tất yêu cầu của bạn."*

### Stream timeout

Nếu trong 30 giây không có cập nhật mới từ AI, hệ thống sẽ **tự thử lại một lần**. Nếu vẫn không có phản hồi, run sẽ chuyển sang trạng thái lỗi và bạn có thể bấm **Retry**.

---

## 5. Trả lời câu hỏi của AI {#clarification}

Trong quá trình làm việc, AI có thể hỏi bạn để làm rõ ý định. Có 3 loại câu hỏi:

### Loại 1: Chọn phong cách thiết kế (Design Variant)

AI hiển thị **4 thẻ phong cách** để bạn chọn. Mỗi thẻ có:

- Vài chấm màu nhỏ thể hiện palette
- Tên phong cách (ví dụ *Modern & Clean*, *Bold & Vibrant*, *Warm Retail*, *Playful*)
- Mô tả ngắn

Bạn có hai cách trả lời:

1. **Bấm thẳng vào thẻ** bạn muốn — AI áp dụng ngay.
2. **Tự mô tả** ở ô *"Hoặc mô tả phong cách bạn muốn"* — viết tự do nếu không thẻ nào hợp ý.

Khi đã chọn, thẻ đó sẽ có viền xanh và hiện *"Đang áp dụng…"*.

### Loại 2: Câu hỏi nhiều lựa chọn (Skill Clarification)

Đây là dạng đơn giản hơn — chỉ là danh sách radio button với label. Bấm một lựa chọn và AI tiếp tục ngay, không cần nút xác nhận riêng.

### Loại 3: Duyệt kế hoạch (Plan Review)

Khi bạn bật **Plan mode** (xem mục 3), AI sẽ trả về một kế hoạch chi tiết dạng markdown để bạn đọc. Có 2 nút:

- **Approve** *(xanh lá)*: Đồng ý, AI bắt đầu thực hiện theo kế hoạch.
- **Reject** *(xám)*: Từ chối, run bị huỷ. Bạn có thể nhập prompt mới.

Trong khi xử lý, nút sẽ hiện *"Đang áp dụng…"* hoặc *"Đang huỷ…"*.

> **Mẹo:** Bạn không bị ép trả lời ngay — chat vẫn để dấu hỏi nguyên đó. Hãy đọc kỹ trước khi bấm.

---

## 6. Quản lý preview {#preview}

Cột giữa của workspace mặc định là **Preview** — nơi bạn xem cửa hàng đang chạy thật.

### Khởi động preview

Lần đầu vào dự án (hoặc sau khi thay đổi cấu hình), bạn sẽ thấy preview đi qua các trạng thái:

| Trạng thái | Ý nghĩa |
|------------|---------|
| **Installing** | Đang cài các thư viện cần thiết |
| **Starting** | Đang khởi động server |
| **Running** | Cửa hàng đã chạy, sẵn sàng xem |
| **Error** | Có lỗi khi khởi động |
| **Fixing** | AI đang tự sửa |

Quá trình **Installing → Running** thường mất 30-60 giây cho lần đầu. Lần sau nhanh hơn nhiều.

### Điều hướng URL

- Nhập đường dẫn vào ô URL (ví dụ `/products`, `/cart`, `/checkout`) rồi bấm **Enter** để load.
- Bấm nút **Reload** để tải lại trang hiện tại.

### Token tự động làm mới

Hệ thống tự động làm mới phiên preview mỗi 10 phút trong nền — bạn không cần làm gì. Preview sẽ không bị "rớt phiên" giữa chừng.

> **Lưu ý:** Iframe preview chạy trong sandbox với quyền hạn được kiểm soát chặt — đảm bảo an toàn nhưng vẫn cho phép giao diện hoạt động đầy đủ (form, JavaScript, lưu trạng thái).

---

## 7. Xem code {#code-view}

Bên cạnh tab **Preview**, bạn có thể chuyển sang tab **Code** để xem mã nguồn AI đã sinh ra.

- **Cây file** bên trái cho phép duyệt cấu trúc dự án.
- **Ô tìm kiếm** giúp tìm file theo tên nhanh chóng.
- Nội dung file hiển thị dạng plain text (không tô màu cú pháp).
- Có badge **Read only** rõ ràng — bạn chỉ xem, không sửa được tại đây.

Các nút **Add comment**, **Copy**, **Download** hiện ra như placeholder UI nhưng đang bị disable. Tính năng này dành cho phiên bản tương lai.

> **Vì sao read-only?** Cloud AI Builder thiết kế để bạn chỉnh sửa qua chat với AI, không phải sửa code trực tiếp. Cách này giữ cho dự án nhất quán và tránh lỗi do can thiệp tay.

---

## 8. Cài đặt dự án {#settings}

Bấm nút **Settings** trên header chat để mở drawer cài đặt. Drawer có 2 tab:

### Tab General

- **Đổi tên dự án:** Sửa tên trong ô input. Tên không được để trống.
- **Xoá dự án:** Nút **Delete** ở cuối tab. Khi bấm, app hiện hộp thoại xác nhận để tránh xoá nhầm.

> **Cảnh báo:** Xoá dự án là hành động không hoàn tác được. Mọi tin nhắn, code, cài đặt sẽ mất vĩnh viễn.

### Tab Info

Cài đặt cửa hàng kết nối với storefront:

- **Chọn store** từ dropdown **selectedStoreSlug** — đây là cửa hàng nguồn dữ liệu (sản phẩm, đơn hàng, tồn kho).
- Bấm **Save** để áp dụng. Hệ thống sẽ:
  1. Đồng bộ giá trị `VITE_STORE_SLUG` vào cấu hình dự án
  2. Tự khởi động lại preview với cấu hình mới

### Indicator "Unsaved changes"

Khi bạn chỉnh gì đó nhưng chưa bấm **Save**, footer của drawer sẽ hiện *"Unsaved changes"* nhắc bạn lưu trước khi đóng.

---

## 9. Khi gặp sự cố {#troubleshoot}

### Bảng thông báo lỗi thường gặp

| Mã lỗi | Thông báo bạn thấy | Nên làm gì |
|--------|--------------------|------------|
| `validation_failed` | Bản dựng không qua kiểm tra. Vui lòng thử lại. | Bấm **Retry** |
| `boundary_violation` | Yêu cầu bị chặn vì lý do an toàn. | Sửa prompt cho phù hợp |
| `config_unavailable` | Trình tạo AI hiện chưa sẵn sàng. Hãy thử lại sau. | Đợi vài phút rồi thử lại |
| `cancelled` | Đã huỷ. | Bạn đã chủ động dừng — gửi prompt mới |
| `preview_failed` | Preview chưa lên được. Hãy thử lại. | Bấm **Reload** preview hoặc **Retry** |
| `codex_runtime_failed` | Trình tạo gặp lỗi tạm thời. Hãy thử lại. | Bấm **Retry** |
| `blocked_request` | Yêu cầu nằm ngoài phạm vi. | Đổi cách diễn đạt prompt |
| `repair_exhausted` | Vẫn còn lỗi sau khi tự sửa. Hãy thử lại. | Thử prompt đơn giản hơn |
| `required_skill_unavailable` | Thiếu hướng dẫn bắt buộc. | Liên hệ hỗ trợ |
| `skill_unavailable` | Skill được yêu cầu chưa có sẵn. | Bấm **Retry** sau ít phút |
| `interrupted_by_restart` | Phiên xử lý bị gián đoạn. Bạn có thể thử lại an toàn. | Bấm **Retry** — không mất dữ liệu |

### Nút Retry

Mọi tin nhắn lỗi đều có nút **Retry** đi kèm. Bấm để **tạo run mới với cùng prompt** ban đầu — bạn không phải gõ lại.

### Tin nhắn bị gián đoạn

Đôi khi run đang chạy giữa chừng thì bị ngắt (mất mạng, server khởi động lại). Bạn sẽ thấy:

- Một badge **Bị gián đoạn** trên tin nhắn
- Phần văn bản đã streaming được **giữ lại** để bạn đọc
- Nút **Retry** để chạy lại

### An toàn khi server khởi động lại

Cloud AI Builder thiết kế để chịu được việc server tự khởi động lại. Khi điều này xảy ra giữa run:

- Tải lại trang sẽ thấy tin **Bị gián đoạn** ngay lập tức.
- Nếu run đang chờ bạn trả lời clarification, **trạng thái chờ vẫn được khôi phục** — bạn vẫn có thể trả lời tiếp.
- Bấm **Retry** để chạy lại an toàn, không gây xung đột dữ liệu.

> **Mẹo:** Nếu bạn bấm Retry liên tục mà vẫn lỗi, hãy thử đơn giản hoá prompt hoặc chia thành nhiều bước nhỏ.

---

## 10. Mẹo và phím tắt {#tips}

### Phím tắt soạn tin

| Phím | Tác dụng |
|------|----------|
| **Enter** | Gửi tin |
| **Shift + Enter** | Xuống dòng trong tin |

### Mẹo viết prompt hiệu quả

- **Cụ thể về ngành hàng:** *"shop quần áo nữ"* hơn là *"shop online"*.
- **Mô tả phong cách:** *"tối giản, tông pastel"* hoặc *"sôi động, nhiều màu"*.
- **Liệt kê thành phần:** *"có banner lớn, khu sản phẩm nổi bật, footer có thông tin liên hệ"*.
- **Yêu cầu thay đổi nhỏ một lần:** Thay vì gộp 5 yêu cầu vào một tin, hãy chia thành nhiều tin để dễ kiểm soát.

### Mẹo dùng Plan mode

- Bật **Plan mode** khi yêu cầu lớn (ví dụ tái cấu trúc trang chủ).
- Đọc kỹ kế hoạch trước khi bấm **Approve**.
- Nếu kế hoạch chưa đúng ý, bấm **Reject** rồi viết prompt rõ hơn.

### Mẹo tiết kiệm thời gian

- Bắt đầu **Reasoning Effort** ở **medium**. Chỉ tăng khi cần.
- Resize cột chat về kích thước thoải mái — kích thước được lưu lại.
- Dùng tab **Code** để hiểu AI đã làm gì khi muốn học hỏi.

---

## 11. Câu hỏi thường gặp {#faq}

### Tôi có cần biết code không?

Không. Cloud AI Builder được thiết kế cho người không kỹ thuật. Bạn chỉ cần mô tả ý tưởng bằng tiếng Việt thông thường.

### Vì sao tôi không thấy tên file hay code trong tin nhắn AI?

Đây là chính sách quyền riêng tư có chủ đích. App **không bao giờ** lộ tên file, tên framework, hay code identifier ra giao diện chat. AI sẽ luôn dùng cách diễn đạt thân thiện như *"trang chủ"*, *"khu sản phẩm"*, *"phần đầu trang"*.

### Run đang chạy thì tôi đóng tab có sao không?

Không sao. Run vẫn chạy ở phía server. Khi bạn quay lại, lịch sử tin nhắn sẽ được khôi phục đầy đủ.

### Tôi có thể chỉnh code trực tiếp không?

Hiện tại tab **Code** chỉ ở chế độ đọc. Mọi chỉnh sửa thực hiện qua chat với AI. Cách này giữ dự án nhất quán và an toàn.

### Plan mode có khác gì với chat thường?

Ở chế độ thường, AI bắt tay vào làm ngay. Ở **Plan mode**, AI trình bày kế hoạch trước và chờ bạn duyệt — phù hợp khi bạn muốn xem trước trước khi thay đổi lớn.

### Reasoning Effort cao có tốn nhiều thời gian không?

Có. Mức **xhigh** có thể chậm hơn nhiều lần so với **low**. Hãy bắt đầu ở **medium** và chỉ tăng khi thực sự cần.

### Tôi xoá dự án nhầm có khôi phục được không?

Không. Xoá là hành động vĩnh viễn. App có hộp thoại xác nhận để tránh nhầm lẫn — hãy đọc kỹ trước khi bấm **Delete**.

### Khi nào nên dùng nút Stop?

Khi bạn nhận ra prompt sai ý hoặc AI đang đi sai hướng. Bấm **Stop** để dừng an toàn — phần đã làm được giữ lại, AI không bị "treo".

### Vì sao preview lúc nào cũng phải Installing trước?

Lần đầu mở dự án, hệ thống cần cài thư viện cho cửa hàng của bạn. Lần sau preview sẽ khởi động nhanh hơn nhiều vì các thư viện đã sẵn.

### Tôi đổi store slug ở tab Info thì chuyện gì xảy ra?

App sẽ cập nhật biến `VITE_STORE_SLUG` trong cấu hình dự án và **tự khởi động lại preview**. Bạn sẽ thấy preview chuyển trạng thái về **Starting** rồi **Running** với dữ liệu của store mới.

---

> Cần thêm hỗ trợ? Liên hệ đội ngũ Cloud AI Builder qua kênh hỗ trợ chính thức của bạn. Chúc bạn dựng được cửa hàng ưng ý!
