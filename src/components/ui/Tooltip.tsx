import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

interface Props {
  children: ReactNode;
  content: ReactNode;
  delay?: number;
  position?: "top" | "bottom" | "left" | "right" | "auto";
  className?: string;
  maxWidth?: string;
  /** Render content with no box chrome (no background/border/padding). */
  bare?: boolean;
}

export function Tooltip({
  children,
  content,
  delay = 200,
  position = "top",
  className = "",
  maxWidth = "300px",
  bare = false,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const updatePosition = () => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !tooltip) return;

    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    const margin = 20;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const spaceAbove = containerRect.top;
    const spaceBelow = screenHeight - containerRect.bottom;

    // Side placement (left/right), vertically centred on the container, with a
    // flip to the opposite side when there isn't room. "auto" picks the side the
    // container sits on (outward from screen centre) so it never covers the box.
    if (position === "left" || position === "right" || position === "auto") {
      let side: "left" | "right";
      if (position === "auto") {
        side = containerRect.left + containerRect.width / 2 < screenWidth / 2 ? "left" : "right";
      } else {
        side = position;
      }
      const spaceRight = screenWidth - containerRect.right;
      const spaceLeft = containerRect.left;
      if (side === "right" && spaceRight < tooltipWidth + margin && spaceLeft > spaceRight) side = "left";
      else if (side === "left" && spaceLeft < tooltipWidth + margin && spaceRight > spaceLeft) side = "right";
      let left = side === "right"
        ? containerRect.right + margin
        : containerRect.left - tooltipWidth - margin;
      let top = containerRect.top + containerRect.height / 2 - tooltipHeight / 2;
      top = Math.max(margin, Math.min(top, screenHeight - tooltipHeight - margin));
      left = Math.max(margin, Math.min(left, screenWidth - tooltipWidth - margin));
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      return;
    }

    let verticalPos = "top";

    if (spaceBelow >= tooltipHeight + margin) {
      verticalPos = "bottom";
    } else if (spaceAbove >= tooltipHeight + margin) {
      verticalPos = "top";
    } else if (spaceBelow > spaceAbove) {
      verticalPos = "bottom";
    } else {
      verticalPos = "top";
    }

    let top = 0;
    let left = 0;

    switch (verticalPos) {
      case "top":
        top = containerRect.top - tooltipHeight - margin;
        break;
      case "bottom":
        top = containerRect.bottom + margin;
        break;
    }

    // Align right edge of tooltip to right edge of container, then clamp
    left = containerRect.right - tooltipWidth;

    if (top < margin) {
      top = margin;
    }
    if (top + tooltipHeight > screenHeight - margin) {
      top = screenHeight - tooltipHeight - margin;
    }
    if (left < margin) {
      left = margin;
    }
    if (left + tooltipWidth > screenWidth - margin) {
      left = screenWidth - tooltipWidth - margin;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  };

  const handleMouseEnter = () => {
    const id = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
    timeoutRef.current = id;
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      const handleResize = () => updatePosition();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {children}
      </div>

      {isVisible && createPortal(
        <>
          <style>{`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(${position === "top" ? "8px" : "-8px"});
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }

            @keyframes fadeInLeft {
              from {
                opacity: 0;
                transform: translateX(-8px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }

            @keyframes fadeInRight {
              from {
                opacity: 0;
                transform: translateX(8px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>
          <div
            ref={tooltipRef}
            className={bare ? "" : styles.goaTooltip}
            style={{
              position: "fixed",
              zIndex: 9999,
              opacity: 0,
              transform: "translateY(0)",
              animation: "fadeIn 0.2s ease-out forwards",
              pointerEvents: "none",
              ...(bare
                ? {}
                : {
                    maxWidth,
                    background: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    padding: "12px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
                    color: "#e0e0e0",
                    fontSize: "13px",
                    lineHeight: "1.4",
                  }),
            }}
          >
            {content}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
