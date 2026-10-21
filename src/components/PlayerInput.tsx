import { useEffect, useState } from 'react';
import { findPlayer, type Graph } from '../lib/teammates';

/** One shared suggestion list of every player in history. */
export function PlayerDatalist({ graph }: { graph: Graph }) {
  return (
    <datalist id="all-players">
      {graph.data.players.map(([name], i) => (
        <option key={i} value={name} />
      ))}
    </datalist>
  );
}

/** Name box over the all-time player list (needs <PlayerDatalist> on the page). */
export function PlayerInput({ graph, label, value, onPick }: { graph: Graph; label: string; value?: number; onPick: (p: number) => void }) {
  const current = value != null ? graph.data.players[value][0] : '';
  const [text, setText] = useState(current);
  useEffect(() => setText(current), [current]);
  const commit = (t: string) => {
    const p = findPlayer(graph.data, t);
    if (p != null) onPick(p);
  };
  return (
    <label className="player-input">
      <span className="muted small">{label}</span>
      <input
        list="all-players"
        value={text}
        placeholder="Type a player…"
        onChange={(e) => {
          setText(e.target.value);
          // Picking from the suggestion list gives an exact name: apply straight away.
          if (graph.data.players.some(([n]) => n === e.target.value)) commit(e.target.value);
        }}
        onKeyDown={(e) => e.key === 'Enter' && commit(text)}
        onBlur={() => text && text !== current && commit(text)}
      />
    </label>
  );
}

