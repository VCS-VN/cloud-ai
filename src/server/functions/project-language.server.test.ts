import { describe, expect, it } from "vitest";
import {
  detectExplicitLanguageDirective,
  detectPromptLanguage,
  resolveProjectLanguage,
} from "./project-language.server";

describe("detectPromptLanguage", () => {
  it("detects Vietnamese from diacritics", () => {
    expect(detectPromptLanguage("Đổi màu nền trang chủ sang xanh")).toBe("vi");
  });

  it("detects Vietnamese from ASCII-folded function words", () => {
    expect(detectPromptLanguage("toi muon them san pham vao gio hang")).toBe(
      "vi",
    );
  });

  it("detects English from function words", () => {
    expect(detectPromptLanguage("Please add a product to the cart page")).toBe(
      "en",
    );
  });

  it("returns null for ambiguous / signal-free text", () => {
    expect(detectPromptLanguage("#FF0000")).toBeNull();
    expect(detectPromptLanguage("ok")).toBeNull();
    expect(detectPromptLanguage("")).toBeNull();
  });
});

describe("detectExplicitLanguageDirective", () => {
  it("catches an English-language request to reply in Vietnamese", () => {
    expect(detectExplicitLanguageDirective("reply in Vietnamese please")).toBe(
      "vi",
    );
  });

  it("catches a Vietnamese-language request to reply in English", () => {
    // User types Vietnamese but wants English replies — the directive wins over
    // the text's own language.
    expect(detectExplicitLanguageDirective("trả lời bằng tiếng Anh")).toBe("en");
  });

  it("returns null when there is no directive", () => {
    expect(detectExplicitLanguageDirective("add a hero section")).toBeNull();
  });
});

describe("resolveProjectLanguage", () => {
  it("explicit directive beats detected text and stored context", () => {
    const r = resolveProjectLanguage({
      // Vietnamese text, but explicitly asks for English.
      prompt: "trả lời bằng tiếng Anh, thêm nút mua hàng",
      stored: "vi",
    });
    expect(r).toEqual({ locale: "en", source: "explicit", isExplicit: true });
  });

  it("keeps the locked stored context even when the prompt is in another language", () => {
    // Project is locked to Vietnamese; an English prompt does NOT switch it —
    // only an explicit directive can. This is the lock-to-first-detection rule.
    const r = resolveProjectLanguage({
      prompt: "Please add a checkout button",
      stored: "vi",
    });
    expect(r).toEqual({ locale: "vi", source: "stored", isExplicit: false });
  });

  it("detects from the first prompt when no context is stored yet", () => {
    const r = resolveProjectLanguage({
      prompt: "Please add a checkout button",
      stored: null,
    });
    expect(r).toEqual({ locale: "en", source: "detected", isExplicit: false });
  });

  it("carries the stored context when the prompt is ambiguous", () => {
    const r = resolveProjectLanguage({ prompt: "#00FF00", stored: "vi" });
    expect(r).toEqual({ locale: "vi", source: "stored", isExplicit: false });
  });

  it("falls back to English with no signal and no stored context", () => {
    const r = resolveProjectLanguage({ prompt: "ok", stored: null });
    expect(r).toEqual({ locale: "en", source: "default", isExplicit: false });
  });
});
