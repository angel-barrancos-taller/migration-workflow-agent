import { toDirectedGraph } from "xstate/graph";
import { createMigrationMachine } from "./machine";

export interface VizNode {
  id: string;
  position: { x: number; y: number };
  data: { label: string };
}

export interface VizEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const MAIN_STATES = ["analyzing", "planning", "executing", "verifying", "done"];
const H_SPACING = 180;
const FAILED_Y = 130;

function shortId(fullId: string): string {
  // XState prefixes state ids with the machine id: "migration.analyzing" → "analyzing"
  const parts = fullId.split(".");
  return parts[parts.length - 1];
}

export function buildMachineGraph(): { nodes: VizNode[]; edges: VizEdge[] } {
  const graph = toDirectedGraph(createMigrationMachine());

  const nodes: VizNode[] = [
    ...MAIN_STATES.map((id, i) => ({
      id,
      position: { x: i * H_SPACING, y: 0 },
      data: { label: id },
    })),
    {
      id: "failed",
      position: { x: 2 * H_SPACING, y: FAILED_Y },
      data: { label: "failed" },
    },
  ];

  const seen = new Set<string>();
  const edges: VizEdge[] = [];

  // XState v5 toDirectedGraph: root graph.edges is empty — edges live on child nodes
  for (const child of graph.children) {
    for (const edge of child.edges) {
      const source = shortId(edge.source.id);
      const target = shortId(edge.target.id);
      const key = `${source}→${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        id: key,
        source,
        target,
        label: edge.transition.eventType ?? undefined,
      });
    }
  }

  return { nodes, edges };
}
