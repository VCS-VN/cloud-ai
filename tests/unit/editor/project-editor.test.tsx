import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContentPanel } from '../../../app/components/editor/content-panel'
import { ProductPanel } from '../../../app/components/editor/product-panel'
import { ThemePanel } from '../../../app/components/editor/theme-panel'

describe('project editor panels', () => {
  it('renders editor panels', () => { const html = [renderToStaticMarkup(<ContentPanel />), renderToStaticMarkup(<ProductPanel />), renderToStaticMarkup(<ThemePanel />)].join(''); expect(html).toContain('Content editor'); expect(html).toContain('Product editor'); expect(html).toContain('Theme editor') })
})
