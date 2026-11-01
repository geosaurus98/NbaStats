// The all-time teammate graph, downloaded and built on first use.
import { useEffect, useState } from 'react';
import { buildGraph, type Graph, type TeammateData } from './teammates';

let graph: Graph | undefined;
let pending: Promise<Graph> | undefined;

export function loadTeammateGraph(): Promise<Graph> {
  // The standalone file's data arrives as a promise (it's unpacked on demand), so await it either way.
  pending ??= import('../data/teammates.json').then((m) => (m.default ?? m) as unknown).then((d) => {
    graph = buildGraph(d as TeammateData);
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
