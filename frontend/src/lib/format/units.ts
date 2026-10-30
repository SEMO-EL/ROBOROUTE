/**
 * Display formatting. Internal values are SI (m, s, rad); the UI shows centimetres, degrees and
 * seconds. Conversion happens only here, at the presentation boundary.
 */

const MINUS = "−";

function signed(text: string): string {
  return text.startsWith("-") ? MINUS + text.slice(1) : text;
}

export function formatLength(metres: number, digits = 1): string {
  return `${signed((metres * 100).toFixed(digits))} cm`;
}

export function formatAngle(radians: number): string {
  return `${signed(Math.round((radians * 180) / Math.PI).toString())}°`;
}

export function formatSeconds(seconds: number): string {
  const text = Number.isInteger(seconds) ? seconds.toString() : seconds.toFixed(1);
  return `${signed(text)} s`;
}

export function formatPoint(x: number, y: number): string {
  return `${formatLength(x).replace(" cm", "")} cm, ${formatLength(y)}`;
}
