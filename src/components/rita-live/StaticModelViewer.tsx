import { useEffect, useRef, useState } from "react";
import modelUrl from "@/assets/rita-wanderer.glb?url";

type Props = {
  className?: string;
  /** Stage colour behind the figure. The glow is composited against it. */
  background?: string;
  label?: string;
};

/** Lit like the Meshy preview: soft warm light from the front, glow from the emissive map. */
const LOOK = {
  exposure: 0.95,
  hemisphere: { sky: 0xfff1e0, ground: 0x4a4350, intensity: 0.7 },
  key: { color: 0xfff0dd, intensity: 2.6, position: [0.6, 1.6, 3.2] as const },
  fill: { color: 0xffe6cc, intensity: 0.6, position: [-1.6, 0.4, 1.4] as const },
  bloom: { strength: 0.45, radius: 0.35, threshold: 0.92 },
  fov: 22,
  /** Fraction of the height left empty around the figure. */
  margin: 1.28,
};

/**
 * A still 3D figure. It never animates and is not tied to the voice session:
 * one frame is drawn when the model loads and again when the box is resized.
 * three.js and the model load on demand; if WebGL or the file is unavailable
 * the box stays empty and the page works as before.
 */
export function StaticModelViewer({
  className = "",
  background = "#121117",
  label = "Rita",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      try {
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
        canvas.style.cssText = "display:block;width:100%;height:100%";
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = LOOK.exposure;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(background);
        const camera = new THREE.PerspectiveCamera(LOOK.fov, 1, 0.05, 30);
        scene.add(
          new THREE.HemisphereLight(
            LOOK.hemisphere.sky,
            LOOK.hemisphere.ground,
            LOOK.hemisphere.intensity,
          ),
        );
        const key = new THREE.DirectionalLight(LOOK.key.color, LOOK.key.intensity);
        key.position.set(...LOOK.key.position);
        scene.add(key);
        const fill = new THREE.DirectionalLight(LOOK.fill.color, LOOK.fill.intensity);
        fill.position.set(...LOOK.fill.position);
        scene.add(fill);

        const gltf = await new GLTFLoader().loadAsync(modelUrl);
        if (disposed) {
          renderer.dispose();
          return;
        }
        const model = gltf.scene;
        scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        model.position.sub(centre);

        const composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(1, 1),
          LOOK.bloom.strength,
          LOOK.bloom.radius,
          LOOK.bloom.threshold,
        );
        composer.addPass(bloom);
        composer.addPass(new OutputPass());

        const draw = () => {
          if (disposed) return;
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          renderer.setPixelRatio(pixelRatio);
          renderer.setSize(width, height, false);
          composer.setPixelRatio(pixelRatio);
          composer.setSize(width, height);
          camera.aspect = width / height;
          // Distance that fits the whole figure, by height and by width, with a margin.
          const halfFov = THREE.MathUtils.degToRad(LOOK.fov / 2);
          const fitHeight = (size.y * LOOK.margin) / 2 / Math.tan(halfFov);
          const fitWidth = (size.x * LOOK.margin) / 2 / (Math.tan(halfFov) * camera.aspect);
          const distance = Math.max(fitHeight, fitWidth) + size.z / 2;
          camera.position.set(0, 0, distance);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
          composer.render();
        };

        host.appendChild(canvas);
        draw();
        setReady(true);

        const observer = new ResizeObserver(draw);
        observer.observe(host);
        const onLost = (event: Event) => event.preventDefault();
        const onRestored = () => draw();
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);

        cleanup = () => {
          observer.disconnect();
          canvas.removeEventListener("webglcontextlost", onLost);
          canvas.removeEventListener("webglcontextrestored", onRestored);
          scene.traverse((object) => {
            const mesh = object as InstanceType<typeof THREE.Mesh>;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
              for (const value of Object.values(material)) {
                if (value && (value as { isTexture?: boolean }).isTexture)
                  (value as InstanceType<typeof THREE.Texture>).dispose();
              }
              material.dispose();
            }
          });
          composer.dispose();
          renderer.dispose();
          canvas.remove();
        };
      } catch (error) {
        // No WebGL or the file did not load: leave the box empty.
        console.warn("Static model unavailable", error);
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [background]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      className={className}
      style={{ background, opacity: ready ? 1 : 0.6, transition: "opacity 0.4s ease" }}
    />
  );
}
