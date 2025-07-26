import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import "../styles/Plinko.css";

interface PlinkoProps {
  mode: "mild" | "hardcore";
  onResult?: (sips: number) => void;
}

const mildScores = [1, 1, 2, 1, 2, 1, 2, 1, 1, 2];
const hardcoreScores = [5, 7, 5, 8, 6, 7, 8, 10, 7, 5];

const Plinko: React.FC<PlinkoProps> = ({ mode, onResult }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine>();
  const ballRef = useRef<Matter.Body>();
  const [result, setResult] = useState<number | null>(null);

  const scores = mode === "mild" ? mildScores : hardcoreScores;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const svg = container.querySelector("svg") as SVGSVGElement;
    if (!svg) return;

    const { Engine, Runner, Bodies, World, Events, Body } = Matter;

    const engine = Engine.create();
    const runner = Runner.create();
    engineRef.current = engine;

    const ball = Bodies.circle(500, 50, 20, {
      restitution: 0.6,
      friction: 0,
    });
    ballRef.current = ball;

    const wallThickness = 50;
    const floor = Bodies.rectangle(500, 1050, 1000, wallThickness, { isStatic: true });
    const left = Bodies.rectangle(-wallThickness / 2, 500, wallThickness, 1000, { isStatic: true });
    const right = Bodies.rectangle(1000 + wallThickness / 2, 500, wallThickness, 1000, { isStatic: true });

    const pegBodies: Matter.Body[] = [];
    const pegG = svg.querySelectorAll("#pegs circle");
    pegG.forEach((peg) => {
      const cx = parseInt(peg.getAttribute("cx") || "0", 10);
      const cy = parseInt(peg.getAttribute("cy") || "0", 10);
      const r = parseInt(peg.getAttribute("r") || "0", 10);
      const body = Bodies.circle(cx, cy, r, { isStatic: true, restitution: 1 });
      pegBodies.push(body);
    });

    const sensorBodies: Matter.Body[] = [];
    const sensorGraphics = svg.querySelectorAll("#sensors rect");
    sensorGraphics.forEach((sensor, index) => {
      const x = parseInt(sensor.getAttribute("x") || "0", 10);
      const y = parseInt(sensor.getAttribute("y") || "0", 10);
      const w = parseInt(sensor.getAttribute("width") || "0", 10);
      const h = parseInt(sensor.getAttribute("height") || "0", 10);
      const body = Bodies.rectangle(x + w / 2, y + h / 2, w, h / 2, { isStatic: true, isSensor: true });
      body.label = String(scores[index] || scores[0]);
      sensorBodies.push(body);
    });

    World.add(engine.world, [ball, floor, left, right, ...pegBodies, ...sensorBodies]);
    Runner.run(runner, engine);

    Events.on(engine, "afterUpdate", () => {
      Body.setPosition(ball, { x: ball.position.x, y: ball.position.y });
      const circle = svg.querySelector("#ballGraphic") as SVGCircleElement;
      if (circle) {
        circle.setAttribute("cx", ball.position.x.toString());
        circle.setAttribute("cy", ball.position.y.toString());
      }
    });

    Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const other = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
        if (other.isSensor && typeof other.label === "string") {
          const sips = parseInt(other.label, 10);
          setResult(sips);
          if (onResult) onResult(sips);
          Engine.clear(engine);
          Runner.stop(runner);
        }
      });
    });

    return () => {
      Engine.clear(engine);
      Runner.stop(runner);
    };
  }, [mode, onResult, scores]);

  const reset = () => {
    if (!engineRef.current || !ballRef.current) return;
    Matter.Body.setPosition(ballRef.current, { x: 500, y: 50 });
    Matter.Body.setVelocity(ballRef.current, { x: 0, y: 0 });
    setResult(null);
  };

  return (
    <div className="plinko-container" ref={containerRef}>
      <svg id="svg" width="600" height="600" viewBox="0 0 1000 1000" fill="none">
        <defs>
          <filter id="shadow" width="140%" height="140%">
            <feDropShadow dx="10" dy="10" stdDeviation="0" floodColor="black" floodOpacity=".3" />
          </filter>
          <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
            <stop offset="0%" stopColor="#FF7373" />
            <stop offset="100%" stopColor="#790202" />
          </radialGradient>
        </defs>
        <rect id="background" width="1000" height="1000" fill="#BFBDBD" />
        <circle id="ballGraphic" cx="500" cy="50" r="20" fill="url(#ball_gradient)" />
        <g id="pegs" fill="#FEFF9F">
          {Array.from({ length: 10 }).map((_, row) =>
            Array.from({ length: 10 }).map((_, col) => {
              const x = 100 + col * 80 - (row % 2 === 0 ? 0 : 40);
              const y = 200 + row * 60;
              return <circle key={`${row}-${col}`} cx={x} cy={y} r="10" />;
            })
          )}
        </g>
        <g id="sensors">
          {scores.map((s, i) => (
            <rect key={i} x={i * 100} y={900} width={100} height={100} fill="#D7FFEC" />
          ))}
        </g>
      </svg>
      <button onClick={reset}>Reset</button>
      {result !== null && <div className="result">Drikk {result} slurker!</div>}
    </div>
  );
};

export default Plinko;
