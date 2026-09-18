# Security & Privacy Policy

## Healthcare Data Isolation Guardrails

1. **Synthetic Data Only**: Real patient personal health information (PHI) or personally identifiable information (PII) is strictly prohibited from repositories, logs, seed fixtures, and unauthenticated demo environments.
2. **Deterministic Governance Gates**: No LLM or generative model has write access or permission to approve claims, alter financial outputs, or bypass privacy transformations.
3. **Trace Commons De-identification**: All longitudinal data generated for the research layer must pass multi-layer privacy gates:
   - Automated schema-level deny-list filtering (names, emails, phone numbers, exact addresses, national IDs)
   - Categorical generalization (exact DOB → age band; exact dates → monthly buckets; hospital name → facility key)
   - Small-cell suppression (k-anonymity thresholding < 5)
   - Presidio-compatible heuristic and regex scanners for unstructured leakage.

## Reporting a Vulnerability

If you discover a potential vulnerability or privacy leakage risk:
- Please notify the security team via security@medpass-ai.internal or open a private security advisory.
- Do not create public issues containing potential vulnerability details.
