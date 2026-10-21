// The all-time teammate graph, downloaded and built on first use.
import { useEffect, useState } from 'react';
import { buildGraph, type Graph, type TeammateData } from './teammates';

let graph: Graph | undefined;
let pending: Promise<Graph> | undefined;

export function loadTeammateGraph(): Promise<Graph> {
  pending ??= import('../data/teammates.json').then((m) => {
    graph = buildGraph((m.default ?? m) as unknown as TeammateData);
    return graph;
  });
  return pending;
}

/** The graph, or undefined while it loads. */
export function useTeammateGraph(): Graph | undefined {
  const [g, setG] = useState(graph);
  useEffect(() => {
    if (!g) loadTeammateGraph().then(setG);
  }, [g]);
  return g;
}
