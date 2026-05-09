import type {
  AgentExecutionMode,
  StorefrontArea,
  StorefrontIntent,
  StructuredThinkingInput,
  StructuredThinkingResult,
} from "./thinking.schema";

export const APPLY_KEYWORDS = [
  "thêm",
  "sửa",
  "đổi",
  "làm",
  "cải thiện",
  "bổ sung",
  "fix",
  "xóa",
  "xoá",
  "ẩn",
  "hiện",
  "tối ưu",
  "responsive",
  "mobile",
  "desktop",
  "đẹp hơn",
  "xịn hơn",
  "chuyên nghiệp",
  "sale",
  "filter",
  "checkout",
  "cart",
  "product",
  "sản phẩm",
  "giỏ hàng",
  "thanh toán",
  "feedback",
  "review",
  "banner",
  "hero",
] as const;

export const PLAN_ONLY_KEYWORDS = [
  "chỉ plan",
  "chỉ phân tích",
  "đừng sửa code",
  "không sửa code",
  "lên kế hoạch",
  "cho tôi action plan",
  "review trước",
  "chưa implement",
  "estimate trước",
] as const;
export const EXPLAIN_KEYWORDS = [
  "giải thích",
  "tại sao",
  "hoạt động thế nào",
  "code này làm gì",
  "luồng này",
] as const;
export const REVIEW_ONLY_KEYWORDS = [
  "review code",
  "kiểm tra giúp",
  "đánh giá",
  "có vấn đề gì không",
] as const;

const DESTRUCTIVE_KEYWORDS = [
  "xóa hết",
  "xoá hết",
  "delete all",
  "remove all",
  "build lại từ đầu",
  "rebuild from scratch",
  "đập đi",
  "làm lại toàn bộ",
  "replace entire",
  "migrate framework",
] as const;
const CREDENTIAL_KEYWORDS = [
  "stripe payment thật",
  "thanh toán thật",
  "api key",
  "secret",
  "firebase credentials",
  "production deploy",
  "deploy production",
  "webhook thật",
] as const;
const UNSAFE_KEYWORDS = [
  "bypass payment",
  "bỏ qua thanh toán",
  "expose secret",
  "lộ secret",
  "disable validation",
  "tắt validation",
  "bỏ bảo mật",
  "ignore previous instructions",
  "system prompt",
] as const;
const UNRELATED_KEYWORDS = [
  "thời tiết",
  "weather",
  "bóng đá",
  "football",
  "kể chuyện",
  "nấu ăn",
  "lịch sử việt nam",
] as const;
const STOREFRONT_CONTEXT_KEYWORDS = [
  "web",
  "website",
  "storefront",
  "shop",
  "bán hàng",
  "sản phẩm",
  "cart",
  "checkout",
  "hero",
  "banner",
  "sale",
  "filter",
  "mobile",
  "feedback",
  "review",
  "luxury",
  "cta",
  "nút mua",
] as const;

export type HardClarificationBlockType =
  | "destructive"
  | "credential"
  | "conflict"
  | "unsafe"
  | "inaccessible_project"
  | "unrelated";

export type HardClarificationBlock = {
  type: HardClarificationBlockType;
  reason: string;
  question: string;
};

export function inferExecutionModeFromPrompt(
  prompt: string,
): AgentExecutionMode {
  const normalized = normalizePrompt(prompt);
  if (includesAny(normalized, PLAN_ONLY_KEYWORDS)) return "plan";
  if (includesAny(normalized, EXPLAIN_KEYWORDS)) return "explain";
  if (includesAny(normalized, REVIEW_ONLY_KEYWORDS)) return "review";
  return "apply";
}

export function detectHardClarificationBlock(input: {
  userPrompt: string;
  projectState: StructuredThinkingInput["projectState"];
  hasInitializedSource: boolean;
}): HardClarificationBlock | null {
  const normalized = normalizePrompt(input.userPrompt);

  if (
    !input.projectState ||
    (input.hasInitializedSource && getFileManifestLength(input.projectState) === 0)
  ) {
    return {
      type: "inaccessible_project",
      reason: "Current storefront source files are not accessible.",
      question:
        "Mình chưa truy cập được source storefront hiện tại. Bạn kiểm tra lại project rồi gửi lại yêu cầu nhé?",
    };
  }

  if (includesAny(normalized, DESTRUCTIVE_KEYWORDS)) {
    return {
      type: "destructive",
      reason: "Request may remove or replace most of the current storefront.",
      question:
        "Yêu cầu này có thể thay đổi/xóa phần lớn storefront hiện tại. Bạn xác nhận muốn tiếp tục theo hướng destructive này chứ?",
    };
  }

  if (includesAny(normalized, CREDENTIAL_KEYWORDS)) {
    return {
      type: "credential",
      reason:
        "Real external integration requires credentials or production configuration.",
      question:
        "Tính năng này cần credential/config thật. Bạn muốn cung cấp cấu hình tích hợp hay chỉ tạo UI/mock flow trước?",
    };
  }

  if (includesAny(normalized, UNSAFE_KEYWORDS)) {
    return {
      type: "unsafe",
      reason: "Request is security-sensitive or asks to bypass safeguards.",
      question:
        "Mình không thể thực hiện yêu cầu bỏ qua bảo mật/validation hoặc lộ thông tin nhạy cảm. Bạn muốn mình cải thiện storefront theo hướng an toàn nào?",
    };
  }

  if (hasConflict(normalized)) {
    return {
      type: "conflict",
      reason: "Request contains conflicting constraints.",
      question:
        "Yêu cầu đang có ràng buộc mâu thuẫn. Bạn muốn ưu tiên giữ nguyên hiện tại hay thay đổi layout/tính năng?",
    };
  }

  if (
    includesAny(normalized, UNRELATED_KEYWORDS) &&
    !includesAny(normalized, STOREFRONT_CONTEXT_KEYWORDS)
  ) {
    return {
      type: "unrelated",
      reason: "Prompt is not about the current storefront project.",
      question:
        "Yêu cầu này không liên quan storefront hiện tại. Bạn muốn mình chỉnh phần nào của website bán hàng?",
    };
  }

  return null;
}

function getFileManifestLength(projectState: StructuredThinkingInput["projectState"]) {
  if (!projectState || !Array.isArray(projectState.fileManifest)) return 0;
  return projectState.fileManifest.length;
}

export function inferStorefrontIntent(
  prompt: string,
  fallback: StructuredThinkingResult["intent"],
): StorefrontIntent {
  const normalized = normalizePrompt(prompt);
  if (includesAny(normalized, ["mobile", "responsive", "desktop"]))
    return "improve_responsive";
  if (
    includesAny(normalized, [
      "tối ưu bán hàng",
      "conversion",
      "cta",
      "nút mua",
      "mua hàng",
      "add to cart",
    ])
  )
    return "improve_conversion";
  if (
    includesAny(normalized, [
      "filter",
      "wishlist",
      "search",
      "tìm kiếm",
      "thêm feedback",
      "review",
      "testimonial",
    ])
  )
    return "add_feature";
  if (includesAny(normalized, ["sản phẩm", "product", "giá", "price"]))
    return "modify_products";
  if (includesAny(normalized, ["content", "nội dung", "copy", "text"]))
    return "modify_content";
  if (includesAny(normalized, ["fix", "bug", "lỗi", "chưa ổn"]))
    return "fix_bug";
  if (includesAny(normalized, ["stripe", "firebase", "api", "webhook"]))
    return "integrate_service";
  if (includesAny(normalized, ["xóa", "xoá", "remove", "ẩn"]))
    return "remove_feature";
  if (
    fallback === "add_feature" ||
    fallback === "modify_design" ||
    fallback === "modify_content" ||
    fallback === "modify_products" ||
    fallback === "fix_bug" ||
    fallback === "integrate_service"
  )
    return fallback;
  return "modify_design";
}

export function inferStorefrontAreas(prompt: string): StorefrontArea[] {
  const normalized = normalizePrompt(prompt);
  const areas = new Set<StorefrontArea>();
  if (includesAny(normalized, ["product", "sản phẩm"]))
    areas.add("product_listing").add("product_card");
  if (includesAny(normalized, ["checkout", "thanh toán"]))
    areas.add("checkout");
  if (includesAny(normalized, ["cart", "giỏ hàng"])) areas.add("cart");
  if (includesAny(normalized, ["filter", "màu", "size"])) areas.add("filter");
  if (includesAny(normalized, ["sale", "promotion", "khuyến mãi"]))
    areas.add("promotion");
  if (
    includesAny(normalized, ["feedback", "review", "testimonial", "khách hàng"])
  )
    areas.add("testimonial");
  if (includesAny(normalized, ["mobile", "responsive", "desktop"]))
    areas.add("responsive_layout");
  if (
    includesAny(normalized, ["luxury", "đẹp", "xịn", "chuyên nghiệp", "theme"])
  )
    areas.add("theme");
  if (includesAny(normalized, ["hero", "banner"])) areas.add("homepage");
  return areas.size > 0 ? [...areas] : ["homepage", "theme"];
}

export function isLikelyStorefrontPrompt(prompt: string): boolean {
  const normalized = normalizePrompt(prompt);
  return (
    includesAny(normalized, APPLY_KEYWORDS) ||
    includesAny(normalized, STOREFRONT_CONTEXT_KEYWORDS)
  );
}

function hasConflict(normalizedPrompt: string): boolean {
  return (
    (normalizedPrompt.includes("giữ nguyên") &&
      normalizedPrompt.includes("đổi toàn bộ")) ||
    (normalizedPrompt.includes("không thêm trang") &&
      normalizedPrompt.includes("tạo trang"))
  );
}

function includesAny(prompt: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => prompt.includes(keyword));
}

function normalizePrompt(prompt: string): string {
  return prompt.toLocaleLowerCase("vi-VN").trim();
}
