import screenAsset from "@/assets/home-ipad-restored.webp.asset.json";
import { EditableImage } from "@/components/site/EditableImage";

/**
 * A photoreal horizontal iPad Pro shell, deliberately cropped by the top of
 * the page: roughly the upper third of the device sits above the viewport and
 * is clipped away. The artwork is placed inside the *visible* band only, so the
 * picture always fills what you can see instead of disappearing behind the cut.
 */
export function IpadStage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="relative mx-auto w-full max-w-[1100px] px-4 md:px-10">
        {/* Negative top margin pushes about a third of the device off-screen. */}
        <div className="-mt-[20%] md:-mt-[22%]">
          <div
            className="relative mx-auto rounded-[2rem] p-[9px] md:rounded-[2.5rem] md:p-[11px]"
            style={{
              background:
                "linear-gradient(148deg,#8f959c 0%,#4b5157 12%,#22262a 34%,#1b1e21 62%,#3d4247 88%,#7e848b 100%)",
              boxShadow:
                "0 2px 0 rgba(255,255,255,.18) inset, 0 -2px 0 rgba(0,0,0,.35) inset",
            }}
          >
          {/* Bottom button (landscape bottom edge) */}
          <span
            aria-hidden
            className="absolute -bottom-[3px] left-[42%] h-[3px] w-14 rounded-b-sm md:w-20"
            style={{ background: "linear-gradient(0deg,#6d7379,#2a2e32)" }}
          />

          {/* Screen — landscape tablet panel; artwork fills the visible band */}
          <div className="relative aspect-[16/11.6] overflow-hidden rounded-[1.8rem] bg-black md:rounded-[2.3rem]">
            <EditableImage
              imageKey="home.ipad"
              fallback={screenAsset.url}
              alt="A student reading in a green forest lit by fireflies, shown on an iPad screen"
              className="absolute inset-x-0 bottom-0 top-[32%] w-full object-cover object-center"
              width={1280}
              height={800}
              loading="eager"
              fetchPriority="high"
            />

            {/* Glass sheen across the panel */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(118deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 34%,rgba(255,255,255,0) 66%,rgba(255,255,255,.07) 100%)",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[1.8rem] md:rounded-[2.3rem]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.10) inset" }}
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
