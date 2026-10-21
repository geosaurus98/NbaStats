// The bundled teammate graph, built once on first use.
import raw from '../data/teammates.json';
import { buildGraph, type Graph, type TeammateData } from './teammates';

let graph: Graph | undefined;

export function getTeammateGraph(): Graph {
  graph ??= buildGraph(raw as unknown as TeammateData);
  return graph;
}
