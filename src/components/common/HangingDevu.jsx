
import { useEffect } from "react";
import "./HangingDevu.css";

function HangingDevu() {
  useEffect(() => {
    function handlePointerDown(event) {
      const img = event.target.closest?.(".hang img.spider");
      if (!img) return;

      event.preventDefault();

      const rect = img.getBoundingClientRect();
      const thread = img.previousElementSibling;
      const hang = img.closest(".hang");

      const threadRect = thread.getBoundingClientRect();
      const hangRect = hang.getBoundingClientRect();

      const color = getComputedStyle(thread).backgroundColor;

      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      // Create the connecting web line.
      const svg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      svg.setAttribute("class", "spider-line");
      svg.setAttribute("aria-hidden", "true");

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");

      svg.appendChild(line);

      // Create the floating Devu.
      const fly = img.cloneNode();

      fly.className = "spider-fly";
      fly.removeAttribute("title");
      fly.style.width = rect.width + "px";

      document.body.append(svg, fly);

      // Hide the original Devu and thread.
      img.style.visibility = "hidden";
      thread.style.visibility = "hidden";

      // Fixed web attachment point.
      const anchorX = threadRect.left + threadRect.width / 2;
      const anchorY = hangRect.top;

      let x = rect.left;
      let y = rect.top;
      let rotation = 0;
      let lastX = event.clientX;

      function paint() {
        fly.style.left = x + "px";
        fly.style.top = y + "px";
        fly.style.transform = `rotate(${rotation}deg)`;

        line.setAttribute("x1", anchorX);
        line.setAttribute("y1", anchorY);
        line.setAttribute("x2", x + rect.width / 2);
        line.setAttribute("y2", y + rect.width * 0.04);
      }

      paint();

      function handlePointerMove(moveEvent) {
        rotation = Math.max(
          -25,
          Math.min(25, (moveEvent.clientX - lastX) * 2)
        );

        lastX = moveEvent.clientX;

        x = moveEvent.clientX - offsetX;
        y = moveEvent.clientY - offsetY;

        paint();
      }

      function handlePointerUp() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);

        const startX = x;
        const startY = y;
        const startRotation = rotation;
        const startTime = performance.now();

        function returnHome(time) {
          const homeRect = img.getBoundingClientRect();

          const progress = Math.min(
            1,
            (time - startTime) / 750
          );

          const easing =
            1 -
            Math.pow(1 - progress, 3) +
            Math.sin(progress * Math.PI) * 0.12;

          x = startX + (homeRect.left - startX) * easing;
          y = startY + (homeRect.top - startY) * easing;

          rotation =
            startRotation * (1 - progress) +
            Math.sin(progress * Math.PI * 3) *
              8 *
              (1 - progress);

          paint();

          if (progress < 1 && img.isConnected) {
            requestAnimationFrame(returnHome);
          } else {
            svg.remove();
            fly.remove();

            img.style.visibility = "";
            thread.style.visibility = "";
          }
        }

        requestAnimationFrame(returnHome);
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div
      className="hang"
      aria-hidden="true"
      style={{
        top: 0,
        left: "-3px",
        width: "120px",
        height: "360px",
      }}
    >
      <div className="drop">
        <div className="bob">
          <span className="thread" />

          <img
            className="spider"
            src="/images/spider_mascot.png"
            alt=""
            title="Drag me"
            draggable="false"
            style={{ width: "120px" }}
          />
        </div>
      </div>
    </div>
  );
}

export default HangingDevu;
