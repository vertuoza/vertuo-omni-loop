'use client';
// The screen: the canvas, the text layer over it and the CRT lines, on the grid the scene is drawn
// on. It fills the box it is given (the window on `full`, the lens on the two bodies) at the largest
// size that keeps the frame's shape, and draws the scene's grid inside that frame: a wide scene in
// the Game Boy's tall lens is letterboxed. Taps on the canvas are read in grid pixels.
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Form } from './form';
import { fit, WIDE, type Grid } from './grid';
import type { MapSlot, SceneName } from './scenes/common.ts';

/** What every text layer can read about the screen it is on. */
export interface ScreenInfo {
  form: Form;
  /** The grid the scene is drawn on: lay the text out for `grid.name`. */
  grid: Grid;
  /** The page shown, on a scene its group splits into pages, and how many there are. */
  page: number;
  pages: number;
}

export const ScreenContext = createContext<ScreenInfo>({ form: 'full', grid: WIDE, page: 0, pages: 1 });

/** The form, the grid and the page of the screen a text layer is drawn on. */
export const useScreen = () => useContext(ScreenContext);

/** A point on the screen, in the pixels of the grid it is drawn on. */
export interface GridPoint { x: number; y: number }

/** Where a pointer at `(clientX, clientY)` falls on `grid`, drawn in `rect` (the canvas on the page). */
export function toGrid(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number, grid: Grid): GridPoint {
  return { x: ((clientX - rect.left) / rect.width) * grid.w, y: ((clientY - rect.top) / rect.height) * grid.h };
}

/** The planet a tap at `p` lands on, if any: the map's hit test, in the pixels of the grid the map is drawn on. */
export function planetAt(layout: MapSlot[], p: GridPoint): MapSlot | null {
  return layout.find((s) => Math.hypot(s.x - p.x, s.y - p.y) <= s.r + 5) ?? null;
}

export function Screen({ scene, frame, info, canvasRef, onTap, children }: {
  scene: SceneName;
  /** The shape of the box the screen fills: the grid the form draws on. */
  frame: Grid;
  info: ScreenInfo;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onTap: (p: GridPoint) => void;
  children: ReactNode;
}) {
  const { grid } = info;
  const slotRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ w: number; h: number }>({ w: frame.w, h: frame.h });
  useLayoutEffect(() => { // measured before the first paint, then whenever the room changes
    const el = slotRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setRoom((r) => (r.w === width && r.h === height ? r : { w: width, h: height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const box = fit(room, frame);
  const at = fit(box, grid);
  return (
    <div className="screen-slot" ref={slotRef}>
      <div className="screen-box" style={{ width: box.w, height: box.h }}>
        <div
          className={`screen scene-${scene} grid-${grid.name}`}
          style={{ width: grid.w, height: grid.h, transform: `translate(${at.x}px, ${at.y}px) scale(${at.scale})` }}
        >
          <canvas
            ref={canvasRef}
            width={grid.w}
            height={grid.h}
            className="stage"
            onClick={(e) => onTap(toGrid(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY, grid))}
            aria-label="Galaxy screen"
          />
          <div className="overlay">
            <ScreenContext.Provider value={info}>{children}</ScreenContext.Provider>
          </div>
          <div className="crt" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
