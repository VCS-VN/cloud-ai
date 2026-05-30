# Feature Specification: Multi-Message Agent Runs With Skeleton & Milestone Messages

**Feature Branch**: `021-multi-message-agent-runs`
**Created**: 2026-05-29
**Status**: Draft
**Input**: User description: "Multi-message agent runs with skeleton & milestone messages — 1 user prompt có thể dẫn đến nhiều message agent. Có skeleton message ephemeral báo agent đang xử lý gì. Có milestone message bền vững báo các kết quả quan trọng (plan / answer / clarification / error / review_required). Sửa flow + protocol cho cả server và client."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See live progress and structured outcomes during agent run (Priority: P1)

User gửi prompt và muốn thấy ngay agent đã nhận yêu cầu và đang làm gì. Trong khi agent xử lý, một skeleton "đang xử lý" hiện ở cuối khu chat, label đổi theo từng giai đoạn (đang phân tích, đang lên kế hoạch, đang sửa code, đang chạy preview, đang trả lời...). Khi agent kết thúc, skeleton biến mất và chỉ còn lại các message kết quả bền vững trong lịch sử chat: kế hoạch (nếu có thay đổi file), câu trả lời text, hoặc câu hỏi cần làm rõ / báo lỗi / yêu cầu review.

**Why this priority**: Đây là cốt lõi của tính năng. Hiện tại 1 prompt → 1 message agent với content text được append loạn xạ + 1 timeline events tách biệt. UX không cho user biết agent đang làm gì và lịch sử chat sau đó cũng khó đọc lại. Việc hiển thị live progress + structured milestones giải quyết cả 2 vấn đề.

**Independent Test**: Có thể test đầy đủ bằng cách gửi 1 prompt sửa code đơn giản → quan sát skeleton xuất hiện ngay → label thay đổi theo phase → khi agent xong, skeleton biến mất → chat history còn lại 1 plan milestone + 1 answer milestone với border trái subtle nhóm chúng lại. Reload trang sẽ thấy đúng các milestone đó (không thấy skeleton vì run đã xong).

**Acceptance Scenarios**:

1. **Given** project ở trạng thái idle, **When** user gửi prompt "thêm dark mode toggle", **Then** một bubble user xuất hiện ngay dưới composer + một skeleton bubble xuất hiện cuối list với label "Đang xử lý..." trước khi server phản hồi.
2. **Given** server đang xử lý prompt, **When** agent chuyển từ phase phân tích sang lên kế hoạch sang sửa code, **Then** skeleton bubble cập nhật label tương ứng theo từng phase mà KHÔNG thêm bubble mới cho mỗi phase phụ.
3. **Given** agent đã tạo plan với ≥1 file operation, **When** plan được tạo, **Then** một plan milestone được persist vào lịch sử chat (KHÔNG biến mất khi run xong) trước khi answer milestone xuất hiện.
4. **Given** agent đã hoàn thành toàn bộ run, **When** user reload trang, **Then** chat history hiển thị lại đúng các milestone đã persist (plan + answer hoặc tương tự), KHÔNG có skeleton, các milestone của cùng 1 run được nhóm bằng border trái subtle.
5. **Given** run đang chạy với phase "responding", **When** answer message được tạo và nhận deltas, **Then** answer bubble streaming text liền mạch và skeleton biến mất khi answer xuất hiện. Sau đó nếu còn phase khác (vd: validating), skeleton lại xuất hiện với phase mới.

---

### User Story 2 - Stop a run mid-flight and retry a failed run (Priority: P1)

Trong khi agent đang xử lý, user muốn dừng nó (vì nhận ra prompt sai, hoặc agent đi sai hướng). Sau khi dừng hoặc khi run fail, user muốn thử lại y nguyên prompt đó mà không phải gõ lại.

**Why this priority**: Stop và Retry là control hành động tối thiểu để user kiểm soát agent. Không có chúng, run dở dang khoá project ở trạng thái processing và user mất quyền tự phục hồi.

**Independent Test**: Test bằng cách (a) gửi prompt → click stop trong khi đang chạy → composer revert về nút send, run được mark stopped, các milestone đã persist được giữ; (b) khi run fail, click retry trên run đó → run mới được tạo với cùng prompt, run cũ vẫn còn trong history với badge "Retry attempt 2" hoặc tương tự.

**Acceptance Scenarios**:

1. **Given** run đang chạy với skeleton "Đang sửa code", **When** user click nút stop ở composer, **Then** skeleton chuyển label "Stopping..." ngay lập tức và composer chuyển về nút send. Khi server confirm, skeleton biến mất, run được lưu với status "stopped" + bất kỳ milestone đã persist được giữ nguyên.
2. **Given** run vừa fail với error milestone hiển thị, **When** user click retry trên error milestone, **Then** run mới được tạo với cùng nội dung user prompt cũ (KHÔNG tạo user message mới), run cũ vẫn hiển thị trong history.
3. **Given** đã có 1 retry chain (run gốc + retry attempt 2), **When** user retry lần nữa, **Then** run mới có thông tin "đây là retry của run trước" rõ ràng, vẫn dùng cùng user prompt gốc.
4. **Given** run đã ở trạng thái terminal (completed/failed/stopped), **When** user gọi stop một lần nữa, **Then** server trả về thành công không lỗi (idempotent) và UI không thay đổi.
5. **Given** user click stop nhưng request fail (network issue), **When** UI đã optimistic chuyển sang nút send, **Then** sau timeout server vẫn xử lý hoặc state recover về đúng (acceptable: run vẫn chạy, UI thấy lại skeleton khi nhận event tiếp theo).

---

### User Story 3 - Continue working without losing context across reload, multiple tabs, or temporary disconnect (Priority: P2)

User mở project ở 2 tab, hoặc reload trang giữa lúc run đang chạy, hoặc network drop ngắn — họ vẫn muốn thấy được state run hiện tại và các milestone đã có, không phải đợi agent chạy lại.

**Why this priority**: Không phá flow công việc khi có sự cố nhẹ. Quan trọng vì agent run có thể chạy nhiều phút (init storefront, install packages...) và user thường mở nhiều tab.

**Independent Test**: (a) gửi prompt, đang chạy → reload trang → thấy lại đúng skeleton + milestones đã có, run tiếp tục như chưa reload; (b) mở tab thứ 2 cùng project trong khi tab 1 đang chạy run → tab 2 thấy được run đang chạy + nhận live updates.

**Acceptance Scenarios**:

1. **Given** run đang chạy ở phase "editing", **When** user reload trang, **Then** sau khi load xong, skeleton xuất hiện lại đúng phase đang chạy + tất cả milestones đã persist hiển thị trong list. Stream tiếp tục live không bị mất event.
2. **Given** tab A đang chạy 1 run, **When** user mở tab B cùng project URL, **Then** tab B hiển thị skeleton + milestones giống tab A, nhận updates realtime mà không làm tab A bị ngắt kết nối.
3. **Given** server bị restart trong khi run đang chạy, **When** client reload sau đó, **Then** run cũ được mark fail tự động với message "bị gián đoạn", project ở trạng thái idle để user gửi prompt mới.
4. **Given** client mất kết nối SSE 30 giây mà không nhận được heartbeat, **When** timeout hit, **Then** client tự đóng connection cũ và mở lại 1 lần. Nếu kết nối lại OK, stream tiếp tục; nếu vẫn fail, run được mark fail local + thông báo error.
5. **Given** preview server (dev runtime) đang chạy độc lập với agent run, **When** agent run kết thúc nhưng dev install vẫn đang chạy, **Then** UI vẫn nhận được dev runtime updates qua channel riêng (không phụ thuộc run lifecycle).

---

### User Story 4 - Distinguish between different kinds of agent outcome at a glance (Priority: P2)

Sau khi run xong, user nhìn lướt qua chat history phải biết ngay agent đã làm gì: trả lời text bình thường, hỏi clarification, báo lỗi, hay yêu cầu review thay đổi — mỗi loại có visual khác biệt.

**Why this priority**: Sau vài chục lần tương tác, chat history dài. User cần scan nhanh để biết run nào cần action, run nào chỉ là Q&A.

**Independent Test**: Sinh các kịch bản với mỗi outcome (clarification, error, review_required, plain answer) → quan sát visual distinct: badge icon khác, không cần đọc nội dung cũng đoán được loại.

**Acceptance Scenarios**:

1. **Given** agent kết thúc với answer text bình thường, **When** user xem bubble, **Then** bubble render markdown thường, không có badge đặc biệt.
2. **Given** agent cần làm rõ (clarification), **When** bubble hiển thị, **Then** có badge "?" hoặc icon question rõ ràng và content là câu hỏi của agent.
3. **Given** run fail, **When** error milestone hiển thị, **Then** có badge cảnh báo, content gồm friendly message + lý do (sanitized) + hint hành động ("you can retry or describe differently").
4. **Given** agent yêu cầu human review, **When** review_required milestone hiển thị, **Then** có badge phân biệt với error (vì review không phải fail technical mà là thành công cần xác nhận).
5. **Given** agent có plan milestone, **When** user xem, **Then** chỉ thấy summary 1 dòng (file list ẩn ở v1), giúp chat history gọn.

---

### Edge Cases

- **Run fail trước khi LLM trả delta nào**: Không có answer message, chỉ persist error milestone. UI render error là kết quả duy nhất của run.
- **User gửi prompt mới khi project đang processing**: Server reject (`PROJECT_ALREADY_PROCESSING`). UI chỉ cho user gõ tự do nhưng nút send đổi thành stop nên về thực tế click không gửi. Nếu race xảy ra qua API trực tiếp, error toast hiển thị + composer text được giữ.
- **Plan có rất nhiều file (>10) trong mode init_source**: File list được persist đầy đủ trong content nhưng client v1 hide list (chỉ show summary). Truncate sẵn ở 10 + "+X more" trong content để khi flip render về sau không cần migration.
- **Skeleton phase đổi liên tục với detail thay đổi nhanh** (vd: tool calls liên tiếp): server throttle 200ms cho cùng phase, phase đổi → emit ngay. Tránh spam SSE và UI flicker.
- **Trong cùng 1 run, sau answer streaming xong nhưng còn validation chưa kết thúc**: Skeleton xuất hiện lại với phase "validating" sau khi answer message đã complete. Chấp nhận skeleton appear/disappear nhiều lần trong 1 run.
- **User reply cho clarification**: Coi như user gửi prompt mới hoàn toàn, tạo run mới (không tiếp tục run clarification cũ). Run cũ ở status "completed" trong DB với clarification milestone là kết quả terminal.
- **Run chạy lâu, user navigate đi rồi quay lại tab cũ**: Multi-subscriber fan-out đảm bảo subscriber disconnect không abort run. User về sẽ thấy lại đúng state.
- **2 user mở cùng project (sau khi có collaboration)**: Out of scope v1 — giả định owner-only access.
- **Pagination scroll lên giữa 1 run đã hoàn thành**: Có thể bị cắt giữa run (vd: thấy answer nhưng không thấy plan của cùng run đó). User scroll thêm 1 page nữa sẽ thấy đủ. Acceptable cho v1.
- **POST tạo run thất bại (network/server error)**: Optimistic temp message + skeleton bị rollback, composer text được restore, error toast hiển thị. User không mất thông tin đã gõ.

## Requirements *(mandatory)*

### Functional Requirements

#### Run lifecycle

- **FR-001**: System MUST tổ chức tương tác agent thành các "run" — mỗi user prompt khởi tạo một run duy nhất bao gồm 0 hoặc nhiều agent message bền vững và 0 hoặc 1 skeleton ephemeral đang chạy.
- **FR-002**: System MUST gắn mọi agent message thuộc cùng một lần xử lý prompt với cùng một run identifier để có thể nhóm chúng lại trong UI và truy vấn cùng nhau.
- **FR-003**: System MUST cho phép retry một run đã fail bằng cách tạo run mới với cùng nội dung user prompt gốc, KHÔNG tạo user message mới, và đánh dấu run mới là retry của run cũ. Run cũ phải được giữ nguyên trong lịch sử chat.
- **FR-004**: System MUST cho phép stop một run đang chạy. Hành động stop là idempotent (gọi nhiều lần trên run đã terminal phải thành công không lỗi). Bất kỳ milestone đã persist trước thời điểm stop phải được giữ lại.
- **FR-005**: System MUST từ chối yêu cầu prompt mới khi project đang ở trạng thái processing với mã lỗi rõ ràng cho client xử lý.

#### Milestone messages

- **FR-006**: System MUST persist các milestone agent message với 5 loại phân biệt: kế hoạch (plan), câu trả lời (answer), yêu cầu làm rõ (clarification), lỗi (error), và yêu cầu human review (review_required).
- **FR-007**: System MUST chỉ persist plan milestone khi agent thực sự tạo plan có ≥1 file operation; bỏ qua plan milestone khi mode là chỉ trả lời / chỉ cập nhật state mà không động chạm file.
- **FR-008**: System MUST tạo answer message lazily, chỉ khi agent thực sự bắt đầu trả text — KHÔNG tạo answer message rỗng từ đầu run. Run fail/stop trước khi có text → không có answer message.
- **FR-009**: System MUST sắp xếp các milestone trong lịch sử chat theo thứ tự thời gian xảy ra, không cần guarantee thứ tự cứng giữa các loại trong cùng run.
- **FR-010**: System MUST persist write-through (DB write trước, broadcast event sau) để đảm bảo client thấy milestone thì DB đã có; reload là idempotent.

#### Skeleton ephemeral

- **FR-011**: System MUST hiển thị tối đa 1 skeleton bubble ephemeral duy nhất ở cuối list trong khi run đang chạy, label đổi theo phase đang xử lý.
- **FR-012**: System MUST hỗ trợ các phase rõ ràng cho skeleton: hiểu yêu cầu, lên kế hoạch, sửa code, cài đặt, khởi động preview, kiểm tra, sửa lỗi, đang trả lời. Mỗi phase có label thân thiện với người dùng (đã làm sạch khỏi technical jargon).
- **FR-013**: System MUST cho phép skeleton biến mất rồi xuất hiện lại trong cùng run nếu sau khi answer streaming xong vẫn còn phase khác đang chạy.
- **FR-014**: System MUST throttle update của skeleton trong cùng phase (tránh spam khi tool calls phát ra liên tục) nhưng emit ngay lập tức khi phase đổi.
- **FR-015**: System MUST clear skeleton trên client khi run kết thúc (completed/failed/stopped) hoặc khi có skeleton mới thay thế.

#### Streaming protocol

- **FR-016**: System MUST cung cấp một channel streaming cho run với các loại event: bắt đầu run, message được tạo, delta text (chỉ cho answer), message hoàn tất, skeleton update, run hoàn tất, run fail, run stopped, heartbeat.
- **FR-017**: System MUST cung cấp một channel streaming riêng cho dev runtime ở mức project (không gắn với run nào), với lifetime độc lập với agent run lifecycle.
- **FR-018**: System MUST hỗ trợ multiple subscriber trên cùng channel run (fan-out) — nhiều tab hoặc nhiều client cùng xem 1 run đều nhận đủ event mà không làm subscriber khác bị ngắt.
- **FR-019**: System MUST gửi heartbeat định kỳ (mỗi 15 giây) trên cả 2 channel để client phát hiện kết nối chết.
- **FR-020**: Client MUST tự đóng và mở lại kết nối streaming một lần khi không nhận event nào (kể cả heartbeat) trong 30 giây. Nếu retry cũng fail, đánh dấu run là fail cục bộ và báo lỗi cho user.

#### Resume after disruption

- **FR-021**: Client MUST tự động kết nối lại stream khi reload trang nếu project có run đang active, lấy lại state đầy đủ (skeleton phase + milestones đã persist) và tiếp tục nhận event live.
- **FR-022**: System MUST phát hiện run "stale" (DB còn ghi processing nhưng server không còn state trong memory, vd: do server restart) và tự đánh dấu fail với mã lỗi RUN_INTERRUPTED, đưa project về idle để user có thể tiếp tục.
- **FR-023**: System MUST đệm event của run trong suốt vòng đời run để subscriber join giữa chừng nhận được toàn bộ context (replay từ đầu run đến điểm hiện tại).

#### Optimistic UI

- **FR-024**: Client MUST hiển thị user message và skeleton ngay lập tức khi user click send, không chờ phản hồi server.
- **FR-025**: Client MUST rollback optimistic state (xoá user message tạm + skeleton + restore composer text + báo lỗi) khi POST tạo run thất bại.
- **FR-026**: Client MUST optimistic chuyển nút send về stop khi đang processing, và ngược lại khi nhận run terminal event. Stop call có thể fire-and-forget để không block UI.

#### Visual presentation

- **FR-027**: Client MUST hiển thị nhóm các agent message thuộc cùng run với một dấu hiệu visual subtle (vd: vạch trái mảnh, indent nhẹ) để user nhận biết đây là cùng 1 đợt agent xử lý.
- **FR-028**: Client MUST render message khác nhau theo loại milestone: answer/plan dùng markdown chuẩn; clarification/error/review_required có badge hoặc icon phân biệt rõ.
- **FR-029**: Client MUST cho phép user gõ tiếp vào composer trong khi run đang chạy (nhưng không gửi được) để không block thinking/typing.
- **FR-030**: Client MUST giữ composer text khi run lifecycle thay đổi — text không bị tự động xoá khi run kết thúc.

#### Sanitization

- **FR-031**: System MUST làm sạch nội dung text hiển thị cho user (skeleton detail, milestone summary) khỏi technical jargon (paths nội bộ, tên biến môi trường, model name, token...) trước khi emit.
- **FR-032**: System MUST hướng dẫn LLM tránh liệt kê path file trong answer text để không trùng với plan milestone (khi plan đã hiển thị summary thay đổi).

### Key Entities *(include if feature involves data)*

- **Agent Run**: Một lần xử lý prompt user. Có identifier riêng, gắn với project và user. Trạng thái: streaming / completed / failed / stopped. Có thể là retry của run khác. Lưu cấu hình ban đầu (reasoning effort, plan mode). Là thực thể nhóm cho các message kết quả.
- **Project Message (Agent Kind)**: Một bubble trong chat history thuộc về một agent run. Có 5 kind: plan / answer / clarification / error / review_required. Content là markdown thuần. Mỗi message có mã định danh và thứ tự thời gian rõ ràng.
- **Project Message (User Kind)**: Bubble do user gửi (input prompt). Là điểm bắt đầu cho run. Một user message có thể có nhiều run liên kết qua retry.
- **Skeleton State**: Trạng thái ephemeral, KHÔNG persist DB. Chỉ tồn tại trong memory client trong khi run đang chạy. Có phase và label/detail tương ứng. Xuất hiện/biến mất theo lifecycle phase của run.
- **Run Channel Event**: Đơn vị thông tin truyền từ server xuống client trên kênh run. Phân biệt rõ event lifecycle (run.started, run.completed/failed/stopped), event message (message.created, message.delta, message.completed), event progress (skeleton.update), và keep-alive (heartbeat).
- **Runtime Channel Event**: Đơn vị thông tin truyền từ server xuống client trên kênh runtime project-level (dev install, dev start, dev ready, dev error, dev fix). Lifetime độc lập với agent run.
- **Project Processing State**: Trạng thái cấp project: idle hoặc processing. Khi processing, project có gắn với một active run. Block không cho gửi prompt mới.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Sau khi user click send, một dấu hiệu trực quan (user bubble + skeleton) xuất hiện trên màn hình trong vòng 100ms — không chờ phản hồi server.
- **SC-002**: Trong các run có thay đổi file, user thấy được dấu hiệu agent đang làm gì (skeleton label) trong toàn bộ thời gian run, không có khoảng "blank" quá 2 giây giữa các phase.
- **SC-003**: Khi user reload trang giữa lúc run đang chạy, sau khi trang load xong (≤3 giây trên kết nối thường), state run được khôi phục đầy đủ và stream tiếp tục live.
- **SC-004**: Trong run đã hoàn thành, lịch sử chat hiển thị tối đa 2 milestone bubble cho run thông thường (plan + answer) hoặc 1 cho run chỉ trả lời text — đảm bảo chat history sau N tương tác vẫn dễ scan.
- **SC-005**: Tỷ lệ run bị "kẹt" ở trạng thái processing sau server restart hoặc network failure giảm xuống 0% nhờ stale detection (so với hiện tại đôi khi user phải refresh nhiều lần để thoát).
- **SC-006**: Stop request hoàn tất (skeleton biến mất + composer revert) trong vòng 500ms từ khi user click — kể cả khi server xử lý stop chậm hơn (nhờ optimistic UI).
- **SC-007**: 100% các milestone đã persist được hiển thị nhất quán giữa lần xem realtime và lần reload sau đó (không có "biến mất" do sai consistency giữa stream và DB).
- **SC-008**: Multi-tab: khi mở 2 tab cùng project trong lúc run đang chạy, cả 2 tab nhận được mọi event của run mà không tab nào bị ngắt kết nối.
- **SC-009**: Trong vòng 7 ngày sau release, số lần user phàn nàn "không biết agent đang làm gì" giảm đáng kể so với baseline (đo qua feedback channel hoặc support ticket).
- **SC-010**: Bandwidth SSE cho run không tăng quá 30% so với hiện tại nhờ throttle skeleton update + bỏ field sequence trong delta event.

## Assumptions

- Project chưa chạy production thật — migration database có thể là drop & recreate, không cần backfill data cũ.
- Phạm vi 1 user / 1 project (owner-only). Multi-user collaboration ngoài phạm vi v1.
- Mobile responsive ngoài phạm vi v1 (chỉ tập trung desktop UX).
- Telemetry chi tiết (metrics latency từng phase, fail rate, ...) ngoài phạm vi — log structured stdout đã có là đủ cho v1.
- Rate limit cho user spam send được xử lý ngầm bởi check processing state hiện tại; không cần rate limit module riêng.
- Agent orchestrator hiện tại đã emit đủ các loại event cần thiết để map sang skeleton phases và milestone triggers; chỉ cần thay đổi logic mapping/persist, không cần thay đổi agent core.
- Markdown renderer hiện tại (dumprify) đủ cho answer / plan / clarification / error / review_required content; không cần render engine mới.
- i18n copy trong skeleton/milestone tạm dùng tiếng Anh (giống chuỗi hiện tại trong presenter); thống nhất Anh/Việt sẽ giải quyết sau.
- Số tab cùng project ở một thời điểm thực tế ≤ 3 — fan-out cost cho subscriber list nhỏ chấp nhận được.
- Heartbeat 15s server / 30s client timeout là cấu hình mặc định reasonable cho LAN/WAN bình thường; cấu hình hoá nếu cần sau.
