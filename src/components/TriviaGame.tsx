// Games → Trivia: five questions a day from the data, one of each kind.
import { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { loadFranchiseData } from '../lib/franchiseData';
import { seededRandom, seedFromString, todayKey } from '../lib/games';
import type { Graph } from '../lib/teammates';
import { makeQuiz } from '../lib/trivia';
import { useCareers } from './CareerStats';
import { ShareButton } from './ShareButton';
import { ErrorBox, Loading } from './Status';

function load(k: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '[]') as number[];
  } catch {
    return [];
  }
}

export function TriviaGame({ graph }: { graph: Graph }) {
  const careers = useCareers();
  const fd = useAsync(() => loadFranchiseData(), []);
  const [seed, setSeed] = useState(() => `trivia-${todayKey()}`);
  const daily = seed === `trivia-${todayKey()}`;
  const quiz = useMemo(() => (careers.data && fd.data ? makeQuiz(fd.data, careers.data, graph, seededRandom(seedFromString(seed))) : []), [careers.data, fd.data, graph, seed]);
  const [answers, setAnswers] = useState<number[]>(() => load(seed));
  useEffect(() => setAnswers(load(seed)), [seed]);
  useEffect(() => {
    try {
      localStorage.setItem(seed, JSON.stringify(answers));
    } catch {
      /* storage unavailable */
    }
  }, [seed, answers]);

  if (careers.error || fd.error) return <ErrorBox error={(careers.error ?? fd.error)!} />;
  if (!quiz.length) return <Loading label="Writing today's questions…" />;
  const done = answers.length >= quiz.length;
  const score = answers.filter((a, i) => a === quiz[i]?.answer).length;
  const answer = (i: number, choice: number) => {
    if (answers.length !== i) return;
    setAnswers((a) => [...a, choice]);
  };

  return (
    <>
      <p className="muted">Five questions a day from NBA history: a champion, a scoring leader, an MVP, a No. 1 pick and a win total.</p>
      <div className="actions">
        <span className="chip static">{daily ? `Daily · ${todayKey()}` : 'Random quiz'}</span>
        <button className="chip" onClick={() => setSeed(`trivia-random-${Date.now()}`)}>🎲 New random quiz</button>
        {!daily && <button className="chip" onClick={() => setSeed(`trivia-${todayKey()}`)}>Back to today's</button>}
      </div>
      {quiz.map((q, i) => {
        if (i > answers.length) return null;
        const chosen = answers[i];
        const answered = chosen != null;
        return (
          <div key={q.text} className="card trivia-q">
            <div className="muted small">Question {i + 1} · {q.kind}</div>
            <h3>{q.text}</h3>
            <div className="trivia-options">
              {q.options.map((o, k) => {
                const state = !answered ? '' : k === q.answer ? ' right' : k === chosen ? ' wrong' : '';
                return (
                  <button key={o} className={`chip trivia-option${state}`} disabled={answered} onClick={() => answer(i, k)}>{o}</button>
                );
              })}
            </div>
            {answered && <p className="small">{chosen === q.answer ? '✓ Correct. ' : `✗ It was ${q.options[q.answer]}. `}{q.fact}</p>}
          </div>
        );
      })}
      {done && (
        <p>
          <b>{score}/{quiz.length}</b> {score === quiz.length ? '🏆 Perfect!' : score >= 3 ? 'Nice.' : 'Tomorrow brings new questions.'}{' '}
          <ShareButton label="Share result" text={`🏀 NBA Stats Hub · Trivia ${daily ? todayKey() : ''}\n${quiz.map((q, i) => (answers[i] === q.answer ? '🟩' : '🟥')).join('')} ${score}/${quiz.length}`} />{' '}
          <button className="link" onClick={() => setAnswers([])}>Play again</button>
        </p>
      )}
    </>
  );
}
