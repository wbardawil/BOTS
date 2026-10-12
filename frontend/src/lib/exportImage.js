import { toPng } from "html-to-image";

const slug = (s) => String(s || "export").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const today = () => new Date().toISOString().slice(0, 10);

/** "Company · Borrador · 12/10/2026": the line stamped under every exported image. */
export const stampLine = (org, version) => `${org?.name || ""} · ${version === "published" ? "Publicado" : "Borrador"} · ${new Date().toLocaleDateString("es-MX")}`;
export const exportName = (org, what) => `${slug(org?.name)}-${what}-${today()}.png`;

/**
 * Render a DOM node to a PNG and download it, with a stamp line drawn under the image.
 * `style` overrides styles on the captured clone (used to undo the canvas pan/zoom transform);
 * `width`/`height` set the capture area when the node's children extend beyond its box.
 * Nodes marked data-noexport are left out (toolbars, hints).
 */
export async function exportNodeToPng(node, filename, { stamp, pixelRatio = 2, width, height, style } = {}) {
  if (!node) throw new Error("Nothing to export");
  const dataUrl = await toPng(node, {
    pixelRatio, backgroundColor: "#ffffff", cacheBust: true, width, height, style,
    filter: (n) => !(n.dataset && n.dataset.noexport !== undefined),
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const pad = stamp ? Math.round(30 * pixelRatio) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = img.width; canvas.height = img.height + pad;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  if (stamp) {
    ctx.fillStyle = "#6b7280";
    ctx.font = `${Math.round(12 * pixelRatio)}px Inter, ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(stamp, Math.round(16 * pixelRatio), img.height + pad / 2);
  }
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  return { width: canvas.width, height: canvas.height };
}
