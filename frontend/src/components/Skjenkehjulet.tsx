import React, { useEffect } from "react";
import "../styles/Skjenkehjulet.css";
import Matter from "matter-js";

const Skjenkehjulet: React.FC = () => {
  useEffect(() => {
    const { Engine, Events, Runner, Bodies, Constraint } = Matter as any;
    const svg = document.querySelector("#skjenk-svg") as SVGSVGElement;
    if (!svg) return;
    const viewboxArray = svg.getAttribute("viewBox")!.split(" ");
    const vbWidth = parseInt(viewboxArray[2]);
    const vbHeight = parseInt(viewboxArray[3]);

    const engine = Engine.create();
    const runner = Runner.create();

    const ballGraphic = document.getElementById("skjenk-ball") as SVGCircleElement;
    let ballBody: Matter.Body;
    const anchorGraphic = document.getElementById("skjenk-anchor") as SVGCircleElement;
    let anchorBody: Matter.Body;
    let anchorConstraint: Matter.Constraint;

    const initBallBody = () => {
      const xpos = parseInt(ballGraphic.getAttribute("cx")!);
      const ypos = parseInt(ballGraphic.getAttribute("cy")!);
      const r = parseInt(ballGraphic.getAttribute("r")!);
      ballBody = Bodies.circle(0, 0, r, { friction: 0, restitution: 0.6 });
      Matter.Body.setPosition(ballBody, { x: xpos, y: ypos });
    };

    const initAnchorBody = () => {
      const xpos = parseInt(anchorGraphic.getAttribute("cx")!);
      const ypos = parseInt(anchorGraphic.getAttribute("cy")!);
      const r = parseInt(anchorGraphic.getAttribute("r")!);
      anchorBody = Bodies.circle(0, 0, r, { isStatic: true });
      Matter.Body.setPosition(anchorBody, { x: xpos, y: ypos });
    };

    const initConstraint = () => {
      anchorConstraint = Constraint.create({
        bodyA: anchorBody,
        bodyB: ballBody,
        stiffness: 0.1,
        length: 75,
      });
    };

    const initFloor = () => {
      const floor = Bodies.rectangle(vbWidth / 2, vbHeight + 25, vbWidth, 50, { isStatic: true });
      Matter.Composite.add(engine.world, floor);
    };

    const dropButton = document.getElementById("skjenk-drop") as HTMLButtonElement;
    const dropBall = () => {
      Matter.Composite.remove(engine.world, anchorConstraint);
    };

    dropButton.addEventListener("click", dropBall);

    initBallBody();
    initAnchorBody();
    initConstraint();
    initFloor();
    Matter.Composite.add(engine.world, [ballBody, anchorBody, anchorConstraint]);
    Runner.run(runner, engine);

    Events.on(engine, "afterUpdate", () => {
      const pos = ballBody.position;
      ballGraphic.setAttribute("cx", pos.x.toString());
      ballGraphic.setAttribute("cy", pos.y.toString());
      if (anchorConstraint) {
        const chain = document.getElementById("skjenk-chain") as SVGPathElement;
        chain.setAttribute("d", `M${pos.x},${pos.y} L${anchorBody.position.x},${anchorBody.position.y}`);
      }
    });

    return () => {
      dropButton.removeEventListener("click", dropBall);
      Matter.Render.stop(engine);
      Runner.stop(runner);
    };
  }, []);

  return (
    <div className="skjenkehjulet-container">
      <svg id="skjenk-svg" width="600" height="600" viewBox="0 0 1000 1000" fill="none">
        <defs>
          <radialGradient id="ball_gradient" cx="20%" cy="20%" fx="20%" fy="20%">
            <stop offset="0%" stopColor="#FF7373" />
            <stop offset="100%" stopColor="#790202" />
          </radialGradient>
        </defs>
        <circle id="skjenk-ball" cx="500" cy="50" r="20" fill="url(#ball_gradient)" />
        <circle id="skjenk-anchor" cx="500" cy="10" r="7" fill="white" stroke="black" />
        <path id="skjenk-chain" d="" stroke="white" strokeWidth="3" />
      </svg>
      <button id="skjenk-drop">Test Plinko</button>
    </div>
  );
};

export default Skjenkehjulet;
