const MARK = "M7765 18894 c-232 -37 -260 -97 -260 -554 0 -578 8 -586 610 -600 610 -15 798 -108 1138 -563 383 -512 531 -825 1708 -3619 514 -1222 624 -1469 1592 -3593 702 -1541 1503 -3230 1664 -3505 367 -631 540 -774 933 -773 464 0 564 111 1068 1188 121 259 421 900 667 1425 246 525 769 1648 1162 2495 1267 2732 1304 2797 2020 3532 403 413 476 472 716 575 260 112 534 154 1086 167 530 12 526 8 526 581 0 589 -2 590 -805 545 -1431 -81 -2775 -81 -4343 0 -816 42 -812 45 -812 -540 0 -554 14 -572 455 -586 736 -22 1115 -436 1016 -1109 -43 -291 -754 -2122 -1220 -3139 -137 -301 -224 -365 -345 -256 -63 58 -29 -27 -1091 2650 -762 1920 -1310 3582 -1310 3977 0 342 316 547 845 548 481 1 534 60 535 595 0 578 -25 592 -945 541 -1454 -81 -4343 -81 -5900 -1 -330 17 -666 26 -710 19z";

export function createMark(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "72 54 156 192");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("mark");
  const fill = document.createElementNS("http://www.w3.org/2000/svg", "path");
  fill.setAttribute("transform", "translate(0 300) scale(.01 -.01)");
  fill.setAttribute("fill", "currentColor");
  fill.setAttribute("d", MARK);
  const stroke = document.createElementNS("http://www.w3.org/2000/svg", "path");
  stroke.setAttribute("d", "M108.5 72.5L194.5 100");
  stroke.setAttribute("stroke", "currentColor");
  stroke.setAttribute("stroke-opacity", "0.55");
  stroke.setAttribute("stroke-width", "8");
  const left = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  left.setAttribute("cx", "108.5");
  left.setAttribute("cy", "72.5");
  left.setAttribute("r", "15.5");
  left.setAttribute("fill", "#e645a2");
  const right = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  right.setAttribute("cx", "194.5");
  right.setAttribute("cy", "100");
  right.setAttribute("r", "15.5");
  right.setAttribute("fill", "#e645a2");
  svg.append(fill, stroke, left, right);
  return svg;
}

export function mountMarks(root: ParentNode = document) {
  root.querySelectorAll("[data-mark]").forEach((slot) => {
    slot.replaceChildren(createMark());
  });
}
