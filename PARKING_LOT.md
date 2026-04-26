# Parking Lot

## Live LLM Narrative

The v1 app ships with a deterministic `generateNarrative(structuredData)` function so the full slice works without external model credentials.

If a later milestone requires a live LLM, the clean upgrade path is to keep the same function boundary and swap the implementation behind it.

## Future Options

1. OpenAI API
- Add `OPENAI_API_KEY`.
- Keep the same structured JSON prompt and require every sentence to cite the numbers.
- Good default when a hosted model is required.

2. Anthropic API
- Add `ANTHROPIC_API_KEY`.
- Use the same grounding strategy as OpenAI.
- Only worth enabling if quota and model access are stable.

3. Local model
- Use Ollama or LM Studio if a hosted API key is not available.
- This preserves the "LLM-generated" story without adding a paid dependency.

4. Hybrid mode
- Keep deterministic narrative as the default.
- Add a feature flag such as `NARRATIVE_MODE=deterministic|openai|anthropic|local`.
- Fall back to deterministic output if the model call fails.

## Why It Is Parked

- The Week 6 rubric does not require an API-backed LLM.
- Deterministic output is easier to verify against the structured data.
- External quota and credential issues should not block the v1 vertical slice.
