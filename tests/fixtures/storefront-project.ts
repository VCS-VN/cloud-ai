import { designThemeDefaults } from '../../src/storefront/defaults'
import type { StorefrontAIOutput, StorefrontProject, StorefrontSection } from '../../src/storefront/types'

export const heroSection: StorefrontSection = { id: 'hero', type: 'hero', title: 'Hero', content: { heading: 'Modern Ceramics', body: 'Handmade tableware for calm homes.' }, layout: {}, editableFields: [{ path: 'content.heading', label: 'Heading' }], regenerationScope: { kind: 'section', pageId: 'home', sectionId: 'hero' }, source: 'ai' }
export const productSection: StorefrontSection = { id: 'products', type: 'product-listing', title: 'Featured Products', content: {}, layout: {}, editableFields: [], regenerationScope: { kind: 'section', pageId: 'home', sectionId: 'products' }, source: 'ai' }
export const faqSection: StorefrontSection = { id: 'faq', type: 'faq', title: 'FAQ', content: { items: [{ question: 'Shipping?', answer: 'Ships weekly.' }] }, layout: {}, editableFields: [{ path: 'content.items', label: 'Items' }], regenerationScope: { kind: 'section', pageId: 'home', sectionId: 'faq' }, source: 'ai' }
export const validAIOutput: StorefrontAIOutput = {
  siteTitle: 'Modern Ceramics', tagline: 'Calm objects for everyday rituals',
  businessProfile: { businessName: 'Modern Ceramics', industry: 'Home goods', shortDescription: 'Handmade ceramics shop', targetAudience: 'Design-conscious homeowners', brandVoice: 'Warm editorial', sourcePrompt: 'Create a ceramics storefront', missingFields: [] },
  brandProfile: { styleKeywords: ['editorial', 'minimal'], preferredColors: ['black', 'white', 'lime'], assumptions: [] },
  products: [{ id: 'mug', name: 'Lime Mug', description: 'A hand-thrown mug.', price: '$32', placeholderImage: 'placeholder', category: 'Mugs', availability: 'in-stock', ctaLabel: 'Shop now', missingFields: [], source: 'ai', editedFields: [] }],
  pages: [{ id: 'home', slug: '/', title: 'Home', seo: { title: 'Modern Ceramics', metaDescription: 'Shop handmade ceramics.' }, sections: [heroSection, productSection, faqSection] }],
  theme: designThemeDefaults,
  seo: { title: 'Modern Ceramics', metaDescription: 'Shop handmade ceramics.' },
  warnings: [], assumptions: []
}
export const validProject: StorefrontProject = { id: 'project-1', name: 'Modern Ceramics', siteTitle: validAIOutput.siteTitle, tagline: validAIOutput.tagline, businessProfile: validAIOutput.businessProfile, brandProfile: validAIOutput.brandProfile, products: validAIOutput.products, pages: validAIOutput.pages, theme: validAIOutput.theme, generationHistory: [], exportPublishState: { method: 'none', status: 'not-started' }, currentRevisionId: 'rev-1', createdAt: '2026-05-04T00:00:00.000Z', updatedAt: '2026-05-04T00:00:00.000Z' }
