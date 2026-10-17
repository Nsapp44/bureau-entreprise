"use client";

/**
 * TodoListMode - Mode 0: fixed todo list with status icons.
 *
 * Displays up to 5 visible todo items at a time (no scrolling). When a task is
 * in_progress, it is centred in the viewport; otherwise the first items are
 * shown. A "+N" counter tells how many items are hidden.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Container, Graphics, Text } from "pixi.js";
import { useTick } from "@pixi/react";
import type { TodoItem } from "@/types";

export interface TodoListModeProps {
  todos: TodoItem[];
}

const MAX_VISIBLE = 5;

function getStatusIcon(status: string): string {
  switch (status) {
    case "completed":
      return "✓";
    case "in_progress":
      return "▶";
    default:
      return "○";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "#22c55e";
    case "in_progress":
      return "#3b82f6";
    default:
      return "#8A8F98";
  }
}

const LINE_X = 32;
const LINE_W = 277; // 42 chars of Courier 11px (~6.6 px each)
const CHAR_W = 6.6;

/** One todo line: scrolls back and forth when longer than the board. */
function ScrollLine({
  text,
  color,
  bold,
}: {
  text: string;
  color: string;
  bold: boolean;
}): ReactNode {
  const [mask, setMask] = useState<Graphics | null>(null);
  const boxRef = useRef<Container | null>(null);
  const textRef = useRef<Text | null>(null);
  const clean = text.replace(/\s+/g, " ").trim();
  const range = Math.max(0, clean.length * CHAR_W - LINE_W);

  useEffect(() => {
    if (boxRef.current) boxRef.current.mask = mask;
  }, [mask]);

  useTick(() => {
    const t = textRef.current;
    if (!t) return;
    if (range <= 0) {
      t.x = 0;
      return;
    }
    const scrollS = range / 30;
    const p = (performance.now() / 1000) % (2 * (1.5 + scrollS));
    let k = 0;
    if (p < 1.5) k = 0;
    else if (p < 1.5 + scrollS) k = (p - 1.5) / scrollS;
    else if (p < 3 + scrollS) k = 1;
    else k = 1 - (p - 3 - scrollS) / scrollS;
    t.x = -k * range;
  });

  return (
    <pixiContainer x={LINE_X}>
      <pixiGraphics
        ref={setMask}
        draw={(g: Graphics) => {
          g.clear();
          g.rect(0, -2, LINE_W, 18);
          g.fill(0xffffff);
        }}
      />
      <pixiContainer ref={boxRef}>
        <pixiText
          ref={textRef}
          text={clean}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 11,
            fill: color,
            fontWeight: bold ? "bold" : "normal",
          }}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export function TodoListMode({ todos }: TodoListModeProps): ReactNode {
  const inProgressIndex = todos.findIndex((t) => t.status === "in_progress");

  const baseOffset = useMemo(() => {
    if (inProgressIndex >= 0 && todos.length > MAX_VISIBLE) {
      return Math.max(
        0,
        Math.min(
          inProgressIndex - Math.floor(MAX_VISIBLE / 2),
          todos.length - MAX_VISIBLE,
        ),
      );
    }
    return 0;
  }, [inProgressIndex, todos.length]);

  const scrollOffset = baseOffset;
  const visibleTodos = todos.slice(scrollOffset, scrollOffset + MAX_VISIBLE);

  if (todos.length === 0) {
    return (
      <pixiContainer x={165} y={50} scale={0.5}>
        <pixiText
          text="No tasks yet"
          anchor={0.5}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 24,
            fill: "#8A8F98",
          }}
          resolution={2}
        />
      </pixiContainer>
    );
  }

  return (
    <pixiContainer>
      {visibleTodos.map((todo, index) => (
        <pixiContainer key={`todo-${scrollOffset + index}`} y={2 + index * 24}>
          <pixiText
            text={getStatusIcon(todo.status)}
            x={16}
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 12,
              fill: getStatusColor(todo.status),
            }}
            resolution={2}
          />
          <ScrollLine
            text={
              todo.status === "in_progress" && todo.active_form
                ? todo.active_form
                : todo.content
            }
            color={todo.status === "completed" ? "#6A6F78" : "#F3F1EC"}
            bold={todo.status === "in_progress"}
          />
        </pixiContainer>
      ))}

      {todos.length > visibleTodos.length && (
        <pixiContainer x={165} y={130} scale={0.5}>
          <pixiText
            text={`+${todos.length - visibleTodos.length}`}
            anchor={0.5}
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 18,
              fill: "#8A8F98",
            }}
            resolution={2}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}
