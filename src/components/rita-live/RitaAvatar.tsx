import { useEffect, useRef, useState, type MutableRefObject } from "react";
import modelUrl from "@/assets/rita-avatar.glb?url";
import { AvatarDynamics, type AvatarPose, type Vec3 } from "./avatar-dynamics";
import type { OrbMode } from "./orb-dynamics";
import { VoiceOrb, type OrbLevels } from "./VoiceOrb";

type Props = {
  /** Live levels written by the voice transport callbacks. Read every frame, never stored in state. */
  levelsRef: MutableRefObject<OrbLevels>;
  mode: OrbMode;
  label?: string;
  className?: string;
  /** Stage colour behind Rita. The glow is composited against it. */
  background?: string;
};

/** Look of the figure: ivory facets lit from inside with a warm golden rim. */
const LOOK = {
  ivory: 0xffffff,
  ivoryGlow: 0xfff0d8,
  ivoryGlowStrength: 0.2,
  skinGlow: 0xfff2de,
  skinGlowStrength: 0.38,
  rim: [1.0, 0.83, 0.52] as const,
  rimStrength: 1.25,
  exposure: 0.95,
  bloom: { strength: 0.5, radius: 0.22, threshold: 0.92 },
  /** Body turned a little to her left, face back towards the viewer. */
  bodyYaw: 0.25,
  headYaw: -0.14,
};

const JOINTS = [
  "Root",
  "Hips",
  "Chest",
  "Neck",
  "Head",
  "Pony1",
  "Pony2",
  "ShoulderL",
  "ElbowL",
  "WristL",
  "ShoulderR",
  "ElbowR",
  "WristR",
  "EyeL",
  "EyeR",
] as const;

/**
 * Rita as a glowing low-poly 3D figure that talks with her voice: the mouth
 * follows her playback level, and she gestures at phrase boundaries. Renders
 * with three.js (loaded on demand). Falls back to the voice orb if WebGL or the
 * model is unavailable, or when the page is opened with `?orb=1`.
 */
export function RitaAvatar({
  levelsRef,
  mode,
  label,
  className = "",
  background = "#000000",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("orb")) setFallback(true);
  }, []);

  useEffect(() => {
    if (fallback) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const [
        THREE,
        { GLTFLoader },
        { EffectComposer },
        { RenderPass },
        { UnrealBloomPass },
        { OutputPass },
      ] = await Promise.all([
        import("three"),
        import("three/addons/loaders/GLTFLoader.js"),
        import("three/addons/postprocessing/EffectComposer.js"),
        import("three/addons/postprocessing/RenderPass.js"),
        import("three/addons/postprocessing/UnrealBloomPass.js"),
        import("three/addons/postprocessing/OutputPass.js"),
      ]);
      if (disposed) return;

      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 h-full w-full";
      // Feather the edges so the glow fades out instead of stopping at the canvas border.
      const feather =
        "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent), linear-gradient(to bottom, transparent, #000 7%, #000 93%, transparent)";
      canvas.style.maskImage = feather;
      canvas.style.webkitMaskImage = feather;
      canvas.style.maskComposite = "intersect";
      canvas.style.setProperty("-webkit-mask-composite", "source-in");
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = LOOK.exposure;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(background);
      const camera = new THREE.PerspectiveCamera(24, 3 / 4, 0.05, 20);
      camera.position.set(0, 1.21, 3.1);
      camera.lookAt(0, 1.19, 0);
      scene.add(new THREE.HemisphereLight(0xe8ecff, 0x3a3050, 0.32));
      const key = new THREE.DirectionalLight(0xfff6ea, 1.8);
      key.position.set(-1.2, 2.2, 2.4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffe2b0, 0.8);
      fill.position.set(1.5, 0.6, 1.2);
      scene.add(fill);

      // Warm rim light baked into the material: brighter where the surface turns away from the viewer.
      const withRim = <M extends InstanceType<typeof THREE.MeshStandardMaterial>>(
        material: M,
        strength: number,
      ) => {
        material.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
             float ritaRim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);
             totalEmissiveRadiance += vec3(${LOOK.rim.map((v) => v.toFixed(2)).join(", ")}) * ritaRim * ${strength.toFixed(2)};`,
          );
        };
        return material;
      };
      const materials: Record<string, InstanceType<typeof THREE.Material>> = {
        Ivory: withRim(
          new THREE.MeshStandardMaterial({
            color: LOOK.ivory,
            emissive: LOOK.ivoryGlow,
            emissiveIntensity: LOOK.ivoryGlowStrength,
            roughness: 0.85,
            metalness: 0,
            flatShading: true,
            side: THREE.DoubleSide,
          }),
          LOOK.rimStrength,
        ),
        Skin: withRim(
          new THREE.MeshStandardMaterial({
            color: LOOK.ivory,
            emissive: LOOK.skinGlow,
            emissiveIntensity: LOOK.skinGlowStrength,
            roughness: 0.9,
            metalness: 0,
          }),
          LOOK.rimStrength * 0.6,
        ),
        Eye: new THREE.MeshStandardMaterial({ color: 0x120d0e, roughness: 0.25, metalness: 0 }),
        Mouth: new THREE.MeshStandardMaterial({
          color: 0x7a3e34,
          roughness: 0.6,
          side: THREE.DoubleSide,
        }),
        Blush: new THREE.MeshBasicMaterial({
          color: 0xffb4a8,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      };

      let gltf: Awaited<ReturnType<InstanceType<typeof GLTFLoader>["loadAsync"]>>;
      try {
        gltf = await new GLTFLoader().loadAsync(modelUrl);
      } catch (error) {
        console.warn("Rita avatar model unavailable, using the voice orb", error);
        renderer.dispose();
        if (!disposed) setFallback(true);
        return;
      }
      if (disposed) {
        renderer.dispose();
        return;
      }

      // A soft warm halo behind her: keeps the glow even when bloom is switched off on weak devices.
      const haloCanvas = document.createElement("canvas");
      haloCanvas.width = haloCanvas.height = 128;
      const haloContext = haloCanvas.getContext("2d");
      if (haloContext) {
        const gradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, "rgba(255,226,170,0.26)");
        gradient.addColorStop(0.45, "rgba(255,214,150,0.07)");
        gradient.addColorStop(1, "rgba(255,200,140,0)");
        haloContext.fillStyle = gradient;
        haloContext.fillRect(0, 0, 128, 128);
      }
      const haloTexture = new THREE.CanvasTexture(haloCanvas);
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: haloTexture,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      halo.scale.set(0.95, 1.7, 1);
      halo.position.set(0, 1.0, -0.3);
      // Bloom already glows; the halo only stands in once bloom is switched off.
      halo.visible = false;
      scene.add(halo);

      const root = gltf.scene;
      root.traverse((object) => {
        const mesh = object as InstanceType<typeof THREE.Mesh>;
        if (!mesh.isMesh) return;
        const name = (mesh.material as InstanceType<typeof THREE.Material>).name;
        (mesh.material as InstanceType<typeof THREE.Material>).dispose();
        mesh.material = materials[name] ?? materials.Ivory;
      });
      scene.add(root);

      const node = Object.fromEntries(JOINTS.map((n) => [n, root.getObjectByName(n)])) as Record<
        (typeof JOINTS)[number],
        InstanceType<typeof THREE.Object3D>
      >;
      const missing = JOINTS.filter((n) => !node[n]);
      if (missing.length) {
        console.warn("Rita avatar model is missing joints", missing);
        renderer.dispose();
        if (!disposed) setFallback(true);
        return;
      }
      const hands = {
        L: { open: root.getObjectByName("HandOpenL"), fist: root.getObjectByName("HandFistL") },
        R: { open: root.getObjectByName("HandOpenR"), fist: root.getObjectByName("HandFistR") },
      };
      const mouth = root.getObjectByName("MouthMesh") as
        InstanceType<typeof THREE.Mesh> | undefined;
      const morph = (key: string) => mouth?.morphTargetDictionary?.[key];
      const morphIndex = {
        open: morph("Open"),
        wide: morph("Wide"),
        round: morph("Round"),
        smile: morph("Smile"),
      };
      if (mouth?.morphTargetInfluences) mouth.morphTargetInfluences.fill(0);
      root.rotation.y = LOOK.bodyYaw;

      // Two-bone IK for the arms: hand target + pole -> shoulder and elbow rotations.
      const restArm = {
        L: { upper: node.ElbowL.position.clone(), fore: node.WristL.position.clone() },
        R: { upper: node.ElbowR.position.clone(), fore: node.WristR.position.clone() },
      };
      const v = {
        S: new THREE.Vector3(),
        T: new THREE.Vector3(),
        P: new THREE.Vector3(),
        D: new THREE.Vector3(),
        E: new THREE.Vector3(),
        tmp: new THREE.Vector3(),
        R: new THREE.Vector3(),
        q: new THREE.Quaternion(),
      };
      const solveArm = (side: "L" | "R", target: Vec3, pole: Vec3) => {
        const shoulder = node[`Shoulder${side}`];
        const elbow = node[`Elbow${side}`];
        const rest = restArm[side];
        const l1 = rest.upper.length();
        const l2 = rest.fore.length();
        v.S.copy(shoulder.position);
        v.T.set(...target);
        v.D.copy(v.T).sub(v.S);
        const d = Math.min(Math.max(v.D.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
        v.D.normalize();
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
        const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        v.P.set(...pole).sub(v.S);
        v.P.addScaledVector(v.D, -v.P.dot(v.D)).normalize();
        v.E.copy(v.S).addScaledVector(v.D, a).addScaledVector(v.P, h);
        v.tmp.copy(v.E).sub(v.S).normalize();
        shoulder.quaternion.setFromUnitVectors(v.R.copy(rest.upper).normalize(), v.tmp);
        // Forearm direction, expressed in the (rotated) shoulder frame.
        v.T.copy(v.S).addScaledVector(v.D, d).sub(v.E).normalize();
        v.q.copy(shoulder.quaternion).invert();
        v.T.applyQuaternion(v.q);
        elbow.quaternion.setFromUnitVectors(v.R.copy(rest.fore).normalize(), v.T);
      };

      const setRot = (object: InstanceType<typeof THREE.Object3D>, r: Vec3, extraY = 0) =>
        object.rotation.set(r[0], r[1] + extraY, r[2]);

      const apply = (pose: AvatarPose) => {
        node.Root.position.y = pose.root.y;
        setRot(node.Hips, pose.hips);
        setRot(node.Chest, pose.chest);
        setRot(node.Neck, pose.neck, LOOK.headYaw * 0.35);
        setRot(node.Head, pose.head, LOOK.headYaw * 0.65);
        setRot(node.Pony1, pose.pony1);
        setRot(node.Pony2, pose.pony2);
        solveArm("L", pose.left.target, pose.left.pole);
        solveArm("R", pose.right.target, pose.right.pole);
        setRot(node.WristL, pose.left.wrist);
        setRot(node.WristR, pose.right.wrist);
        for (const [side, open] of [
          ["L", pose.left.open],
          ["R", pose.right.open],
        ] as const) {
          if (hands[side].open) hands[side].open.visible = open >= 0.5;
          if (hands[side].fist) hands[side].fist.visible = open < 0.5;
        }
        const eye = 1 - 0.92 * pose.blink;
        node.EyeL.scale.y = eye;
        node.EyeR.scale.y = eye;
        const influences = mouth?.morphTargetInfluences;
        if (influences) {
          if (morphIndex.open !== undefined) influences[morphIndex.open] = pose.mouth.open;
          if (morphIndex.wide !== undefined) influences[morphIndex.wide] = pose.mouth.wide;
          if (morphIndex.round !== undefined) influences[morphIndex.round] = pose.mouth.round;
          if (morphIndex.smile !== undefined)
            influences[morphIndex.smile] = pose.mouth.smile * (1 - pose.mouth.open);
        }
      };

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(256, 256),
        LOOK.bloom.strength,
        LOOK.bloom.radius,
        LOOK.bloom.threshold,
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      host.appendChild(canvas);

      const dynamics = new AvatarDynamics(Math.floor(Math.random() * 1e9));
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let resolutionScale = 1;
      let useBloom = true;
      let slowFrames = 0;
      let last = performance.now();
      let raf = 0;
      let visible = document.visibilityState === "visible";
      let onScreen = true;
      let shown = false;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2) * resolutionScale;
        const width = Math.max(2, host.clientWidth);
        const height = Math.max(2, host.clientHeight);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        composer.setPixelRatio(dpr);
        composer.setSize(width, height);
        // Bloom at half resolution: it is a soft glow, so this costs nothing visible.
        bloom.resolution.set((width * dpr) / 2, (height * dpr) / 2);
        camera.aspect = width / height;
        // Keep the figure's width in view on narrow stages.
        const fit = Math.max(1, 3 / 4 / camera.aspect);
        camera.position.set(0, 1.21, 3.1 * Math.min(fit, 1.6));
        camera.updateProjectionMatrix();
      };
      resize();
      const resizeObserver =
        typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
      resizeObserver?.observe(host);

      const draw = (now: number) => {
        raf = requestAnimationFrame(draw);
        if (!visible || !onScreen) {
          last = now;
          return;
        }
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        // Hold ~40 fps on weak devices: drop the glow first, then resolution.
        if (dt > 0.026) slowFrames += 1;
        else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames > 40) {
          slowFrames = 0;
          if (useBloom) {
            useBloom = false;
            halo.visible = true;
          } else if (resolutionScale > 0.6) {
            resolutionScale = Math.max(0.6, resolutionScale - 0.2);
            resize();
          }
        }

        const levels = levelsRef.current;
        apply(
          dynamics.step(dt, {
            input: levels.input,
            output: levels.output,
            mode: modeRef.current,
            reducedMotion: reducedMotion.matches,
          }),
        );
        if (useBloom) composer.render();
        else renderer.render(scene, camera);
        if (!shown) {
          shown = true;
          setReady(true);
        }
      };
      raf = requestAnimationFrame(draw);

      const onVisibility = () => {
        visible = document.visibilityState === "visible";
      };
      document.addEventListener("visibilitychange", onVisibility);
      const intersection =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(([entry]) => {
              onScreen = entry?.isIntersecting ?? true;
            });
      intersection?.observe(host);
      const onContextLost = (event: Event) => {
        event.preventDefault();
        cancelAnimationFrame(raf);
        setFallback(true);
      };
      canvas.addEventListener("webglcontextlost", onContextLost);

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", onVisibility);
        intersection?.disconnect();
        resizeObserver?.disconnect();
        canvas.removeEventListener("webglcontextlost", onContextLost);
        root.traverse((object) => {
          const mesh = object as InstanceType<typeof THREE.Mesh>;
          if (mesh.isMesh) mesh.geometry.dispose();
        });
        Object.values(materials).forEach((m) => m.dispose());
        halo.geometry.dispose();
        (halo.material as InstanceType<typeof THREE.Material>).dispose();
        haloTexture.dispose();
        composer.dispose();
        renderer.dispose();
        canvas.remove();
      };
      if (disposed) cleanup();
    })().catch((error) => {
      console.warn("Rita avatar unavailable, using the voice orb", error);
      if (!disposed) setFallback(true);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [fallback, levelsRef, background]);

  if (fallback) {
    return <VoiceOrb levelsRef={levelsRef} mode={mode} label={label} className={className} />;
  }

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label ?? "Rita"}
      className={`relative aspect-[3/4] transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"} ${className}`}
    />
  );
}
