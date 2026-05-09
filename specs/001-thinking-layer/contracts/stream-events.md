# Contract: Sanitized Stream Events

## Purpose

Defines safe client-facing events for the AI agent stream while the Thinking Layer blocks downstream execution internally.

## Event Sequence

### Initialization or Update Success

```text
agent_started
thinking_started
thinking_context_loaded
thinking_completed
plan_created
file_changed* 
validation_finished
preview_ready
done
```

### Clarification Required

```text
agent_started
thinking_started
thinking_context_loaded
thinking_completed
clarification_required
```

### Provider or Validation Failure

```text
agent_started
thinking_started
thinking_context_loaded
error
```

## Event Shapes

### thinking_started

```json
{
  "type": "thinking_started",
  "data": {
    "message": "Đang phân tích yêu cầu của bạn..."
  }
}
```

### thinking_context_loaded

```json
{
  "type": "thinking_context_loaded",
  "data": {
    "hasInitializedSource": true
  }
}
```

### thinking_completed

```json
{
  "type": "thinking_completed",
  "data": {
    "intent": "add_feature",
    "confidence": 0.92,
    "summary": "Add color and size filters to the product listing experience.",
    "affectedPages": ["/products"],
    "affectedFeatures": ["product-filter"],
    "conversionGoal": "improve_product_discovery",
    "riskLevel": "low"
  }
}
```

### clarification_required

```json
{
  "type": "clarification_required",
  "data": {
    "question": "Bạn muốn xác nhận thay đổi này trước khi tiếp tục không?",
    "reason": "Yêu cầu có rủi ro cao hoặc cần thêm thông tin."
  }
}
```

### error

```json
{
  "type": "error",
  "data": {
    "message": "Không thể phân tích yêu cầu lúc này. Vui lòng thử lại."
  }
}
```

## Sanitization Rules

- Never emit raw provider text.
- Never emit provider streaming deltas.
- Never emit hidden reasoning or chain-of-thought.
- Never emit unvalidated Thinking Result JSON.
- Never emit secrets, credentials, raw environment config, stack traces, or raw database records.
- Do not include `userWish.rawPrompt` in client-visible thinking events.
