/**
 * Guardrail violation detection for imported CRM records.
 * Flags XSS, SQL, and formula injection attempts in field values.
 */

export type GuardrailViolation = {
  field: string;
  severity: "low" | "high";
  type: "xss" | "sql_injection" | "formula_injection";
};

const XSS_PATTERNS = [
  /<script[\s/>]/i,
  /onerror\s*=/i,
  /javascript:\s*/i,
  /<img\s/i,
  /<svg\s/i,
  /<iframe\s/i,
];

const SQL_PATTERNS = [
  /\bDROP\s+TABLE\b/i,
  /\bSELECT\s+.*\bFROM\b/i,
  /\bUNION\s+SELECT\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bINSERT\s+INTO\b/i,
  /'\s*OR\s+'1'\s*=\s*'1/i,
];

const FORMULA_PATTERNS = [
  /^=/,                  // =cmd|/c ...
  /^@SUM/i,              // @SUM(1+1)
  /^\+[A-Z@=]/,          // +SUM, +COMMAND, not +91...
];

function detectViolations(
  record: Record<string, string>,
  patterns: RegExp[],
  type: GuardrailViolation["type"],
  severity: GuardrailViolation["severity"],
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (!value) continue;
    for (const pattern of patterns) {
      if (pattern.test(value)) {
        violations.push({ field, severity, type });
        break;
      }
    }
  }
  return violations;
}

export function scanRecord(record: Record<string, string>): GuardrailViolation[] {
  return [
    ...detectViolations(record, XSS_PATTERNS, "xss", "high"),
    ...detectViolations(record, SQL_PATTERNS, "sql_injection", "high"),
    ...detectViolations(record, FORMULA_PATTERNS, "formula_injection", "low"),
  ];
}

export function hasViolations(record: Record<string, string>): boolean {
  return scanRecord(record).length > 0;
}
