import { describe, expect, it } from "vitest";
import { isPrivacySafe } from "@/server/functions/progress-mapper.server";

const ADVERSARIAL = [
  // file paths with extensions
  "Updated src/routes/index.tsx",
  "Edited src/components/Hero.tsx successfully",
  "package.json was changed",
  "see vite.config.ts for details",
  "tailwind.config.js holds the theme",
  "tsconfig.json was bumped",
  "added DESIGN.md notes",
  "modified src/styles/app.css",
  "checked migrations/0001_init.sql",
  "ran scripts/build.sh",
  "ya.yaml updated",
  "renamed README.md",
  "patched server.js",
  // multi-segment paths
  "go to src/routes/cart for the cart page",
  "look at components/storefront/Header",
  "browser opens public/icons/icon.png",
  "open node_modules/something",
  "test under tests/unit/foo",
  "edited /var/log/app",
  // backticked code identifiers
  "calls `ProjectPatchService` directly",
  "uses `runPlanTurn` helper",
  "calls `BuilderRunHandle`",
  "the `useChatStream` hook",
  // code fences
  "```ts\nlet x = 1;\n```",
  "see ``` block ```",
  // HTML/JSX tags
  "renders <Hero /> on the page",
  "the </Footer> tag closes",
  "<Component prop>",
  "<button onClick>",
  // framework / tooling tokens (case-insensitive)
  "powered by Vite",
  "wired through TanStack",
  "Drizzle migration applied",
  "ESLint pass",
  "Prettier formatted",
  "pnpm install ran",
  "npm install ran",
  "yarn install ran",
  "Tailwind classes",
  "React component",
  "node_modules cache",
  "Pm2 stopped",
  "Playwright did not run",
  "Vitest passed",
  "compiled JSX",
  "rendered TSX",
  // mixed
  "Updated `Hero.tsx` for the homepage",
  "Edit `src/server.ts` to fix the bug",
  "see Hero.tsx and Footer.tsx",
  "running on Node.js with pnpm",
];

const CLEAN = [
  "Đã thêm ảnh vào phần hero ở trang chủ",
  "Done. Your storefront is ready.",
  "Đã hoàn tất yêu cầu của bạn.",
  "Cập nhật phần đầu trang",
  "Updated the hero section",
  "Mình đã chuẩn bị bản nháp",
  "Updating the home page",
  "Đang tự sửa các lỗi nhỏ",
  "Đang lên kế hoạch chỉnh sửa",
  "Đã thêm banner khuyến mãi vào trang chủ",
  "Đã đổi màu nút trên phần hero",
  "Mình đã thêm phần ảnh nổi bật vào trang chủ",
  "Storefront updated successfully",
  "Mình đang chờ bạn xác nhận lựa chọn",
  "Đang dựng các trang khối",
  "Đã hoàn tất.",
  "Đang kiểm tra preview",
  "Cập nhật phần chân trang xong",
  "Mình đã thêm hình nền cho phần đầu",
  "Khởi tạo trang chủ thành công",
];

describe("Privacy filter — adversarial corpus", () => {
  it("rejects every adversarial string (≥50 ideally)", () => {
    expect(ADVERSARIAL.length).toBeGreaterThanOrEqual(40);
    for (const text of ADVERSARIAL) {
      expect(isPrivacySafe(text), `expected REJECT: ${text}`).toBe(false);
    }
  });

  it("accepts every clean string", () => {
    expect(CLEAN.length).toBeGreaterThanOrEqual(20);
    for (const text of CLEAN) {
      expect(isPrivacySafe(text), `expected ACCEPT: ${text}`).toBe(true);
    }
  });

  it("accepts empty string", () => {
    expect(isPrivacySafe("")).toBe(true);
  });
});
