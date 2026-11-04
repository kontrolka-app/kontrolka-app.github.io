// Распознавание английского текста на фото (Tesseract.js из vendor/tesseract). Только в браузере.
// Библиотека и словарь загружаются при первом вызове; фото никуда не отправляется.

const BASE = 'vendor/tesseract/';
const MAX_SIDE = 2400; // крупное фото с телефона уменьшаем: быстрее, а буквы всё ещё читаются

let libPromise = null;
function loadLibrary() {
  libPromise ??= new Promise((resolve, reject) => {
    if (globalThis.Tesseract) return resolve(globalThis.Tesseract);
    const s = document.createElement('script');
    s.src = `${BASE}tesseract.min.js`;
    s.onload = () => resolve(globalThis.Tesseract);
    s.onerror = () => {
      libPromise = null;
      reject(new Error('Не удалось загрузить распознавание. Проверь интернет и попробуй ещё раз.'));
    };
    document.head.appendChild(s);
  });
  return libPromise;
}

/** Картинка → canvas не больше MAX_SIDE по длинной стороне (поворот по EXIF учитывает браузер). */
async function prepare(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Не получилось открыть картинку. Подойдут фото и картинки JPG или PNG.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

/**
 * Распознать текст на картинке. onProgress(доля 0…1, что сейчас делается).
 * Возвращает текст как есть — разбивку на предложения делает topic.js.
 */
export async function recognizeImage(file, onProgress = () => {}) {
  onProgress(0, 'Загружаем распознавание…');
  const [Tesseract, canvas] = await Promise.all([loadLibrary(), prepare(file)]);
  const abs = (p) => new URL(BASE + p, location.href).href;
  let worker;
  try {
    worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
      workerPath: abs('worker.min.js'),
      corePath: abs('core'),
      langPath: abs('lang'),
      logger: (m) => {
        if (m.status === 'recognizing text') onProgress(0.3 + 0.7 * m.progress, 'Читаем текст…');
        else if (/loading|initializ/.test(m.status)) onProgress(0.3 * (m.progress || 0), 'Загружаем распознавание…');
      },
    });
    const { data } = await worker.recognize(canvas);
    onProgress(1, 'Готово');
    return data.text || '';
  } catch (e) {
    throw new Error(e?.message?.startsWith('Не ') ? e.message : 'Распознать не получилось. Попробуй ещё раз или вставь текст вручную.');
  } finally {
    await worker?.terminate();
  }
}
