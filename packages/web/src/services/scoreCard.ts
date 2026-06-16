import type { HuntSession, Team, TeamResult } from '@ftp/shared';
import { findBestBlooper, scoreStep, stepStars } from '@ftp/shared';
import { formatDuration } from '../ui/Timer.js';
import { mediaUrl } from './media.js';

// ── Design tokens ──────────────────────────────────────────────────────────
const CARD_W = 580;
const CARD_PAD = 24;
const PHOTO_BORDER = 6;   // white border around each mini-photo
const BOTTOM_BAR = 90;    // the wide white polaroid "caption" strip
const TEAL = '#5cc8c4';
const INK = '#2b2440';
const INK_SOFT = '#6b6480';
const WHITE = '#ffffff';
const YELLOW = '#ffd23f';
const BG = '#d9f4f3';     // outer background (very light teal)

function font(weight: number, size: number): string {
  return `${weight} ${size}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas toBlob failed'))), 'image/png'),
  );
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // missing photo → skip gracefully
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/** Draw a cover-image strip (or a placeholder gradient). */
function drawCoverStrip(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  if (img) {
    // Crop to fill, centered.
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    // Placeholder gradient.
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#b2e8e7');
    grad.addColorStop(1, '#5cc8c4');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.font = font(700, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📸', x + w / 2, y + h / 2);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

/** Draw a grid of found-item photos. Returns the y position after the grid. */
async function drawPhotoGrid(
  ctx: CanvasRenderingContext2D,
  session: HuntSession,
  itemNames: Map<string, string>,
  startX: number,
  startY: number,
  availableW: number,
): Promise<number> {
  const COLS = 3;
  const GAP = 8;
  const cellW = (availableW - GAP * (COLS - 1)) / COLS;
  const cellH = cellW * 0.75;
  const labelH = 20;
  const cellTotalH = cellH + labelH + PHOTO_BORDER * 2 + GAP;

  const foundSteps = session.steps.filter((s) => s.status === 'found' || s.status === 'skipped');
  if (foundSteps.length === 0) return startY;

  const rows = Math.ceil(foundSteps.length / COLS);
  let y = startY;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      if (idx >= foundSteps.length) break;
      const step = foundSteps[idx]!;
      const x = startX + col * (cellW + GAP);

      // Mini-polaroid white background.
      ctx.fillStyle = WHITE;
      roundRect(ctx, x, y, cellW + PHOTO_BORDER * 2, cellH + PHOTO_BORDER * 2 + labelH, 3);
      ctx.fill();

      // Photo (the last matching attempt, or last attempt).
      const matching = step.photoAttempts.filter((a) => a.verdict.match);
      const matchAttempt = matching[matching.length - 1];
      const photoAttempt = matchAttempt ?? step.photoAttempts[step.photoAttempts.length - 1];
      if (photoAttempt) {
        const img = await loadImage(mediaUrl(photoAttempt.photoUrl));
        drawCoverStrip(ctx, img, x + PHOTO_BORDER, y + PHOTO_BORDER, cellW, cellH);
      } else {
        // Skipped item — show placeholder.
        ctx.fillStyle = BG;
        ctx.fillRect(x + PHOTO_BORDER, y + PHOTO_BORDER, cellW, cellH);
        ctx.font = font(400, 20);
        ctx.fillStyle = INK_SOFT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⏭', x + PHOTO_BORDER + cellW / 2, y + PHOTO_BORDER + cellH / 2);
        ctx.textAlign = 'left';
      }

      // Label beneath photo (item name + stars or "skipped").
      ctx.font = font(600, 10);
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = (itemNames.get(step.itemId) ?? 'Item').slice(0, 14);
      const stars = step.status === 'skipped' ? '⏭' : '⭐'.repeat(stepStars(step));
      ctx.fillText(`${name} ${stars}`, x + PHOTO_BORDER + cellW / 2, y + PHOTO_BORDER + cellH + labelH / 2);
      ctx.textAlign = 'left';
    }
    y += cellTotalH;
  }
  return y;
}

/** Draw the big polaroid card outline + drop shadow. Returns inner top-left. */
function drawPolaroidCard(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
): void {
  // Shadow.
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = WHITE;
  roundRect(ctx, cx, cy, w, h, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a polaroid-style score card and share/download it.
 * Works for both solo and team sessions.
 */
export async function shareScore(
  routeTitle: string,
  session: HuntSession,
  itemNames: Map<string, string>,
  playUrl: string,
  team?: Team,
  teamResult?: TeamResult,
): Promise<void> {
  await document.fonts.ready;

  const OUTER_PAD = 24; // padding around the polaroid card
  const INNER_PAD = CARD_PAD;
  const INNER_W = CARD_W - OUTER_PAD * 2 - INNER_PAD * 2; // usable content width inside card

  // Estimate photo grid height.
  const foundCount = session.steps.filter((s) => s.status !== 'locked').length;
  const COLS = 3;
  const cellW = (INNER_W - 8 * (COLS - 1)) / COLS;
  const cellH = cellW * 0.75;
  const rows = Math.ceil(foundCount / COLS);
  const gridH = rows * (cellH + 20 + PHOTO_BORDER * 2 + 8);

  // Estimate member score rows if team.
  const memberRowH = teamResult ? teamResult.memberScores.length * 24 + 32 : 0;

  // Blooper.
  const blooper = findBestBlooper(session);
  const blooperH = blooper ? 120 : 0;

  const HEADER_H = 56;
  const SUMMARY_H = 72;
  const CARD_H = OUTER_PAD + HEADER_H + INNER_PAD + SUMMARY_H + INNER_PAD + gridH + (memberRowH > 0 ? INNER_PAD + memberRowH : 0) + (blooperH > 0 ? INNER_PAD + blooperH : 0) + INNER_PAD + BOTTOM_BAR + OUTER_PAD;

  const TOTAL_H = CARD_H + OUTER_PAD * 2;
  const TOTAL_W = CARD_W;

  const canvas = document.createElement('canvas');
  canvas.width = TOTAL_W;
  canvas.height = TOTAL_H;
  const ctx = canvas.getContext('2d')!;

  // Outer background.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);

  // Decorative dot pattern.
  ctx.fillStyle = 'rgba(92,200,196,0.18)';
  for (let dx = 0; dx < TOTAL_W; dx += 18) {
    for (let dy = 0; dy < TOTAL_H; dy += 18) {
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Polaroid card.
  const cardX = OUTER_PAD;
  const cardY = OUTER_PAD;
  const cardW = TOTAL_W - OUTER_PAD * 2;
  drawPolaroidCard(ctx, cardX, cardY, cardW, CARD_H);

  // ── Header bar ──────────────────────────────────────────────────────────
  ctx.fillStyle = TEAL;
  roundRect(ctx, cardX, cardY, cardW, HEADER_H, 6);
  ctx.fill();
  // Flatten the bottom corners of the header.
  ctx.fillStyle = TEAL;
  ctx.fillRect(cardX, cardY + HEADER_H - 6, cardW, 6);

  ctx.font = font(800, 18);
  ctx.fillStyle = WHITE;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('📸  Find the Photos', cardX + INNER_PAD, cardY + HEADER_H / 2);

  // Route title (right side of header).
  ctx.font = font(600, 13);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  const titleTrunc = routeTitle.length > 28 ? routeTitle.slice(0, 27) + '…' : routeTitle;
  ctx.fillText(titleTrunc, cardX + cardW - INNER_PAD, cardY + HEADER_H / 2);
  ctx.textAlign = 'left';

  // ── Summary row ──────────────────────────────────────────────────────────
  let y = cardY + HEADER_H + INNER_PAD;
  const innerX = cardX + INNER_PAD;

  // Team/user name.
  const displayName = teamResult?.teamName ?? team?.name ?? 'Your score';
  ctx.font = font(800, 22);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'top';
  ctx.fillText(displayName, innerX, y);
  y += 30;

  // Score pill + time.
  const scoreText = `⭐ ${session.totalScore} pts`;
  ctx.font = font(800, 17);
  const sw = ctx.measureText(scoreText).width;
  const pillH = 30;
  ctx.fillStyle = YELLOW;
  roundRect(ctx, innerX, y, sw + 24, pillH, 999);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(scoreText, innerX + 12, y + pillH / 2);

  const totalSec = teamResult?.totalSeconds
    ?? (session.finishedAt
      ? (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000
      : undefined);
  if (totalSec !== undefined) {
    ctx.font = font(500, 14);
    ctx.fillStyle = INK_SOFT;
    ctx.textBaseline = 'middle';
    ctx.fillText(`⏱ ${formatDuration(totalSec)}`, innerX + sw + 24 + 12, y + pillH / 2);
  }
  y += pillH + INNER_PAD;

  // ── Photo grid ──────────────────────────────────────────────────────────
  y = await drawPhotoGrid(ctx, session, itemNames, innerX, y, INNER_W);
  y += INNER_PAD;

  // ── Member leaderboard (team mode) ───────────────────────────────────────
  if (teamResult && teamResult.memberScores.length > 0) {
    ctx.font = font(700, 14);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'top';
    ctx.fillText('Team', innerX, y);
    y += 20;

    for (const ms of teamResult.memberScores) {
      ctx.font = font(600, 13);
      ctx.fillStyle = INK;
      ctx.textBaseline = 'middle';
      const mid = y + 10;
      const isMvp = ms.userId === teamResult.mvpUserId && ms.itemsFound > 0;
      const emoji = ms.avatarEmoji ?? '🧑';
      ctx.fillText(`${emoji}  ${ms.name}${isMvp ? '  ⚡ MVP' : ''}`, innerX, mid);
      ctx.font = font(700, 13);
      ctx.fillStyle = TEAL;
      const pts = `${ms.totalScore} pts`;
      const pw = ctx.measureText(pts).width;
      ctx.fillText(pts, innerX + INNER_W - pw, mid);
      y += 24;
    }
    y += INNER_PAD;
  }

  // ── Blooper section ──────────────────────────────────────────────────────
  if (blooper) {
    const bloopImg = await loadImage(mediaUrl(blooper.photoUrl));
    const BLOOP_H = 80;
    const BLOOP_W = BLOOP_H * (4 / 3);

    // Blooper card.
    ctx.fillStyle = '#fff5f0';
    roundRect(ctx, innerX, y, INNER_W, BLOOP_H + 20, 6);
    ctx.fill();

    // Photo.
    if (bloopImg) {
      drawCoverStrip(ctx, bloopImg, innerX + 8, y + 8, BLOOP_W, BLOOP_H);
    }

    // Label.
    ctx.font = font(800, 13);
    ctx.fillStyle = '#e55a2b';
    ctx.textBaseline = 'top';
    ctx.fillText('🏆 Best Bloop Award', innerX + BLOOP_W + 20, y + 10);
    ctx.font = font(500, 11);
    ctx.fillStyle = INK_SOFT;
    const reason = blooper.reason.length > 60 ? blooper.reason.slice(0, 59) + '…' : blooper.reason;
    ctx.fillText(`"${reason}"`, innerX + BLOOP_W + 20, y + 30);
    if (blooper.memberName) {
      ctx.font = font(600, 11);
      ctx.fillStyle = INK_SOFT;
      ctx.fillText(`— ${blooper.memberName}`, innerX + BLOOP_W + 20, y + 48);
    }
    y += BLOOP_H + 20 + INNER_PAD;
  }

  // ── Bottom bar (polaroid caption strip) ──────────────────────────────────
  const barY = cardY + CARD_H - BOTTOM_BAR;
  ctx.fillStyle = WHITE;
  ctx.fillRect(cardX, barY, cardW, BOTTOM_BAR);
  // Round bottom corners.
  roundRect(ctx, cardX, barY, cardW, BOTTOM_BAR, 0);
  ctx.fill();

  ctx.font = font(500, 11);
  ctx.fillStyle = INK_SOFT;
  ctx.textBaseline = 'bottom';
  ctx.fillText(`Play at: ${playUrl}`, cardX + INNER_PAD, cardY + CARD_H - 14);

  // ── Share or download ─────────────────────────────────────────────────────
  const blob = await toBlob(canvas);
  const file = new File([blob], 'hunt-score.png', { type: 'image/png' });
  const shareTitle = teamResult
    ? `${teamResult.teamName} scored ${session.totalScore} pts on "${routeTitle}"!`
    : `I scored ${session.totalScore} pts on "${routeTitle}"!`;
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: shareTitle });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hunt-score.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
