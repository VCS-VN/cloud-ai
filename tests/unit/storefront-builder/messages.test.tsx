import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MessageComposer } from '../../../src/components/projects/MessageComposer'
import { ProjectMessagesPanel } from '../../../src/components/projects/ProjectMessagesPanel'
import { createSeedMessages } from '../../../src/features/storefront-builder/mock-store'

describe('message components', () => {
  it('distinguishes user and agent messages', () => {
    const html = renderToStaticMarkup(<ProjectMessagesPanel messages={createSeedMessages('project-test')} />)

    expect(html).toContain('Bạn')
    expect(html).toContain('Agent')
  })

  it('renders empty/loading/error states', () => {
    expect(renderToStaticMarkup(<ProjectMessagesPanel messages={[]} />)).toContain('Chưa có message')
    expect(renderToStaticMarkup(<ProjectMessagesPanel messages={[]} loading />)).toContain('Đang tải message history')
    expect(renderToStaticMarkup(<ProjectMessagesPanel messages={[]} error="Không tải" />)).toContain('Không tải')
  })

  it('disables composer submit for empty content and while sending', () => {
    const emptyHtml = renderToStaticMarkup(<MessageComposer value="   " onChange={() => undefined} onSend={() => undefined} />)
    const sendingHtml = renderToStaticMarkup(<MessageComposer value="Xin chào" sending onChange={() => undefined} onSend={() => undefined} />)

    expect(emptyHtml).toContain('disabled=""')
    expect(sendingHtml).toContain('Đang gửi')
  })
})
