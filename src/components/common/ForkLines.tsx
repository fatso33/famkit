import React, { useLayoutEffect, useRef } from 'react';
import { JOIN_HEIGHT, SPLIT_HEIGHT, joinPath, splitPath } from '../../utils/forkLines';

interface ForkLinesProps {
  /** How many paths the fork has. */
  paths: number;
  /** The chosen path, whose branches are lit. */
  active: number;
  /** A step follows, so the branches join back into it. */
  join: boolean;
  /** The switch row. In the editor it ends with the add-path key, reached by a dashed branch. */
  head: React.ReactNode;
  /** The head ends with an add-path key. */
  withAdd?: boolean;
  /** The chosen path. */
  children: React.ReactNode;
  className?: string;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * A fork hanging from the method: a line from the middle, just under whatever comes before,
 * splits into a branch for each of the switch's buttons, and (when a step follows) the branches
 * join again under the chosen path. The chosen branches are lit; choosing another drains the old
 * one back up and draws the new one down from the top (index.css). The branches are placed from
 * the buttons' measured positions, so they follow the layout at any width or text size.
 */
export const ForkLines: React.FC<ForkLinesProps> = ({
  paths,
  active,
  join,
  head,
  withAdd = false,
  children,
  className = '',
}) => {
  const root = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const split = useRef<SVGSVGElement>(null);
  const joinRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    const row = headRef.current;
    if (!el || !row) return;
    const draw = () => {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const centre = box.width / 2;
      const ends = Array.from(
        row.querySelectorAll('.fork-switch-option, .fork-add-path'),
        (button) => {
          const r = button.getBoundingClientRect();
          return r.left - box.left + r.width / 2;
        },
      );
      const lines: [SVGSVGElement | null, number, typeof splitPath][] = [
        [split.current, SPLIT_HEIGHT, splitPath],
        [joinRef.current, JOIN_HEIGHT, joinPath],
      ];
      for (const [svg, height, shape] of lines) {
        if (!svg) continue;
        svg.setAttribute('viewBox', `0 0 ${box.width} ${height}`);
        svg.querySelectorAll<SVGElement>('[data-end]').forEach((part) => {
          const x = ends[Number(part.dataset.end)];
          if (x !== undefined) part.setAttribute('d', shape(centre, x, height));
        });
        svg.querySelector('.fork-node')?.setAttribute('cx', String(centre));
      }
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    // The buttons too: a switch can re-share its columns without the row changing size.
    const observer = new ResizeObserver(draw);
    observer.observe(row);
    row
      .querySelectorAll('.fork-switch-option, .fork-add-path')
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [paths, join, withAdd]);

  const branches = (kind: string) => (
    <>
      {range(paths).map((i) => (
        <path key={`b${i}`} data-end={i} className="fork-line" />
      ))}
      {kind === 'split' && withAdd && <path data-end={paths} className="fork-line is-add" />}
      {range(paths).map((i) => (
        <path
          key={`l${i}`}
          data-end={i}
          pathLength={1}
          className={`fork-line-lit${i === active ? ' is-on' : ''}`}
        />
      ))}
    </>
  );

  return (
    <div ref={root} className={`fork${join ? ' has-join' : ''} ${className}`.trim()}>
      <svg
        ref={split}
        className="fork-lines is-split"
        height={SPLIT_HEIGHT}
        aria-hidden="true"
        focusable="false"
      >
        {branches('split')}
        <circle className="fork-node" cy={1.5} r={3.5} />
      </svg>
      <div ref={headRef} className="fork-head">
        {head}
      </div>
      {children}
      {join && (
        <svg
          ref={joinRef}
          className="fork-lines is-join"
          height={JOIN_HEIGHT}
          aria-hidden="true"
          focusable="false"
        >
          {branches('join')}
          <circle className="fork-node" cy={JOIN_HEIGHT - 1.5} r={3.5} />
        </svg>
      )}
    </div>
  );
};
