const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<system>/i,
  /<instruction>/i,
  /you\s+are\s+now\s+(a|an|in)/i,
  /new\s+(role|persona|instructions)/i,
  /act\s+as\s+(a|an)/i,
  /forget\s+(everything|all|what)/i,
  /override\s+(the\s+)?(instructions|prompt|system)/i,
];

/**
 * Truncates to maxLength, strips ASCII control characters (except tab and newline),
 * and trims whitespace.
 */
export function sanitizeUserText(text: string, maxLength: number): string {
  const truncated = text.slice(0, maxLength);
  // Strip ASCII control chars except tab (\x09) and newline (\x0A)
  const stripped = truncated.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  return stripped.trim();
}

/** Returns true if the text matches known prompt-injection patterns. */
export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
