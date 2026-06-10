"use client";

import { ReactFlow, Background, Controls } from "@xyflow/react";
import { useMemo } from "react";
import { buildMachineGraph } from "@/lib/agent/graph";
import type { Phase } from "@/lib/agent/machine";

interface MachineVizProps {
  activePhase: Phase | null;
}

const STATE_COLORS: Record<string, string> = {
  analyzing: "#6366f1",
  planning: "#8b5cf6",
  executing: "#ec4899",
  verifying: "#f59e0b",
  done: "#10b981",
  failed: "#ef4444",
};

export function MachineViz({ activePhase }: MachineVizProps) {
  const { nodes: baseNodes, edges: baseEdges } = useMemo(
    () => buildMachineGraph(),
    [],
  );

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        draggable: false,
        data: {
          ...n.data,
          active: n.id === activePhase,
          label: n.data.label,
        },
        style: {
          background: n.id === activePhase ? STATE_COLORS[n.id] : "#e0e5ec",
          color: n.id === activePhase ? "#fff" : "#4b5563",
          border: `2px solid ${STATE_COLORS[n.id] ?? "#94a3b8"}`,
          borderRadius: 12,
          fontWeight: n.id === activePhase ? 700 : 400,
          boxShadow:
            n.id === activePhase
              ? `0 0 0 4px ${STATE_COLORS[n.id]}33`
              : "4px 4px 8px #b8bec7, -4px -4px 8px #ffffff",
          padding: "8px 16px",
          fontSize: 13,
          minWidth: 110,
          textAlign: "center" as const,
        },
      })),
    [baseNodes, activePhase],
  );

  const edges = useMemo(
    () =>
      baseEdges.map((e) => ({
        ...e,
        animated: e.source === activePhase,
        style: {
          stroke:
            e.source === activePhase
              ? STATE_COLORS[e.source] ?? "#94a3b8"
              : "#cbd5e1",
        },
      })),
    [baseEdges, activePhase],
  );

  return (
    <div className="h-56 w-full rounded-2xl bg-neu-base shadow-neu-inset overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#c8cdd6" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
