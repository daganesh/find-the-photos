import type { HuntSession, Team, TeamResult } from '@ftp/shared';
import { scoreStep } from '@ftp/shared';
import { formatDuration } from '../ui/Timer.js';
import { mediaUrl } from './media.js';

// ── Layout constants ───────────────────────────────────────────────────────

const CANVAS_W = 1080;
const CANVAS_MARGIN = 60;
const GRID_W = CANVAS_W - 2 * CANVAS_MARGIN;
const HEADER_H = 90;
const FOOTER_H = 44;

// Polaroid frame proportions
const FRAME_TOP = 10;
const FRAME_SIDE = 10;
const FRAME_BOTTOM = 52;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random [0..1) from an integer seed. */
function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 8000);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  );
}

// ── Polaroid drawing ───────────────────────────────────────────────────────

interface PolaroidSpec {
  cx: number; cy: number;
  rotation: number; tx: number; ty: number;
  photoOX: number; photoOY: number;
  photoImg: HTMLImageElement | null;
  logoImg: HTMLImageElement | null;
  name: string;
  status: 'found' | 'skipped';
  seed: number;
  polaroidW: number; polaroidH: number;
  photoW: number; photoH: number;
}

function drawPolaroid(ctx: CanvasRenderingContext2D, p: PolaroidSpec) {
  const { cx, cy, rotation, tx, ty, photoOX, photoOY,
          photoImg, logoImg, name, status, seed,
          polaroidW, polaroidH, photoW, photoH } = p;

  const halfW = polaroidW / 2;
  const halfH = polaroidH / 2;

  ctx.save();
  ctx.translate(cx + tx, cy + ty);
  ctx.rotate(rotation);

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;

  // White Polaroid frame
  ctx.fillStyle = '#fafaf8';
  ctx.fillRect(-halfW, -halfH, polaroidW, polaroidH);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Photo area
  const photoLeft = -halfW + FRAME_SIDE;
  const photoTop  = -halfH + FRAME_TOP;

  ctx.save();
  ctx.beginPath();
  ctx.rect(photoLeft, photoTop, photoW, photoH);
  ctx.clip();

  const img = photoImg ?? logoImg;
  if (img) {
    ctx.drawImage(img, photoLeft + photoOX, photoTop + photoOY, photoW, photoH);
  } else {
    ctx.fillStyle = '#2d1f42';
    ctx.fillRect(photoLeft, photoTop, photoW, photoH);
    ctx.font = `${Math.round(photoH * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📸', photoLeft + photoW / 2, photoTop + photoH / 2);
  }

  // Warm film tint (multiply avoids canvas taint)
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255, 210, 165, 0.13)';
  ctx.fillRect(photoLeft, photoTop, photoW, photoH);
  ctx.globalCompositeOperation = 'source-over';

  // Vignette
  const vg = ctx.createRadialGradient(
    photoLeft + photoW / 2, photoTop + photoH / 2, photoH * 0.18,
    photoLeft + photoW / 2, photoTop + photoH / 2, photoH * 0.8,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg;
  ctx.fillRect(photoLeft, photoTop, photoW, photoH);

  // Film grain (lightweight; no pixel access = no canvas taint)
  for (let g = 0; g < 120; g++) {
    const gx = photoLeft + Math.random() * photoW;
    const gy = photoTop  + Math.random() * photoH;
    const alpha = Math.random() * 0.065;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${alpha})`
      : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }

  ctx.restore(); // end photo clip

  // Item name (Caveat handwriting font)
  const labelY = -halfH + FRAME_TOP + photoH + FRAME_BOTTOM / 2;
  const fontSize = Math.max(14, Math.round(polaroidW * 0.074));
  ctx.font = `700 ${fontSize}px 'Caveat', cursive`;
  ctx.fillStyle = '#2b2440';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 0, labelY, polaroidW - 20);

  // Stamp (upper-right of photo)
  drawStamp(ctx, photoLeft + photoW - 26, photoTop + 26, status, seed);

  ctx.restore();
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  status: 'found' | 'skipped',
  seed: number,
) {
  const color  = status === 'found' ? '#27ae60' : '#c0392b';
  const symbol = status === 'found' ? '✓' : '✗';
  const tilt = (sr(seed * 13 + 7) - 0.5) * 0.45;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  const r = 18;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color + '28';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.72;
  ctx.stroke();

  ctx.font = `bold ${r + 2}px "Baloo 2", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 0, 0);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a scattered-polaroid score card and return it as a PNG Blob.
 * Works for both solo and team sessions; team/teamResult are accepted for
 * compatibility but the layout is photo-first in either case.
 */
export async function renderScoreCard(
  routeTitle: string,
  session: HuntSession,
  itemNames: Map<string, string>,
  playUrl: string,
  team?: Team,
  _teamResult?: TeamResult,
  itemPhotos?: Map<string, string>,
): Promise<Blob> {
  await document.fonts.ready;

  const steps = session.steps;
  const N = steps.length;
  if (N === 0) throw new Error('No steps to render');

  const COLS = Math.min(3, Math.max(1, N));
  const ROWS = Math.ceil(N / COLS);

  const cellW = GRID_W / COLS;
  const polaroidW = Math.min(320, cellW - 44);
  const photoW = polaroidW - 2 * FRAME_SIDE;
  const photoH = Math.round(photoW * 0.86);
  const polaroidH = photoH + FRAME_TOP + FRAME_BOTTOM;
  const cellH = polaroidH + 56;

  const CANVAS_H = HEADER_H + ROWS * cellH + FOOTER_H;

  // Load images
  const logoImg = await loadImg('/logo.jpg');
  const photoImgs = await Promise.all(
    steps.map((s) => {
      const refUrl = itemPhotos?.get(s.itemId);
      if (refUrl) return loadImg(mediaUrl(refUrl));
      const url = s.photoAttempts.at(-1)?.photoUrl ?? null;
      return url ? loadImg(mediaUrl(url)) : Promise.resolve(null);
    }),
  );

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  // Dark background
  ctx.fillStyle = '#190f2b';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Background grain
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.018})`;
    ctx.fillRect(Math.random() * CANVAS_W, Math.random() * CANVAS_H, 1, 1);
  }

  // Header
  const totalSec = session.finishedAt
    ? (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
    : undefined;

  ctx.textBaseline = 'top';

  ctx.font = `600 18px "Baloo 2", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('📸 Find the Photos', CANVAS_MARGIN, 18);

  const headerLabel = team ? team.name : routeTitle;
  ctx.font = `800 28px "Baloo 2", sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(headerLabel, CANVAS_W / 2, 16, GRID_W - 160);

  ctx.textAlign = 'right';
  ctx.font = `800 18px "Baloo 2", sans-serif`;
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(`${session.totalScore} pts`, CANVAS_W - CANVAS_MARGIN, 16);

  if (totalSec !== undefined) {
    ctx.font = `500 14px "Baloo 2", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(`⏱ ${formatDuration(totalSec)}`, CANVAS_W - CANVAS_MARGIN, 40);
  }

  // Polaroid grid
  const specs: PolaroidSpec[] = steps.map((step, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = CANVAS_MARGIN + col * cellW + cellW / 2;
    const cy = HEADER_H + row * cellH + cellH / 2;

    return {
      cx, cy,
      rotation: (sr(i * 5 + 0) - 0.5) * (10 * Math.PI / 180),
      tx: (sr(i * 5 + 1) - 0.5) * 22,
      ty: (sr(i * 5 + 2) - 0.5) * 22,
      photoOX: (sr(i * 5 + 3) - 0.5) * 6,
      photoOY: (sr(i * 5 + 4) - 0.5) * 5,
      photoImg: photoImgs[i] ?? null,
      logoImg,
      name: itemNames.get(step.itemId) ?? 'Item',
      status: step.status === 'found' ? 'found' : 'skipped',
      seed: sr(i * 7 + 11) * 1000,
      polaroidW, polaroidH, photoW, photoH,
    };
  });

  // Shuffle draw order so polaroids overlap naturally
  const drawOrder = [...specs].sort((a, b) => a.seed - b.seed);
  for (const spec of drawOrder) {
    drawPolaroid(ctx, spec);
  }

  // Footer
  ctx.font = `500 13px "Baloo 2", sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Play at: ${playUrl}`, CANVAS_W / 2, CANVAS_H - 12);

  return canvasToBlob(canvas);
}

/** Render the score card then immediately share or download it. */
export async function shareScore(
  routeTitle: string,
  session: HuntSession,
  itemNames: Map<string, string>,
  playUrl: string,
  team?: Team,
  teamResult?: TeamResult,
  itemPhotos?: Map<string, string>,
): Promise<void> {
  const blob = await renderScoreCard(routeTitle, session, itemNames, playUrl, team, teamResult, itemPhotos);
  const file = new File([blob], 'hunt-score.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `I scored ${session.totalScore} pts on "${routeTitle}"!` });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hunt-score.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

