import { render, screen } from "@testing-library/react";
import { MachineViz } from "./MachineViz";

describe("MachineViz", () => {
  it("renders without crashing", () => {
    const { container } = render(<MachineViz activePhase={null} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders ReactFlow (via mock) with nodes and edges", () => {
    render(<MachineViz activePhase={null} />);
    // The @xyflow/react mock renders a div with data-testid="react-flow"
    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("passes nodes and edges props to ReactFlow", () => {
    render(<MachineViz activePhase={null} />);
    const rf = screen.getByTestId("react-flow");
    const nodeCount = parseInt(rf.getAttribute("data-nodes") ?? "0");
    const edgeCount = parseInt(rf.getAttribute("data-edges") ?? "0");
    expect(nodeCount).toBe(6); // 5 main + failed
    expect(edgeCount).toBeGreaterThan(0);
  });

  it("marks the active phase node", () => {
    render(<MachineViz activePhase="analyzing" />);
    const rf = screen.getByTestId("react-flow");
    expect(rf.getAttribute("data-active")).toBe("analyzing");
  });
});
