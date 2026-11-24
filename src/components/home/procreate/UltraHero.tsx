import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { buildField, RING, wander } from "./ultra-field";
import "./ultra-hero.css";

const HEADLINE = "Learn a language by speaking it.";
const TYPE_MS = 42; // per letter
const TYPE_START_MS = 350;

const VERTEX = `
attribute vec3 aMark;
uniform vec2 uRes;
uniform vec2 uRing;
uniform float uSize;
uniform float uRadius;
uniform float uEdge;
uniform float uTail;
uniform float uPush;
uniform float uStep;
uniform float uTime;
uniform float uDpr;
varying float vAlpha;
varying float vAngle;
varying float vThin;

void main() {
  vec2 p = aMark.xy;
  float k = aMark.z;
  // A slow, tiny drift so the field never looks printed.
  p += vec2(sin(uTime * 0.6 + k * 40.0), cos(uTime * 0.5 + k * 31.0)) * 0.9;

  vec2 away = p - uRing;
  float d = length(away);
  float x = d - uRadius * uSize;
  float light = x < 0.0
    ? exp(-pow(x / max(1.0, uEdge * uSize * 6.0), 2.0))
    : exp(-pow(x / max(1.0, uTail * uSize), 2.0));
  vec2 dir = d > 0.001 ? away / d : vec2(1.0, 0.0);
  p += dir * light * uPush * uStep;

  // Faint dot when resting, a short dash when lit.
  float len = mix(1.7, 7.0 + k * 4.0, light);
  gl_PointSize = len * uDpr;
  vThin = clamp(1.9 / len, 0.0, 1.0);
  vAngle = atan(dir.y, dir.x);
  vAlpha = mix(0.14 + k * 0.1, 0.7 + k * 0.3, light);

  vec2 clip = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;
varying float vAlpha;
varying float vAngle;
varying float vThin;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // gl_PointCoord's y runs down the screen; turn the mark to face away from the ring.
  float s = sin(-vAngle);
  float co = cos(-vAngle);
  vec2 q = vec2(co * c.x + s * c.y, -s * c.x + co * c.y);
  float across = smoothstep(vThin * 0.5 + 0.06, vThin * 0.5 - 0.02, abs(q.y));
  float along = smoothstep(0.5, 0.42, abs(q.x));
  float a = across * along * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(0.07, 0.067, 0.09, 1.0) * a;
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * The top of the home page: a quiet field of black marks with a soft ring that follows the
 * pointer (or drifts on its own) and lifts the marks under it into dashes; Uzyra's mark and
 * name; the headline typed in letter by letter; and Uzyra's cube, large, below it.
 *
 * The field is plain WebGL (no library), draws only while on screen, and holds still with reduced
 * motion. Without WebGL the page is simply white.
 */
export function UltraHero() {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const levels = useRef({ input: 0, output: 0 });
  const [moving, setMoving] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMoving(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const sectionEl = section.current;
    const canvasEl = canvas.current;
    if (!sectionEl || !canvasEl) return;
    const gl = canvasEl.getContext("webgl", { premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const u = {
      res: at("uRes"),
      ring: at("uRing"),
      size: at("uSize"),
      radius: at("uRadius"),
      edge: at("uEdge"),
      tail: at("uTail"),
      push: at("uPush"),
      step: at("uStep"),
      time: at("uTime"),
      dpr: at("uDpr"),
    };
    gl.uniform1f(u.edge, RING.edge);
    gl.uniform1f(u.tail, RING.tail);
    gl.uniform1f(u.push, RING.push);

    const buffer = gl.createBuffer();
    const mark = gl.getAttribLocation(program, "aMark");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(mark);
    gl.vertexAttribPointer(mark, 3, gl.FLOAT, false, 0, 0);

    let width = 1;
    let height = 1;
    let count = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      width = Math.max(1, sectionEl.clientWidth);
      height = Math.max(1, sectionEl.clientHeight);
      canvasEl.width = Math.round(width * dpr);
      canvasEl.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvasEl.width, canvasEl.height);
      const field = buildField(width, height);
      count = field.count;
      gl.bufferData(gl.ARRAY_BUFFER, field.points, gl.STATIC_DRAW);
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.size, Math.min(width, height));
      gl.uniform1f(u.step, field.step);
      gl.uniform1f(u.dpr, dpr);
      draw(performance.now());
    };

    // The ring: it eases towards the pointer, and drifts on its own when there is none.
    const ring = { x: width * 0.5, y: height * 0.58, set: false };
    let pointer: { x: number; y: number; at: number } | null = null;
    const onMove = (event: PointerEvent) => {
      const rect = sectionEl.getBoundingClientRect();
      pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        at: performance.now(),
      };
    };
    sectionEl.addEventListener("pointermove", onMove, { passive: true });
    sectionEl.addEventListener("pointerdown", onMove, { passive: true });

    const still = media().matches;
    let last = performance.now();
    const start = last;
    function draw(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const idle = !pointer || now - pointer.at > 2600;
      const goal = idle ? wander(t) : null;
      const gx = goal ? goal.x * width : pointer!.x;
      const gy = goal ? goal.y * height : pointer!.y;
      if (!ring.set || still) {
        ring.x = gx;
        ring.y = gy;
        ring.set = true;
      } else {
        const ease = 1 - Math.pow(idle ? 0.35 : 0.002, dt);
        ring.x += (gx - ring.x) * ease;
        ring.y += (gy - ring.y) * ease;
      }
      // The ring breathes a little.
      gl!.uniform1f(u.radius, RING.radius * (1 + (still ? 0 : 0.06 * Math.sin(t * 0.7))));
      gl!.uniform2f(u.ring, ring.x, ring.y);
      gl!.uniform1f(u.time, still ? 0 : t);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.POINTS, 0, count);
    }

    let frame = 0;
    let onScreen = true;
    const loop = (now: number) => {
      frame = 0;
      draw(now);
      if (!still && onScreen && !document.hidden) frame = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!still && !frame && onScreen && !document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      wake();
    });
    io.observe(sectionEl);
    document.addEventListener("visibilitychange", wake);
    const ro = new ResizeObserver(resize);
    ro.observe(sectionEl);
    resize();
    wake();
    sectionEl.dataset.field = "on";

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", wake);
      sectionEl.removeEventListener("pointermove", onMove);
      sectionEl.removeEventListener("pointerdown", onMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      delete sectionEl.dataset.field;
    };
  }, [moving]);

  return (
    <section
      ref={section}
      className="uz-ultra"
      dir="ltr"
      lang="en"
      aria-labelledby="uz-ultra-title"
    >
      <canvas ref={canvas} className="uz-ultra-field" aria-hidden="true" />
      <div className="uz-ultra-inner">
        <p className="uz-ultra-lockup">
          <span>Meet</span>
          <span className="uz-ultra-mark" aria-hidden="true">
            <RitaCube levelsRef={levels} mode="idle" label="" active={moving} />
          </span>
          <span>Uzyra Ultra</span>
        </p>
        <h1 id="uz-ultra-title" className="uz-ultra-title">
          <span className="uz-ultra-sr">{HEADLINE}</span>
          <span className="uz-ultra-typed" aria-hidden="true">
            {[...HEADLINE].map((ch, i) => (
              <span
                key={i}
                className={i === HEADLINE.length - 1 ? "uz-ultra-ch uz-ultra-last" : "uz-ultra-ch"}
                style={
                  {
                    "--i": i,
                    "--type": `${TYPE_MS}ms`,
                    "--start": `${TYPE_START_MS}ms`,
                  } as CSSProperties
                }
              >
                {ch}
              </span>
            ))}
          </span>
        </h1>
        <div className="uz-ultra-cube">
          <RitaCube levelsRef={levels} mode="idle" label="Uzyra" active={moving} />
        </div>
      </div>
    </section>
  );
}

const media = () => window.matchMedia("(prefers-reduced-motion: reduce)");
