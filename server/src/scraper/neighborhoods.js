const zonePatterns = [
  ['Младост', /^младост/i],
  ['Люлин', /^люлин/i],
  ['Дружба', /^дружба/i],
  ['Овча купел', /^овча\s+купел/i],
  ['Надежда', /^надежда/i],
  ['Център', /^(център|идеален център|докторски паметник|яворов)/i],
  ['Лозенец', /^лозенец/i],
  ['Витоша', /^витоша/i],
  ['Студентски град', /^студентски/i],
  ['Манастирски ливади', /^манастирски/i],
  ['Кръстова вада', /^кръстова/i],
  ['Гео Милев', /^гео\s+милев/i],
  ['Изток', /^изток/i],
  ['Изгрев', /^изгрев/i],
  ['Банишора', /^банишора/i]
];

export function normalizeNeighborhood(value = '') {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/гр\.\s*софия,?/i, '')
    .replace(/софия,?/i, '')
    .trim();
}

export function zoneForNeighborhood(value = '') {
  const normalized = normalizeNeighborhood(value);
  const match = zonePatterns.find(([, pattern]) => pattern.test(normalized));
  return match ? match[0] : normalized || null;
}
