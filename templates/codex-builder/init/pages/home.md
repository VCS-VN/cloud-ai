---
layer: HOME_PAGE
warning: >
  Route trang chủ storefront. Spec là HÀNH VI + yêu cầu retail, không phải khung
  section cứng — agent tự thiết kế layout theo skill + DESIGN.md. Gửi nguyên văn.
---
src/routes/index.tsx - createFileRoute('/'), the storefront homepage. Sample catalog data is already pre-seeded — you MUST show products on the homepage via useProductsList({ storeId }) (featured/grid with loading and empty states). Do not stop at a hero-only placeholder. Compose a polished, conversion-focused retail homepage: a strong hero with a large memorable headline and a clear primary CTA to /products, commerce-ready product display, trust/guarantee/delivery cues, and a final call-to-action. The homepage must feel retail editorial premium and adapt to the store's category and brand. Design the section composition and layout yourself following the taste skill and DESIGN.md — there is no fixed section count. Do NOT generate a thin scaffold or a generic SaaS landing page. Never put builder jargon (taste skill, route shell, debug query strings) in shopper-visible text.