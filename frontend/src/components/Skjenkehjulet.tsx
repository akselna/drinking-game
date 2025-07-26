import React, { useEffect, useRef } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/Skjenkehjulet.css";

interface SkjenkehjuletProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const Skjenkehjulet: React.FC<SkjenkehjuletProps> = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const engineRef = useRef<any>(null);
  const runnerRef = useRef<any>(null);
  const ballRef = useRef<any>(null);
  const anchorRef = useRef<any>(null);
  const constraintRef = useRef<any>(null);
  const MatterRef = useRef<any>(null);
  const droppedRef = useRef(false);

  useEffect(() => {
    const loadAndInit = () => {
      const Matter = (window as any).Matter;
      if (!Matter) return;
      MatterRef.current = Matter;
      const svg = svgRef.current!;
      const { Engine, Runner, Bodies, World, Constraint } = Matter;

    const engine = Engine.create();
    const runner = Runner.create();
    engineRef.current = engine;
    runnerRef.current = runner;

    const viewboxArray = svg.getAttribute("viewBox")!.split(" ");
    const vbWidth = parseInt(viewboxArray[2]);
    const vbHeight = parseInt(viewboxArray[3]);

    const ballGraphic = svg.querySelector("#ballGraphic") as SVGCircleElement;
    const anchorGraphic = svg.querySelector("#anchorGraphic") as SVGCircleElement;

    const initBallBody = () => {
      const xpos = parseInt(ballGraphic.getAttribute("cx")!);
      const ypos = parseInt(ballGraphic.getAttribute("cy")!);
      const r = parseInt(ballGraphic.getAttribute("r")!);
      const body = Bodies.circle(xpos, ypos, r, { restitution: 0.6 });
      ballRef.current = body;
    };

    const initAnchorBody = () => {
      const xpos = parseInt(anchorGraphic.getAttribute("cx")!);
      const ypos = parseInt(anchorGraphic.getAttribute("cy")!);
      const r = parseInt(anchorGraphic.getAttribute("r")!);
      const body = Bodies.circle(xpos, ypos, r, { isStatic: true });
      anchorRef.current = body;
    };

    const initConstraint = () => {
      constraintRef.current = Constraint.create({
        bodyA: anchorRef.current!,
        bodyB: ballRef.current!,
        stiffness: 0.1,
        length: 75,
      });
    };

    const initWorld = () => {
      if (!engineRef.current) return;
      const floor = Bodies.rectangle(vbWidth / 2, vbHeight + 25, vbWidth, 50, {
        isStatic: true,
      });
      const left = Bodies.rectangle(-25, vbHeight / 2, 50, vbHeight, {
        isStatic: true,
      });
      const right = Bodies.rectangle(vbWidth + 25, vbHeight / 2, 50, vbHeight, {
        isStatic: true,
      });

      World.add(engineRef.current.world, [
        ballRef.current!,
        anchorRef.current!,
        constraintRef.current!,
        floor,
        left,
        right,
      ]);
      Runner.run(runnerRef.current!, engineRef.current!);
    };

    const draw = () => {
      if (!engineRef.current || !ballRef.current) return;
      const pos = ballRef.current.position;
      ballGraphic.setAttribute("cx", pos.x.toString());
      ballGraphic.setAttribute("cy", pos.y.toString());
      if (!droppedRef.current) {
        const chain = svg.querySelector("#chain") as SVGPathElement;
        chain.setAttribute(
          "d",
          `M${pos.x},${pos.y} L${anchorRef.current!.position.x},${anchorRef.current!.position.y}`
        );
      }
      requestAnimationFrame(draw);
    };

    initBallBody();
    initAnchorBody();
    initConstraint();
      initWorld();
      draw();

      return () => {
        if (engineRef.current && MatterRef.current) {
          MatterRef.current.Engine.clear(engineRef.current);
        }
        if (runnerRef.current && MatterRef.current) {
          MatterRef.current.Runner.stop(runnerRef.current);
        }
      };
    };

    if (!(window as any).Matter) {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.12.0/matter.min.js";
      script.onload = loadAndInit;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    } else {
      return loadAndInit();
    }
  }, []);

  const dropBall = () => {
    if (droppedRef.current || !engineRef.current || !constraintRef.current) return;
    if (MatterRef.current) {
      MatterRef.current.Composite.remove(engineRef.current.world, constraintRef.current);
    }
    droppedRef.current = true;
  };

  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    btn.addEventListener("click", dropBall);
    return () => {
      btn.removeEventListener("click", dropBall);
    };
  }, []);

  return (
    <div className="skjenkehjulet-container">
      <svg
        ref={svgRef}
        id="svg"
        width="300"
        height="400"
        viewBox="0 0 1000 1000"
        fill="none"
      >
        <defs>
          <filter id="shadow" width="140%" height="140%">
            <feDropShadow dx="10" dy="10" stdDeviation="0" floodColor="black" floodOpacity=".3" />
          </filter>
          <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
            <stop offset="0%" stopColor="#FF7373" />
            <stop offset="100%" stopColor="#790202" />
          </radialGradient>
        </defs>
        <rect id="background" width="1000" height="1000" fill="#cccccc" />
        <path id="chain" d="" stroke="white" strokeWidth="3" />
        <circle id="ballGraphic" cx="500" cy="50" r="20" fill="url(#ball_gradient)" />
        <circle id="anchorGraphic" cx="500" cy="10" r="7" fill="white" stroke="black" />
      </svg>
      <button ref={buttonRef} className="plinko-button">Test Plinko</button>
    </div>
  );
};

export default Skjenkehjulet;
