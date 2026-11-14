/** The nine flowing contours inspected in Hedwig's public home-page background. */
export const CONTOUR_PATHS = [
  "M-180 120C90-120 250 40 210 230S-80 410 70 600 430 710 330 1050",
  "M-160 180C80-50 310 30 270 240S-10 430 130 580 490 720 400 1050",
  "M-120 250C100 50 375 10 335 250S65 430 200 560 550 740 475 1050",
  "M-80 320C150 130 440-10 410 260S160 415 285 545 625 750 555 1050",
  "M480-100C750 120 525 280 695 410S1050 320 1140 540 930 780 1090 1100",
  "M565-100C840 100 600 255 760 360S1130 285 1205 525 995 805 1165 1100",
  "M660-100C915 80 695 230 835 310S1200 245 1275 510 1060 840 1245 1100",
  "M765-100C1000 50 795 210 915 260S1270 200 1345 495 1140 875 1330 1100",
  "M870-100C1100 20 885 170 1000 210S1340 155 1420 480 1210 910 1420 1100",
] as const;

const NUMBER = /-?\d*\.?\d+/g;

/** Horizontal SVG path morph, matching the reference's amplitude, phase and period. */
export function contourAt(path: string, index: number, seconds: number): string {
  const numbers = path.match(NUMBER)!.map(Number);
  const theta = (Math.PI * 2 * seconds) / (17 + (index % 4) * 4.5);
  const amplitude = (26 + (index % 3) * 9) * Math.sin(theta);
  const phase = index * 0.9 + 1.3 * Math.sin(theta * 0.5);
  let cursor = 0;
  return path.replace(NUMBER, () => {
    const i = cursor++;
    const value =
      numbers[i] + (i % 2 === 0 ? amplitude * Math.sin(numbers[i + 1] / 210 + phase) : 0);
    return `${i ? " " : ""}${Math.round(value * 10) / 10}`;
  });
}
