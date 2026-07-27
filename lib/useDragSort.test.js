import { describe, expect, it } from "vitest";
import { scrollStep, shiftFor, slotFor } from "./useDragSort";

// Four cards of the same height, stacked with no gap: midpoints at 50, 150,
// 250, 350. Heights vary in real days, so there's a ragged list below too.
const evenRows = [0, 100, 200, 300].map((top) => ({ top, height: 100 }));

// A day whose cards genuinely differ: a stop with a long description is twice
// the height of a bare one. Midpoints: 30, 160, 275, 340.
const raggedRows = [
  { top: 0, height: 60 },
  { top: 60, height: 200 },
  { top: 260, height: 30 },
  { top: 290, height: 100 },
];

describe("slotFor", () => {
  it("keeps the card where it started until it clears a neighbour's midpoint", () => {
    expect(slotFor(50, evenRows, 0)).toBe(0);
    expect(slotFor(149, evenRows, 0)).toBe(0);
    expect(slotFor(151, evenRows, 0)).toBe(1);
  });

  it("counts every midpoint the card has passed, not just the nearest", () => {
    expect(slotFor(360, evenRows, 0)).toBe(3);
    expect(slotFor(260, evenRows, 0)).toBe(2);
  });

  it("works the same dragging upwards", () => {
    expect(slotFor(40, evenRows, 3)).toBe(0);
    expect(slotFor(140, evenRows, 3)).toBe(1);
    expect(slotFor(340, evenRows, 3)).toBe(3);
  });

  it("reads the midpoints off the cards, so uneven ones still land right", () => {
    // Past the tall card's midpoint (160) but not the short one's (275).
    expect(slotFor(200, raggedRows, 0)).toBe(1);
    expect(slotFor(280, raggedRows, 0)).toBe(2);
    // Coming back up: above the tall card's midpoint means slot 1, and only
    // clearing 30 - the first card's midpoint - reaches the top.
    expect(slotFor(100, raggedRows, 3)).toBe(1);
    expect(slotFor(20, raggedRows, 3)).toBe(0);
  });

  it("holds its slot at the exact boundary rather than flickering across it", () => {
    expect(slotFor(150, evenRows, 0)).toBe(0);
    expect(slotFor(250, evenRows, 3)).toBe(3);
  });

  it("can't be dragged out of the list", () => {
    expect(slotFor(-9000, evenRows, 2)).toBe(0);
    expect(slotFor(9000, evenRows, 2)).toBe(3);
  });
});

describe("shiftFor", () => {
  // Everything the lifted card passes moves by the space it vacated, whatever
  // height those cards are themselves; everything beyond the drop slot stays
  // put, because the lift and the reinsertion cancel out for it.
  it("moves the cards being passed on the way down", () => {
    const drag = { from: 0, to: 2, lift: 120 };
    expect([1, 2].map((i) => shiftFor(i, drag))).toEqual([-120, -120]);
    expect(shiftFor(3, drag)).toBe(0);
  });

  it("moves them the other way on the way up", () => {
    const drag = { from: 3, to: 1, lift: 90 };
    expect([1, 2].map((i) => shiftFor(i, drag))).toEqual([90, 90]);
    expect(shiftFor(0, drag)).toBe(0);
  });

  it("leaves the list alone while the card is over its own slot", () => {
    const drag = { from: 2, to: 2, lift: 100 };
    expect([0, 1, 2, 3].map((i) => shiftFor(i, drag))).toEqual([0, 0, 0, 0]);
  });
});

describe("scrollStep", () => {
  const viewport = 800;

  it("doesn't scroll while the drag is away from the edges", () => {
    expect(scrollStep(400, viewport)).toBe(0);
    expect(scrollStep(76, viewport)).toBe(0);
    expect(scrollStep(724, viewport)).toBe(0);
  });

  it("scrolls harder the further into the edge the drag goes", () => {
    const shallow = scrollStep(750, viewport);
    const deep = scrollStep(790, viewport);
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it("scrolls back up at the top edge", () => {
    expect(scrollStep(50, viewport)).toBeLessThan(0);
    expect(scrollStep(0, viewport)).toBeLessThan(scrollStep(50, viewport));
  });

  it("stays capped however far past the edge the pointer goes", () => {
    expect(scrollStep(5000, viewport)).toBe(14);
    expect(scrollStep(-5000, viewport)).toBe(-14);
  });
});
