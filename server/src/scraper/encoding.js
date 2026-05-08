import iconv from 'iconv-lite';

export function decodeWindows1251(input) {
  if (typeof input === 'string') {
    return input;
  }

  const buffer = Buffer.isBuffer(input)
    ? input
    : Buffer.from(input instanceof ArrayBuffer ? input : new Uint8Array(input));

  return iconv.decode(buffer, 'win1251');
}
