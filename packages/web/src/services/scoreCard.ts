import type { HuntSession } from '@ftp/shared';
import { scoreStep, stepStars } from '@ftp/shared';
import { formatDuration } from '../ui/Timer.js';

const W = 600;
const PAD = 36;
const CORAL = '#ff7a59';
const INK = '#2b2440';
const INK_SOFT = '#6b6480';
const CREAM = '#fff7f0';
const YELLOW = '#ffd23f';
const LINE = '#ece4f3';

function font(weight: number, size: number): string {
  return `${weight} ${size}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas toBlob failed'))), 'image/png');
  });
}

/** Render a score-card PNG and share/download it. */
export async function shareScore(
  routeTitle: string,
  session: HuntSession,
  itemNames: Map<string, string>,
  playUrl: string,
): Promise<void> {
  // Let Baloo 2 finish loading before we draw (it's already in the page).
  await document.fonts.ready;

  const itemRows = session.steps.map((step) => ({
    name: itemNames.get(step.itemId) ?? 'Item',
    stars: stepStars(step),
    score: scoreStep(step),
    skipped: step.status === 'skipped',
  }));

  const totalSec =
    session.finishedAt
      ? (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
      : undefined;

  // Calculate canvas height dynamically.
  const headerH = 70;
  const summaryH = 120;
  const rowH = 48;
  const footerH = 56;
  const H = headerH + summaryH + itemRows.length * rowH + PAD + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // Header bar
  ctx.fillStyle = CORAL;
  ctx.fillRect(0, 0, W, headerH);
  ctx.font = font(800, 22);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText('📸  Find the Photos', PAD, headerH / 2);

  // Trophy + route title
  let y = headerH + PAD;
  ctx.font = font(800, 28);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.fillText(`🏆  ${routeTitle}`, PAD, y);
  y += 38;

  // Score pill
  const scoreText = `${session.totalScore} pts`;
  ctx.font = font(800, 20);
  const sw = ctx.measureText(scoreText).width;
  const pillW = sw + 32;
  const pillH = 36;
  ctx.fillStyle = YELLOW;
  roundRect(ctx, PAD, y, pillW, pillH, 999);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(scoreText, PAD + 16, y + pillH / 2);
  y += pillH + 10;

  // Total time
  if (totalSec !== undefined) {
    ctx.font = font(500, 16);
    ctx.fillStyle = INK_SOFT;
    ctx.textBaseline = 'top';
    ctx.fillText(`⏱  ${formatDuration(totalSec)}`, PAD, y);
    y += 28;
  }

  // Divider
  y += 12;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 16;

  // Item rows
  for (const row of itemRows) {
    ctx.font = font(600, 16);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'middle';
    const mid = y + rowH / 2;

    // Name
    ctx.fillText(row.name, PAD, mid);

    // Stars or skipped
    const starStr = row.skipped ? 'skipped' : '⭐'.repeat(row.stars) || '—';
    ctx.font = font(500, 15);
    ctx.fillStyle = INK_SOFT;
    const starX = W / 2;
    ctx.fillText(starStr, starX, mid);

    // Score
    ctx.font = font(700, 16);
    ctx.fillStyle = row.skipped ? INK_SOFT : CORAL;
    const sc = `${row.score} pts`;
    const scW = ctx.measureText(sc).width;
    ctx.fillText(sc, W - PAD - scW, mid);

    // Row separator
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y + rowH);
    ctx.lineTo(W - PAD, y + rowH);
    ctx.stroke();

    y += rowH;
  }

  // Footer: play URL
  y += PAD / 2;
  ctx.font = font(500, 13);
  ctx.fillStyle = INK_SOFT;
  ctx.textBaseline = 'top';
  ctx.fillText(`Play at: ${playUrl}`, PAD, y);

  // Share or download
  const blob = await toBlob(canvas);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
