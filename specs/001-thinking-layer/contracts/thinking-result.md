# Contract: Thinking Result

## Purpose

Defines the structured output contract produced by the Thinking Layer before downstream builder stages run.

## Producer

- Thinking provider call through the existing AI provider abstraction.
- Optional repair provider call when business validation fails.
- Clarification fallback generator when provider output cannot be safely used.

## Consumers

- Thinking business validator.
- Sanitized thinking event mapper.
- Agent Task mapper.
- Project run summary persistence.

## Required Shape

```json
{
  "intent": "init_project | add_feature | modify_design | modify_content | modify_products | fix_bug | integrate_service | explain_project | unknown",
  "confidence": 0.0,
  "language": "vi | en | mixed | unknown",
  "userWish": {
    "rawPrompt": "string",
    "explicitRequests": ["string"],
    "implicitRequests": ["string"],
    "inferredEcommerceGoals": ["string"],
    "outOfScopeRequests": ["string"]
  },
  "ecommerceContext": {
    "storeType": "fashion | cosmetics | electronics | furniture | food | digital | general | unknown",
    "affectedPages": ["string"],
    "affectedSections": ["string"],
    "affectedFeatures": ["string"],
    "affectedEntities": ["string"],
    "conversionGoal": "increase_add_to_cart | increase_checkout_completion | improve_product_discovery | increase_trust | improve_brand_perception | improve_mobile_ux | none | unknown"
  },
  "projectAction": {
    "shouldInitProject": true,
    "shouldModifyExistingProject": false,
    "shouldAskClarification": false,
    "clarificationQuestion": null,
    "requiresSourceInit": true,
    "requiresPatchGeneration": false,
    "requiresValidation": true,
    "requiresPreviewRefresh": true
  },
  "constraints": {
    "preserveExistingDesign": true,
    "preserveExistingFeatures": true,
    "requestedStackChange": false,
    "requestedDestructiveChange": false,
    "forbiddenActions": ["string"]
  },
  "risk": {
    "level": "low | medium | high",
    "reasons": ["string"]
  },
  "normalizedTask": {
    "title": "string",
    "description": "string",
    "acceptanceCriteria": ["string"],
    "implementationHints": ["string"]
  },
  "downstream": {
    "recommendedNextStep": "ask_clarification | init_source | create_plan | generate_patch | explain_only | reject_or_safe_redirect",
    "priority": "low | normal | high"
  }
}
```

## Business Rules

- Initialization and modification cannot both be true.
- Clarification-required results must include a clarification question.
- Uninitialized projects must initialize or ask clarification.
- Initialized projects must not be treated as init requests unless the user explicitly requested a destructive rebuild.
- Stack changes require clarification.
- Destructive changes require high risk.
- Feature additions require affected features.
- Low-confidence results require clarification according to the configured threshold.

## Privacy Rules

- Raw hidden reasoning is never included.
- `rawPrompt` is internal and must not be exposed in sanitized client events.
- Provider deltas and unvalidated provider text are never persisted or streamed.
