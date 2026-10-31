import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameFieldDetails } from '../js/ui.js';

// Минимальная DOM-заглушка: настоящего браузера в node:test нет.
class Element extends EventTarget {
  constructor() {
    super();
    this.attributes = new Map();
    this.textContent = '';
    this.value = '';
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  appendChild(child) { this.textContent += child.textContent; }
}

test('подсказка имени: начальное значение, ввод и доступность на обоих экранах', (t) => {
  const previousDocument = globalThis.document;
  const previousNode = globalThis.Node;
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousNode === undefined) delete globalThis.Node;
    else globalThis.Node = previousNode;
  });
  globalThis.Node = Element;
  globalThis.document = {
    createElement: () => new Element(),
    createTextNode: (text) => ({ textContent: text }),
  };

  for (const [id, initial] of [['welcome-name', ''], ['nickname', 'Макс']]) {
    const input = new Element();
    input.id = id;
    input.value = initial;
    input.setAttribute('aria-describedby', 'existing-hint');
    const [hint, counter] = nameFieldDetails(input);
    assert.equal(hint.textContent, 'Имя необязательно. Можно использовать псевдоним');
    assert.equal(counter.textContent, `${initial.length} / 40`);
    assert.equal(input.getAttribute('aria-describedby'), `existing-hint ${id}-hint ${id}-counter`);
    assert.equal(hint.getAttribute('id'), `${id}-hint`);
    assert.equal(counter.getAttribute('id'), `${id}-counter`);
    assert.equal(counter.getAttribute('aria-live'), 'polite');
    assert.equal(counter.getAttribute('aria-atomic'), 'true');
    for (const [value, length] of [[' Маша ', 6], ['😀', 2], ['я'.repeat(40), 40], ['', 0]]) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      assert.equal(counter.textContent, `${length} / 40`);
      assert.equal(input.value, value, 'счётчик не меняет пробелы и значение поля');
    }
  }
});
