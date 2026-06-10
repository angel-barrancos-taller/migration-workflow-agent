import React from "react";

interface NodeData {
  id: string;
  [key: string]: unknown;
}

interface EdgeData {
  id: string;
  [key: string]: unknown;
}

export const ReactFlow = ({
  children,
  nodes,
  edges,
}: {
  children?: React.ReactNode;
  nodes?: NodeData[];
  edges?: EdgeData[];
}) => {
  const activeNode = nodes?.find(
    (n) => (n.data as { active?: boolean })?.active,
  );
  return (
    <div
      data-testid="react-flow"
      data-nodes={nodes?.length ?? 0}
      data-edges={edges?.length ?? 0}
      data-active={activeNode?.id ?? ""}
    >
      {children}
    </div>
  );
};

export const Background = () => null;
export const Controls = () => null;
export const MiniMap = () => null;
export const Handle = () => null;
export const Position = {
  Top: "top",
  Bottom: "bottom",
  Left: "left",
  Right: "right",
};
export const useReactFlow = () => ({ fitView: jest.fn() });
export const ReactFlowProvider = ({
  children,
}: {
  children?: React.ReactNode;
}) => <>{children}</>;
