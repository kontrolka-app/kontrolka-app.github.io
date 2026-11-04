// Текст из файла Word (.docx) без библиотек: .docx — это zip, текст лежит в word/document.xml. Без DOM.
// Распаковка — встроенным в браузер DecompressionStream('deflate-raw').

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

/** Один файл из zip-архива по имени: Uint8Array или null. */
export async function readZipEntry(bytes, name) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Конец центрального каталога ищем с конца (после него может быть комментарий до 64 КБ).
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xffff); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const decoder = new TextDecoder();
  for (let n = 0; n < count && u32(b, p) === 0x02014b50; n++) {
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const skip = u16(b, p + 30) + u16(b, p + 32);
    const local = u32(b, p + 42);
    const entryName = decoder.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + skip;
    if (entryName !== name) continue;
    if (u32(b, local) !== 0x04034b50) return null;
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const data = b.subarray(start, start + size);
    if (method === 0) return data;
    if (method !== 8) return null;
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m,
  );

/** word/document.xml → текст: абзацы Word через пустую строку. */
export function documentXmlToText(xml) {
  const paragraphs = [];
  for (const [body] of String(xml).matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    let line = '';
    for (const [, text, tag] of body.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) {
      if (text !== undefined) line += decodeXml(text);
      else line += tag === 'tab' ? ' ' : '\n';
    }
    if (line.trim()) paragraphs.push(line.trim());
  }
  return paragraphs.join('\n\n');
}

/** Файл .docx (ArrayBuffer / Uint8Array) → текст. Не тот файл — ошибка с понятным текстом. */
export async function docxToText(bytes) {
  const xml = await readZipEntry(bytes, 'word/document.xml');
  if (!xml) throw new Error('Это не похоже на файл Word (.docx).');
  return documentXmlToText(new TextDecoder().decode(xml));
}
