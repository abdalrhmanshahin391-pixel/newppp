// «Download» on Uzyra's board: the open section's drawing, fully drawn, as a PNG on the board's
// light blue, with its title on top. The drawing is the board's own SVG; the Arabic face is
// embedded so the picture looks like the screen. If the browser will not turn the SVG into a
// picture, the SVG itself is downloaded instead.
const SVG_NS = "http://www.w3.org/2000/svg";
const FONT = "/fonts/arabic/graphik-arabic-400.woff2";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function fontData() {
  try {
    const blob = await (await fetch(FONT)).blob();
    return await new Promise<string>((done, fail) => {
      const reader = new FileReader();
      reader.onload = () => done(String(reader.result));
      reader.onerror = () => fail(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export async function downloadBoard(section: HTMLElement | null, title: string) {
  const svg = section?.querySelector<SVGSVGElement>(".wb-drawing");
  if (!svg) return;
  const box = svg.viewBox.baseVal;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Everything drawn: no pen, every word fully revealed, every stroke whole.
  clone.querySelector("[data-nib]")?.remove();
  clone.querySelectorAll("rect[data-mask]").forEach((rect) => {
    rect.setAttribute("x", "-2000");
    rect.setAttribute("width", "6000");
  });
  clone.querySelectorAll<SVGPathElement>("path[data-line]").forEach((path) => {
    if (path.getAttribute("stroke") !== "none") path.removeAttribute("style");
  });
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  const font = await fontData();
  const style = document.createElementNS(SVG_NS, "style");
  style.textContent =
    (font ? `@font-face{font-family:"Uzyra Arabic";src:url(${font}) format("woff2")}` : "") +
    `text{font-family:"Uzyra Arabic",sans-serif}`;
  clone.prepend(style);
  const markup = new XMLSerializer().serializeToString(clone);
  const name = "uzyra-board";

  try {
    const picture = new Image();
    picture.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    await picture.decode();
    const pad = 48;
    const head = title ? 64 : 8;
    const scale = 2;
    const width = box.width + pad * 2;
    const height = box.height + pad * 2 + head;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.scale(scale, scale);
    const sky = ctx.createRadialGradient(
      width / 2,
      height * 0.6,
      0,
      width / 2,
      height * 0.6,
      width * 0.75,
    );
    sky.addColorStop(0, "#edf4fd");
    sky.addColorStop(0.6, "#dce7f7");
    sky.addColorStop(1, "#c9d9f2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    if (title) {
      const rtl = /[؀-ۿ]/.test(title);
      ctx.direction = rtl ? "rtl" : "ltr";
      ctx.textAlign = rtl ? "right" : "left";
      ctx.fillStyle = "#2f3440";
      ctx.font = '500 26px "Uzyra Arabic", "Google Sans Flex", sans-serif';
      ctx.fillText(title, rtl ? width - pad : pad, pad + 26, width - pad * 2);
    }
    ctx.drawImage(picture, pad, pad + head, box.width, box.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (!blob) throw new Error("no picture");
    save(blob, `${name}.png`);
  } catch {
    save(new Blob([markup], { type: "image/svg+xml" }), `${name}.svg`);
  }
}
