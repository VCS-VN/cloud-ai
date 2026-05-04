import { ContentPanel } from "../components/editor/content-panel";
import { ProductPanel } from "../components/editor/product-panel";
import { ThemePanel } from "../components/editor/theme-panel";
import { SectionPanel } from "../components/editor/section-panel";
import { PreviewActions } from "../components/editor/preview-actions";
export default function ProjectRoute() {
  return (
    <main>
      <ContentPanel />
      <ProductPanel />
      <ThemePanel />
      <SectionPanel />
      <PreviewActions />
    </main>
  );
}
