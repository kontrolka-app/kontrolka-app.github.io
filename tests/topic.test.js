import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { splitSentences, toSentenceLines, guessTitle } from '../js/topic.js';
import { readZipEntry, documentXmlToText, docxToText } from '../js/docx.js';
import { parsePoem } from '../js/poem.js';

test('предложения: по точке, ! и ?, кавычки остаются у предложения', () => {
  assert.deepEqual(splitSentences('My name is Max. I am ten! Do you like cats? "Yes," she said. "I do."'), [
    'My name is Max.',
    'I am ten!',
    'Do you like cats?',
    '"Yes," she said.',
    '"I do."',
  ]);
  assert.deepEqual(splitSentences('I like summer'), ['I like summer']);
  assert.deepEqual(splitSentences('  '), []);
});

test('предложения: сокращения, инициалы и числа не рвут предложение', () => {
  assert.deepEqual(splitSentences('Mr. Brown and Mrs. Smith live in St. Petersburg. They are 3.5 km away.'), [
    'Mr. Brown and Mrs. Smith live in St. Petersburg.',
    'They are 3.5 km away.',
  ]);
  assert.deepEqual(splitSentences('My favourite writer is J. K. Rowling. Her books are great.'), ['My favourite writer is J. K. Rowling.', 'Her books are great.']);
  assert.deepEqual(splitSentences('I get up at 7 a.m. and go to school.'), ['I get up at 7 a.m. and go to school.']);
  assert.deepEqual(splitSentences('Wait... It is late.'), ['Wait...', 'It is late.']);
  assert.deepEqual(splitSentences('I go to school No. 5. I said no. Then I left.'), ['I go to school No. 5.', 'I said no.', 'Then I left.']);
});

test('текст: переносы строк внутри абзаца склеиваются, абзацы остаются', () => {
  const raw = 'My Family\n\nI have a big fam-\nily. There are five\nof us.\r\n\r\nMy mum is a doctor. My dad is a driver.';
  const out = toSentenceLines(raw);
  assert.equal(out, 'My Family\n\nI have a big family.\nThere are five of us.\n\nMy mum is a doctor.\nMy dad is a driver.');
  // Тот же вид, что у стихов: абзац = «строфа», предложение = строка.
  const parts = parsePoem(out);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts[1][1], ['There', 'are', 'five', 'of', 'us.']);
  assert.equal(toSentenceLines(''), '');
});

test('название по первой строке', () => {
  assert.equal(guessTitle('My Family\n\nI have…'), 'My Family');
  assert.equal(guessTitle('My favourite season is summer because it is warm and sunny.'), 'My favourite season is summer because…');
  assert.equal(guessTitle(''), '');
});

/** Минимальный zip-архив, как у .docx: файлы со сжатием deflate. */
function makeZip(files) {
  const enc = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name);
    const data = deflateRawSync(enc.encode(text));
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt16LE(n.length, 28);
    ch.writeUInt32LE(offset, 42);
    locals.push(lh, n, data);
    central.push(ch, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

const XML =
  '<w:document><w:body><w:p><w:pPr><w:tabs><w:tab w:val="left"/></w:tabs></w:pPr><w:r><w:t>My </w:t></w:r><w:r><w:t xml:space="preserve">School &amp; Me</w:t></w:r></w:p>' +
  '<w:p/><w:p><w:r><w:t>I go to school.</w:t><w:br/><w:t>It&#39;s big.</w:t></w:r></w:p></w:body></w:document>';

test('Word: текст абзацев, сущности и переносы', () => {
  assert.equal(documentXmlToText(XML), 'My School & Me\n\nI go to school.\nIt\'s big.');
});

test('Word: распаковка .docx и понятная ошибка для другого файла', async () => {
  const zip = makeZip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': XML });
  assert.equal(new TextDecoder().decode(await readZipEntry(zip, '[Content_Types].xml')), '<Types/>');
  assert.equal(toSentenceLines(await docxToText(zip)), 'My School & Me\n\nI go to school.\nIt\'s big.');
  await assert.rejects(docxToText(new TextEncoder().encode('просто текст')), /не похоже на файл Word/);
});

test('хранение: топики лежат отдельно от стихов, старые данные читаются', async () => {
  const { sanitizeData } = await import('../js/storage.js');
  assert.deepEqual(sanitizeData({ schemaVersion: 1 }).data.topics, { custom: [], learned: {} });
  const topic = { id: 't1', title: 'My Family', text: 'I have a mum.\nI have a dad.', createdAt: 1 };
  const { data } = sanitizeData({ schemaVersion: 1, topics: { custom: [topic], learned: { t1: 2 } } });
  assert.equal(data.topics.custom[0].title, 'My Family');
  assert.deepEqual(data.topics.learned, { t1: 2 });
  assert.deepEqual(data.poems.custom, []);
});

test('русский текст: прямая речь не рвётся на словах автора, стих остаётся построчно', async () => {
  const { toPoemLines } = await import('../js/topic.js');
  assert.deepEqual(splitSentences('— Привет! — сказал он. — Как дела? Хорошо.'), ['— Привет! — сказал он.', '— Как дела?', 'Хорошо.']);
  assert.equal(toSentenceLines('Наступила осень. Листья\nпожелтели.\n\nПтицы улетели на юг.'), 'Наступила осень.\nЛистья пожелтели.\n\nПтицы улетели на юг.');
  assert.equal(toPoemLines('  Белая берёза \r\nПод  моим окном\n\n\n\nПринакрылась снегом,\n'), 'Белая берёза\nПод моим окном\n\nПринакрылась снегом,');
});

test('хранение: у своего текста в прозе сохраняется вид, у стихов и топиков поля нет', async () => {
  const { sanitizePoems } = await import('../js/poem.js');
  const r = sanitizePoems({ custom: [{ id: 'a', title: 'Осень', text: 'Раз.\nДва.', kind: 'prose' }, { id: 'b', title: 'Стих', text: 'Раз', kind: 'мусор' }] });
  assert.equal(r.custom[0].kind, 'prose');
  assert.equal('kind' in r.custom[1], false);
});
