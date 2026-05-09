# Contract: Agent Task

## Purpose

Defines the normalized downstream task created from a validated Thinking Result.

## Producer

- Thinking-to-Agent-Task mapper.

## Consumers

- Planner.
- Source initialization service.
- Patch generation and application services.
- Validation and repair services.
- Preview refresh orchestration.

## Required Shape

```json
{
  "projectId": "string",
  "userId": "string",
  "sourcePrompt": "string",
  "intent": "init_project | add_feature | modify_design | modify_content | modify_products | fix_bug | integrate_service | explain_project | unknown",
  "title": "string",
  "description": "string",
  "ecommerceGoal": "increase_add_to_cart | increase_checkout_completion | improve_product_discovery | increase_trust | improve_brand_perception | improve_mobile_ux | none | unknown",
  "affectedPages": ["string"],
  "affectedSections": ["string"],
  "affectedFeatures": ["string"],
  "affectedEntities": ["string"],
  "acceptanceCriteria": ["string"],
  "implementationHints": ["string"],
  "riskLevel": "low | medium | high",
  "nextStep": "ask_clarification | init_source | create_plan | generate_patch | explain_only | reject_or_safe_redirect",
  "requires": {
    "sourceInit": true,
    "patchGeneration": false,
    "validation": true,
    "previewRefresh": true,
    "clarification": false
  }
}
```

## Mapping Rules

- `projectId`, `userId`, and `sourcePrompt` come from the original user request context.
- Intent, goal, affected areas, acceptance criteria, hints, risk, next step, and requirements come from the validated Thinking Result.
- No raw provider response, hidden reasoning, unvalidated data, or provider metadata is mapped.
- If `requires.clarification` is true, downstream planning/source stages must not run.
