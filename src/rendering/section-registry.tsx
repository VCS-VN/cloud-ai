import type { ComponentType } from 'react'
import type { Product, StorefrontSection } from '@/storefront/types'
import { HeroSection } from '@app/components/storefront/hero-section'
import { ProductListing } from '@app/components/storefront/product-listing'
import { FaqSection } from '@app/components/storefront/faq-section'
import { CtaSection } from '@app/components/storefront/cta-section'
import { FooterSection } from '@app/components/storefront/footer-section'
import { FallbackSection } from './fallback-section'

type SectionComponent = ComponentType<{ section: StorefrontSection; products?: Product[] }>
export const sectionRegistry: Record<string, SectionComponent> = { hero: HeroSection, 'product-listing': ProductListing, faq: FaqSection, cta: CtaSection, contact: CtaSection, footer: FooterSection }
export function resolveSectionComponent(type: string): SectionComponent { return sectionRegistry[type] ?? FallbackSection }
