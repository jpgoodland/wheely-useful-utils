"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function WheelSpinner({ categories, onSpinComplete }) {
  const canvasRef = useRef(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  // Constants
  const colors = [
    "#3b82f6", "#ec4899", "#10b981", "#f59e0b", 
    "#8b5cf6", "#ef4444", "#14b8a6", "#f43f5e"
  ];

  const styledCategories = categories.map((c, i) => ({
    ...c,
    color: c.color || colors[i % colors.length]
  }));

  const totalWeight = styledCategories.reduce((sum, c) => sum + c.weight, 0);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, width, height);
    if (styledCategories.length === 0 || totalWeight === 0) return;

    let currentAngle = rotation;

    styledCategories.forEach((cat) => {
      const sliceAngle = (cat.weight / totalWeight) * 2 * Math.PI;

      // Slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(currentAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Inter, sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.fillText(cat.name, radius - 20, 5);
      ctx.restore();

      currentAngle += sliceAngle;
    });

    // Center pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.stroke();
  }, [styledCategories, totalWeight, rotation]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const spin = async () => {
    if (isSpinning || styledCategories.length === 0) return;
    setIsSpinning(true);

    try {
        const res = await onSpinComplete(1);
        const winners = res.winners;
        
        // We visually spin towards the FINAL consecutive winner so the math lines up perfectly for the UX
        const finalWinnerObj = winners[winners.length - 1];

        // We use the originally rendered weights for the angle of the spin (since the drawing doesn't update until after)
        let accAngle = 0;
        let targetStartAngle = 0;
        let targetSliceAngle = 0;

        for (const cat of styledCategories) {
            const sliceAngle = (cat.weight / totalWeight) * 2 * Math.PI;
            if (cat.name === finalWinnerObj.name) {
                targetStartAngle = accAngle;
                targetSliceAngle = sliceAngle;
                break;
            }
            accAngle += sliceAngle;
        }

        const pointerAngle = -Math.PI / 2;
        const targetCenterAngle = targetStartAngle + targetSliceAngle / 2;
        let finalRotation = pointerAngle - targetCenterAngle;
        
        const fullSpins = (5 + Math.floor(Math.random() * 5)) * 2 * Math.PI;
        finalRotation -= fullSpins; 

        const duration = 4000;
        const startRotation = rotation;
        const startTime = performance.now();

        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuart(progress);
            const currentRotation = startRotation + (finalRotation - startRotation) * easedProgress;
            
            setRotation(currentRotation % (Math.PI * 2) + fullSpins);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setRotation(finalRotation % (Math.PI * 2));
                setIsSpinning(false);
            }
        };

        requestAnimationFrame(animate);

    } catch (err) {
        console.error(err);
        setIsSpinning(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "500px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        position: "absolute",
        top: "-15px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "0",
        height: "0",
        borderLeft: "15px solid transparent",
        borderRight: "15px solid transparent",
        borderTop: "30px solid var(--accent-pink)",
        zIndex: 10,
        filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))"
      }}></div>

      <canvas 
        ref={canvasRef} 
        width={500} 
        height={500}
        style={{ width: "100%", height: "auto", display: "block" }}
      />

      <div className="mt-8 flex gap-4 align-center justify-center p-4 glass-panel" style={{ width: "100%", padding: "1rem" }}>
        <button 
          className="btn btn-primary" 
          style={{ fontSize: "1.25rem", flex: 1 }}
          onClick={spin}
          disabled={isSpinning || categories.length === 0}
        >
          {isSpinning ? "Spinning..." : "SPIN IT"}
        </button>
      </div>
    </div>
  );
}
