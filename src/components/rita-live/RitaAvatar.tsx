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
  ivoryGlow: 0xfffdf8,
  ivoryGlowStrength: 0.520,
  rim: [1.0, 0.83, 0.52] as const,
  rimStrength: 2.200,
  exposure: 1.080,
  bloom: { strength: 0.800, radius: 0.550, threshold: 0.900 },
  /** Body turned to show the ponytail; the head turns back towards the viewer. */
  bodyYaw: 0.55,
  headYaw: -0.4,
};

/** The authored gesture targets were tuned for a 0.46 m arm; scaled to the model's arm. */
const REFERENCE_ARM = 0.46;
const REFERENCE_SHOULDER: Record<"L" | "R", Vec3> = { L: [0.086, 0.228, 0], R: [-0.086, 0.228, 0] };

const FLOW = ["Hips", "Spine", "Neck", "Head", "PonyA", "PonyB", "PonyC"] as const;
const BONES = [
  ...FLOW,
  "UpperArmL",
  "ForearmL",
  "HandL",
  "UpperArmR",
  "ForearmR",
  "HandR",
] as const;
type BoneName = (typeof BONES)[number];

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
      scene.add(new THREE.HemisphereLight(0xf4f4ff, 0x5a4a60, 0.500));
      const key = new THREE.DirectionalLight(0xfff6ea, 2.100);
      key.position.set(-1.2, 2.2, 2.4);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffe2b0, 0.800);
      fill.position.set(1.5, 0.6, 1.2);
      scene.add(fill);

      // Warm rim light baked into the material: brighter where the surface turns away from the viewer.
      const ivory = new THREE.MeshStandardMaterial({
        color: LOOK.ivory,
        emissive: LOOK.ivoryGlow,
        emissiveIntensity: LOOK.ivoryGlowStrength,
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
      });
      ivory.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
           float ritaRim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);
           totalEmissiveRadiance += vec3(${LOOK.rim.map((v) => v.toFixed(2)).join(", ")}) * ritaRim * ${LOOK.rimStrength.toFixed(2)};`,
        );
      };
      const materials: Record<string, InstanceType<typeof THREE.Material>> = {
        Ivory: ivory,
        Eye: new THREE.MeshStandardMaterial({ color: 0x120d0e, roughness: 0.25, metalness: 0 }),
        Mouth: new THREE.MeshStandardMaterial({
          color: 0x7a3e34,
          roughness: 0.6,
          side: THREE.DoubleSide,
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
      halo.scale.set(1.0, 1.8, 1);
      halo.position.set(0, 1.1, -0.4);
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
        mesh.frustumCulled = false;
      });
      scene.add(root);
      root.updateMatrixWorld(true);

      const bone = {} as Record<BoneName, InstanceType<typeof THREE.Bone>>;
      for (const name of BONES) {
        const found = root.getObjectByName(name) as InstanceType<typeof THREE.Bone> | undefined;
        if (!found) {
          console.warn("Rita avatar model is missing bone", name);
          renderer.dispose();
          if (!disposed) setFallback(true);
          return;
        }
        bone[name] = found;
      }
      const morphTargets = (name: string) =>
        root.getObjectByName(name) as InstanceType<typeof THREE.Mesh> | undefined;
      const mouth = morphTargets("Mouth");
      const eyes = [morphTargets("EyeL"), morphTargets("EyeR")];
      const index = (mesh: InstanceType<typeof THREE.Mesh> | undefined, key: string) =>
        mesh?.morphTargetDictionary?.[key];
      const mouthKeys = {
        open: index(mouth, "Open"),
        wide: index(mouth, "Wide"),
        round: index(mouth, "Round"),
        smile: index(mouth, "Smile"),
      };
      for (const mesh of [mouth, ...eyes]) mesh?.morphTargetInfluences?.fill(0);

      // Rest data. Poses are written as rotations about the world axes on top of the rest
      // orientation, so the model's own bone roll never matters.
      const restWorld = {} as Record<BoneName, InstanceType<typeof THREE.Quaternion>>;
      const restPosition = {} as Record<BoneName, InstanceType<typeof THREE.Vector3>>;
      const parentWorld = {} as Record<BoneName, InstanceType<typeof THREE.Quaternion>>;
      for (const name of BONES) {
        restWorld[name] = bone[name].getWorldQuaternion(new THREE.Quaternion());
        restPosition[name] = bone[name].getWorldPosition(new THREE.Vector3());
        parentWorld[name] = bone[name].parent!.getWorldQuaternion(new THREE.Quaternion());
      }
      const upperLength = restPosition.ForearmL.distanceTo(restPosition.UpperArmL);
      const foreLength = restPosition.HandL.distanceTo(restPosition.ForearmL);
      const reach = (upperLength + foreLength) / REFERENCE_ARM;

      const parentOf = (name: BoneName): BoneName | null => {
        const parent = bone[name].parent as InstanceType<typeof THREE.Object3D> | null;
        return parent && BONES.includes(parent.name as BoneName) ? (parent.name as BoneName) : null;
      };
      const world = {} as Record<BoneName, InstanceType<typeof THREE.Quaternion>>;
      const place = (name: BoneName, worldQuaternion: InstanceType<typeof THREE.Quaternion>) => {
        const parent = parentOf(name);
        const parentQuaternion = parent ? world[parent] : parentWorld[name];
        bone[name].quaternion.copy(parentQuaternion).invert().multiply(worldQuaternion);
        world[name] = worldQuaternion;
      };

      const scratch = {
        q: new THREE.Quaternion(),
        e: new THREE.Euler(),
        a: new THREE.Vector3(),
        b: new THREE.Vector3(),
        c: new THREE.Vector3(),
        d: new THREE.Vector3(),
        pole: new THREE.Vector3(),
        elbow: new THREE.Vector3(),
        shoulder: new THREE.Vector3(),
      };
      const euler = (r: Vec3, extraY = 0) => {
        scratch.e.set(r[0], r[1] + extraY, r[2]);
        return new THREE.Quaternion().setFromEuler(scratch.e);
      };
      const restDirection = (from: BoneName, to: BoneName) =>
        new THREE.Vector3().subVectors(restPosition[to], restPosition[from]).normalize();
      const armRest = {
        L: {
          upper: restDirection("UpperArmL", "ForearmL"),
          fore: restDirection("ForearmL", "HandL"),
        },
        R: {
          upper: restDirection("UpperArmR", "ForearmR"),
          fore: restDirection("ForearmR", "HandR"),
        },
      };

      const apply = (pose: AvatarPose) => {
        // 1) Trunk, head and ponytail: cumulative rotations about the world axes.
        const cumulative = {} as Record<
          (typeof FLOW)[number],
          InstanceType<typeof THREE.Quaternion>
        >;
        const local: Record<(typeof FLOW)[number], InstanceType<typeof THREE.Quaternion>> = {
          Hips: euler(pose.hips),
          Spine: euler(pose.chest),
          Neck: euler(pose.neck, LOOK.headYaw * 0.35),
          Head: euler(pose.head, LOOK.headYaw * 0.65),
          PonyA: euler(pose.pony1),
          PonyB: euler(pose.pony2),
          PonyC: euler([pose.pony2[0] * 1.3, pose.pony2[1] * 1.3, pose.pony2[2] * 1.3]),
        };
        for (const name of FLOW) {
          const parent = parentOf(name) as (typeof FLOW)[number] | null;
          cumulative[name] = (
            parent ? cumulative[parent].clone() : new THREE.Quaternion()
          ).multiply(local[name]);
          place(name, cumulative[name].clone().multiply(restWorld[name]));
        }
        root.position.y = pose.root.y;

        // 2) Arms: two-bone IK towards the hand target, in the leaning chest's frame.
        const chest = cumulative.Spine;
        root.updateMatrixWorld(true);
        for (const side of ["L", "R"] as const) {
          const upperName = `UpperArm${side}` as const;
          const foreName = `Forearm${side}` as const;
          const handName = `Hand${side}` as const;
          const hand = side === "L" ? pose.left : pose.right;

          // Shoulder in the model's own frame (the scene is yawed and lifted as a whole).
          const shoulderLocal = root.worldToLocal(
            bone[upperName].getWorldPosition(scratch.shoulder),
          );
          const ref = REFERENCE_SHOULDER[side];
          scratch.a
            .set(hand.target[0] - ref[0], hand.target[1] - ref[1], hand.target[2] - ref[2])
            .multiplyScalar(reach)
            .applyQuaternion(chest);
          const target = shoulderLocal.clone().add(scratch.a);
          scratch.pole
            .set(hand.pole[0] - ref[0], hand.pole[1] - ref[1], hand.pole[2] - ref[2])
            .applyQuaternion(chest)
            .normalize();

          const direction = target.clone().sub(shoulderLocal);
          const distance = Math.min(
            Math.max(direction.length(), Math.abs(upperLength - foreLength) + 1e-4),
            upperLength + foreLength - 1e-4,
          );
          direction.normalize();
          const along =
            (upperLength * upperLength - foreLength * foreLength + distance * distance) /
            (2 * distance);
          const height = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
          scratch.b.copy(scratch.pole).addScaledVector(direction, -scratch.pole.dot(direction));
          if (scratch.b.lengthSq() < 1e-8) scratch.b.set(0, 0, -1);
          scratch.b.normalize();
          scratch.elbow
            .copy(shoulderLocal)
            .addScaledVector(direction, along)
            .addScaledVector(scratch.b, height);
          scratch.c.copy(scratch.elbow).sub(shoulderLocal).normalize(); // upper arm direction
          scratch.d
            .copy(shoulderLocal)
            .addScaledVector(direction, distance)
            .sub(scratch.elbow)
            .normalize(); // forearm direction

          const upperDelta = new THREE.Quaternion().setFromUnitVectors(
            armRest[side].upper,
            scratch.c,
          );
          const foreDelta = new THREE.Quaternion().setFromUnitVectors(
            armRest[side].fore,
            scratch.d,
          );
          place(upperName, upperDelta.clone().multiply(restWorld[upperName]));
          place(foreName, foreDelta.clone().multiply(restWorld[foreName]));
          place(handName, euler(hand.wrist).multiply(foreDelta).multiply(restWorld[handName]));
        }

        // 3) Face: eyes blink, the mouth morphs with the voice.
        for (const eye of eyes) {
          if (eye?.morphTargetInfluences) eye.morphTargetInfluences[0] = pose.blink;
        }
        const influences = mouth?.morphTargetInfluences;
        if (influences) {
          if (mouthKeys.open !== undefined) influences[mouthKeys.open] = pose.mouth.open;
          if (mouthKeys.wide !== undefined) influences[mouthKeys.wide] = pose.mouth.wide;
          if (mouthKeys.round !== undefined) influences[mouthKeys.round] = pose.mouth.round;
          if (mouthKeys.smile !== undefined)
            influences[mouthKeys.smile] = pose.mouth.smile * (1 - pose.mouth.open);
        }
      };
      root.rotation.y = LOOK.bodyYaw;

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
        // Frame from the hips up; back off on narrow stages so the arms stay in view.
        const fit = Math.max(1, 3 / 4 / camera.aspect);
        camera.position.set(0, 1.3, 2.5 * Math.min(fit, 1.6));
        camera.lookAt(0, 1.24, 0);
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
