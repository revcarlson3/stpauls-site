const TEXT_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  copy: "©",
  gt: ">",
  hellip: "…",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: "\u00a0",
  ndash: "–",
  quot: "\"",
  reg: "®",
  trade: "™"
};

function decodeCodePoint(entity: string, codePoint: number) {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : entity;
}

export function decodeTextEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, reference: string) => {
    if (reference.startsWith("#x") || reference.startsWith("#X")) {
      return decodeCodePoint(entity, Number.parseInt(reference.slice(2), 16));
    }
    if (reference.startsWith("#")) {
      return decodeCodePoint(entity, Number.parseInt(reference.slice(1), 10));
    }
    return TEXT_ENTITIES[reference.toLowerCase()] ?? entity;
  });
}
