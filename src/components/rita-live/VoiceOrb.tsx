import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { OrbDynamics, type OrbMode } from "./orb-dynamics";
import { ORB_COLORS, ORB_FRAGMENT, ORB_VERTEX } from "./orb-shader";

export type OrbLevels = { input: number; output: number };

type Props = {
  /** Live levels written by the voice transport callbacks. Read every frame, never stored in state. */
  levelsRef: MutableRefObject<OrbLevels>;
  mode: OrbMode;
  label?: string;
  className?: string;
};

const FALLBACK_STYLE = {
  background:
    "radial-gradient(circle at 38% 30%, #ffffff 0%, #e7eefd 42%, #b3cdfa 78%, #2b6df0 100%)",
  boxShadow: "0 0 90px 10px rgba(43, 109, 240, 0.26)",
} as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "shader compile failed";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

/**
 * Soft white and pink voice orb (the home page palette) rendered with a single WebGL2 fragment shader. It
 * contracts while the learner speaks, opens up in pauses, and churns quickly
 * while Rita speaks. Falls back to a still gradient disc without WebGL2.
 */
export function VoiceOrb({ levelsRef, mode, label, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setFallback(true);
      return;
    }

    let program: WebGLProgram | null = null;
    try {
      program = gl.createProgram();
      if (!program) throw new Error("Could not create program");
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, ORB_VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, ORB_FRAGMENT));
      gl.bindAttribLocation(program, 0, "aPos");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
      }
    } catch (error) {
      console.warn("Voice orb shader unavailable, using the still orb", error);
      setFallback(true);
      return;
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uRes = uniform("uRes");
    const uPhase = uniform("uPhase");
    const uRadius = uniform("uRadius");
    const uWarp = uniform("uWarp");
    const uGlow = uniform("uGlow");
    const uPulse = uniform("uPulse");
    const uMix = uniform("uMix");
    gl.uniform3f(uniform("uColA"), ...ORB_COLORS.a);
    gl.uniform3f(uniform("uColB"), ...ORB_COLORS.b);
    gl.uniform3f(uniform("uColC"), ...ORB_COLORS.c);

    const dynamics = new OrbDynamics();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let resolutionScale = 1;
    let slowFrames = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let onScreen = true;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !onScreen) {
        last = now;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // Drop resolution if the device cannot hold ~40 fps, then keep it.
      if (dt > 0.026) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 40 && resolutionScale > 0.6) {
        resolutionScale = Math.max(0.6, resolutionScale - 0.2);
        slowFrames = 0;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2) * resolutionScale;
      const width = Math.max(2, Math.floor(canvas.clientWidth * dpr));
      const height = Math.max(2, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);

      const levels = levelsRef.current;
      const frame = dynamics.step(dt, {
        input: levels.input,
        output: levels.output,
        mode: modeRef.current,
        reducedMotion: reducedMotion.matches,
      });

      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uPhase, frame.phase);
      gl.uniform1f(uRadius, frame.radius);
      gl.uniform1f(uWarp, frame.warp);
      gl.uniform1f(uGlow, frame.glow);
      gl.uniform1f(uPulse, frame.pulse);
      gl.uniform4f(
        uMix,
        frame.mix.idle,
        frame.mix.listening,
        frame.mix.thinking,
        frame.mix.speaking,
      );
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true;
          });
    observer?.observe(canvas);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      setFallback(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // Free the GPU context only when the canvas is really gone. React's development
      // double-run re-uses the same canvas, and a lost context would send it to the fallback.
      if (!canvas.isConnected) gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [levelsRef]);

  return (
    <div
      role="img"
      aria-label={label ?? "Rita voice"}
      className={`relative aspect-square ${className}`}
    >
      {fallback ? (
        <div
          className="absolute left-1/2 top-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={FALLBACK_STYLE}
        />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
