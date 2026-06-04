StructuredThinkingResult output contract:
- Return one root JSON object only; no markdown and no wrapper keys.
- Required root keys: intent, confidence, language, userWish, ecommerceContext, projectAction, constraints, risk, normalizedTask, downstream.
- confidence MUST be a number from 0 to 1, never a string.
- language MUST be one of: vi, en, mixed, unknown.
- Arrays MUST be arrays even when empty.
- Nullable fields such as projectAction.clarificationQuestion MUST be null when absent, not omitted.
- intent MUST be one of: init_project, add_feature, modify_design, modify_content, modify_products, fix_bug, integrate_service, explain_project, unknown.
- ecommerceContext.storeType MUST be one of: fashion, cosmetics, electronics, furniture, food, digital, general, unknown. Use "unknown" if not derivable.
- ecommerceContext.conversionGoal MUST be one of: increase_add_to_cart, increase_checkout_completion, improve_product_discovery, increase_trust, improve_brand_perception, improve_mobile_ux, none, unknown. Use "unknown" if not derivable; never invent new values.
- downstream.recommendedNextStep MUST be one of: ask_clarification, init_source, create_plan, generate_patch, explain_only, reject_or_safe_redirect. Do NOT reuse values from intent (e.g. "init_project" is NOT a valid recommendedNextStep — use "init_source" instead).
- downstream.priority MUST be one of: low, normal, high.
- risk.level MUST be one of: low, medium, high.
Minimal shape example:
{
  "intent": "modify_design",
  "confidence": 0.8,
  "language": "vi",
  "userWish": { "rawPrompt": "...", "explicitRequests": [], "implicitRequests": [], "inferredEcommerceGoals": [], "outOfScopeRequests": [] },
  "ecommerceContext": { "storeType": "unknown", "affectedPages": [], "affectedSections": [], "affectedFeatures": [], "affectedEntities": [], "conversionGoal": "unknown" },
  "projectAction": { "shouldInitProject": false, "shouldModifyExistingProject": true, "shouldAskClarification": false, "clarificationQuestion": null, "requiresSourceInit": false, "requiresPatchGeneration": true, "requiresValidation": true, "requiresPreviewRefresh": true },
  "constraints": { "preserveExistingDesign": true, "preserveExistingFeatures": true, "requestedStackChange": false, "requestedDestructiveChange": false, "forbiddenActions": [] },
  "risk": { "level": "low", "reasons": [] },
  "normalizedTask": { "title": "...", "description": "...", "acceptanceCriteria": [], "implementationHints": [] },
  "downstream": { "recommendedNextStep": "generate_patch", "priority": "normal" }
}
