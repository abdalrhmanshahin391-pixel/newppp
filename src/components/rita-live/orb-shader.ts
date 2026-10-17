/**
 * GLSL for the Rita voice orb: a pearl-white sphere whose interior is a slowly
 * churning field of soft colour. Original implementation (domain-warped value
 * noise on the sphere surface, soft light, pearly rim, film grain). The only
 * inputs are the numbers produced by orb-dynamics.ts.
 */

export const ORB_VERTEX = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const ORB_FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;      // canvas size in device pixels
uniform float uPhase;   // accumulated flow phase (seconds, speed-weighted)
uniform float uRadius;  // 1.0 = full size
uniform float uWarp;    // 0..1 how violently the clouds churn
uniform float uGlow;    // 0..1 outer glow
uniform float uPulse;   // 0..1 fast energy
uniform vec4 uMix;      // idle, listening, thinking, speaking weights
uniform vec3 uColA;     // ice blue
uniform vec3 uColB;     // lavender
uniform vec3 uColC;     // peach
out vec4 outColor;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}

float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v / 0.875;
}

float fbm4(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v / 0.9375;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float minSide = min(uRes.x, uRes.y);
  vec2 uv = (frag * 2.0 - uRes) / minSide;

  // The orb fills about 60% of the canvas so its glow has room to breathe.
  float R = 0.6 * uRadius * (1.0 + 0.012 * uPulse);
  float d = length(uv) - R;
  float aa = max(fwidth(d), 1.0 / minSide);
  float mask = 1.0 - smoothstep(-aa, aa, d);

  // Surface position on the sphere, used as a 3D noise coordinate so clouds wrap naturally.
  vec2 q = uv / max(R, 1e-4);
  float z = sqrt(max(0.0, 1.0 - dot(q, q)));
  vec3 N = normalize(vec3(q, z));
  float t = uPhase;

  vec3 p = N * 1.35;
  vec3 w = vec3(
    fbm3(p * 1.1 + vec3(0.0, t * 0.60, t * 0.35)),
    fbm3(p * 1.1 + vec3(5.2, -t * 0.50, 1.3)),
    fbm3(p * 1.1 + vec3(2.7, 4.1, t * 0.45))
  ) - 0.5;
  p += w * (0.9 + uWarp * 1.7);

  float n1 = fbm4(p + vec3(t * 0.25, 0.0, t * 0.18));
  float n2 = fbm4(p * 1.5 + vec3(7.1, t * 0.30, -t * 0.20));
  float n3 = fbm4(p * 0.8 + vec3(-t * 0.20, 3.3, t * 0.15));

  float m1 = smoothstep(0.34, 0.72, n1);
  float m2 = smoothstep(0.37, 0.74, n2);
  float m3 = smoothstep(0.40, 0.76, n3);

  // Clouds are present at rest, and richer while someone is talking.
  float presence = 0.80 + 0.24 * uMix.w + 0.12 * uMix.y - 0.10 * uMix.z - 0.08 * uMix.x;

  vec3 col = vec3(0.90, 0.94, 1.0);
  col = mix(col, uColA, m1 * presence);
  col = mix(col, uColB, m2 * presence * 0.85);
  col = mix(col, uColC, m3 * presence * 0.70);

  // Soft studio lighting: gentle falloff, pearly rim, tiny highlight, quiet floor shadow.
  vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
  float diff = dot(N, L) * 0.5 + 0.5;
  col *= mix(0.80, 1.03, diff);

  float rim = pow(1.0 - z, 2.6);
  col = mix(col, vec3(0.62, 0.76, 1.0), rim * 0.5);
  col += vec3(0.55, 0.72, 1.0) * rim * (0.05 + 0.08 * uMix.w);

  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 38.0);
  col += vec3(spec * 0.16);

  col *= 1.0 - 0.14 * smoothstep(0.1, -0.9, N.y);

  // Outer glow: a faint cool bloom that follows energy; never neon.
  float g = exp(-max(d, 0.0) * 7.0) * uGlow * 0.5;
  vec3 glowCol = mix(uColA, vec3(1.0), 0.45);

  vec3 rgb = col * mask + glowCol * g * (1.0 - mask);
  float a = clamp(mask + g * (1.0 - mask), 0.0, 1.0);

  // Film grain keeps the dark gradients free of banding.
  // Dither colour and alpha: on a white page the soft outer glow would otherwise show rings.
  float grain = (hash(vec3(frag, 7.0)) - 0.5) / 255.0;
  rgb += grain * a * 2.0;
  a = clamp(a + grain * 1.5 * step(0.002, a), 0.0, 1.0);

  outColor = vec4(min(rgb, vec3(a)), a);
}`;

/** The home page blue on a soft blue-white base: a mid sky blue, a lighter blue and a deeper blue for depth. 0..1 sRGB. */
export const ORB_COLORS = {
  a: [0.36, 0.6, 0.95],
  b: [0.62, 0.78, 0.98],
  c: [0.2, 0.42, 0.85],
} as const;
