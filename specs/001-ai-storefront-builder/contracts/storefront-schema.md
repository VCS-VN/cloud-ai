# Contract: Storefront Schema

## Required Top-Level AI Output

```json
{
  "siteTitle": "string",
  "tagline": "string",
  "businessProfile": {},
  "brandProfile": {},
  "pages": [],
  "products": [],
  "theme": {},
  "seo": {},
  "warnings": [],
  "assumptions": []
}
```

## Page Contract

Required fields:
- `id`
- `slug`
- `title`
- `seo.title`
- `seo.metaDescription`
- `sections`

V1 requires a homepage page with slug `/` or equivalent route mapping.

## Section Contract

Required common fields:
- `id`: unique within project
- `type`: known or custom section type
- `title`: editor-visible section label
- `content`: structured renderable content
- `layout`: non-executable layout metadata
- `editableFields`: field paths user may edit
- `regenerationScope`: identifiers needed to regenerate this section
- `source`: `ai`, `user`, or `mixed`

Known initial section types should include hero, value propositions, product listing, brand/about, FAQ, CTA/contact, and footer. Custom section types are allowed but must satisfy common fields and fallback rendering rules.

## Product Contract

Required fields:
- `id`
- `name`
- `description`
- `price`
- `imageUrl` or `placeholderImage`
- `category`
- `availability`
- `ctaLabel`
- `missingFields`

## Theme Contract

Required categories:
- colors
- typography
- spacing
- radius
- button style

Theme values must be safe to map to CSS variables and should default to `DESIGN.md` tokens when absent.

## Validation Outcomes

- Valid: can be normalized, persisted, and rendered.
- Valid with warnings: can be persisted/rendered, but warnings are visible to user/operator.
- Invalid: rejected; previous project state remains unchanged.
- Safety blocked: rejected; operator-visible record is created.
