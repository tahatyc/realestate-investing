const excludedStages = new Set(['act14', 'act15', 'act16', 'finished']);

const preAct14Patterns = [
  /на\s+зелено/i,
  /в\s+проект/i,
  /преди\s+акт\s*14/i,
  /стартиращ\s+строеж/i,
  /предстоящ\s+строеж/i,
  /предстартови\s+цени/i,
  /ранен\s+етап\s+на\s+строителство/i
];

const plainAct14Pattern = /акт\s*14/i;
const beforeAct14Pattern = /преди\s+акт\s*14/i;

const exclusionPatterns = [
  /акт\s*15/i,
  /акт\s*16/i,
  /готов\s+за\s+нанасяне/i,
  /завършен[ао]?\s+сград[а]?/i,
  /завършено\s+строителство/i,
  /въведен[ао]?\s+в\s+експлоатация/i
];

function propertyText(property) {
  return [property.title, property.description, property.condition].filter(Boolean).join(' ');
}

export function isBuyInGreenEligible(property = {}) {
  const stage = property.construction_stage ?? property.constructionStage;
  if (stage && excludedStages.has(String(stage).toLowerCase())) {
    return false;
  }

  const text = propertyText(property);
  if (plainAct14Pattern.test(text) && !beforeAct14Pattern.test(text)) {
    return false;
  }
  if (exclusionPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return preAct14Patterns.some((pattern) => pattern.test(text));
}
