// Тестовые вопросы всех четырёх типов.
export const Q = {
  choice: {
    id: 'q-choice', grade: 4, subjectId: 'math', topicId: 't1', difficulty: 'easy', type: 'single-choice',
    question: 'Какая дробь равна половине?',
    options: [{ id: 'a', text: '1/3' }, { id: 'b', text: '2/4' }, { id: 'c', text: '3/4', feedback: 'Это больше половины.' }],
    correctAnswer: 'b', explanation: '2/4 = 1/2',
  },
  tf: { id: 'q-tf', grade: 4, subjectId: 'math', topicId: 't1', difficulty: 'medium', type: 'true-false', question: '2 + 2 = 4', correctAnswer: true },
  text: {
    id: 'q-text', grade: 4, subjectId: 'russian', topicId: 't2', difficulty: 'medium', type: 'text',
    question: 'Столица России?', correctAnswer: 'Москва', acceptedAnswers: ['город Москва'],
  },
  num: { id: 'q-num', grade: 4, subjectId: 'math', topicId: 't2', difficulty: 'hard', type: 'number', question: '48 : 3', correctAnswer: 16, unit: 'км/ч' },
};

export const ALL = [Q.choice, Q.tf, Q.text, Q.num];

/** Детерминированный генератор случайных чисел для тестов. */
export function seededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
