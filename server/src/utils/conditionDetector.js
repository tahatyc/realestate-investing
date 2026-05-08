const conditionRules = [
  ['needs_rehab', [/за\s+ремонт/i, /основен\s+ремонт/i, /необзаведен/i, /шпакловка/i]],
  ['fully_renovated', [/луксозно/i, /ремонтиран/i, /след\s+ремонт/i, /обзаведен/i]],
  ['new', [/ново\s+строителство/i, /акт\s*16/i, /акт\s*15/i, /на\s+зелено/i]],
  ['partially_renovated', [/частич/i, /освежен/i, /добро\s+състояние/i]]
];

export function detectCondition(text = '') {
  const haystack = String(text).toLowerCase();
  const match = conditionRules.find(([, patterns]) => patterns.some((pattern) => pattern.test(haystack)));
  return match ? match[0] : 'unknown';
}
