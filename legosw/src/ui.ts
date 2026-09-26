/**
 * Cutscene chrome in the style of the LEGO Star Wars games: 2.39:1 letterbox bars and a subtitle
 * line in the lower bar ("Speaker: line" with the speaker in gold), plus full-frame title cards.
 */
export const ASPECT = 2.39;

export interface Layout {
  width: number;
  height: number;
  top: number;
  left: number;
  pageW: number;
  pageH: number;
}

const css = `
#film-ui .sub { position: absolute; left: 50%; transform: translateX(-50%); width: max-content; max-width: 88%; text-align: center; color: #fff; font-family: Inter, "Source Sans 3", Arimo, Arial, sans-serif; font-weight: 600; letter-spacing: 0.01em; line-height: 1.25; text-shadow: 0 2px 3px rgba(0,0,0,0.85); white-space: normal; text-wrap: balance; }
#film-ui .sub b { color: #f2c33a; font-weight: 600; }
#film-ui .card { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; opacity: 0; }
#film-ui .card.farfar { color: #4cc3ff; font-family: "Source Sans 3", Inter, Arimo, sans-serif; font-weight: 400; line-height: 1.35; letter-spacing: 0.01em; }
#film-ui .card.endcard { color: #f5d24a; font-family: "Source Sans 3", Inter, Arimo, sans-serif; font-weight: 700; letter-spacing: 0.18em; }
#film-ui .fade { position: absolute; background: #000; opacity: 0; }
`;

export class FilmUI {
  root: HTMLElement;
  sub: HTMLDivElement;
  cardFar: HTMLDivElement;
  cardEnd: HTMLDivElement;
  fade: HTMLDivElement;
  layout: Layout = { width: 1, height: 1, top: 0, left: 0, pageW: 1, pageH: 1 };
  /** px kept clear at the bottom of the page (the realtime viewer's transport bar); 0 for exports */
  reserve = 0;
  private fs = 24;

  constructor(root: HTMLElement) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.fade = document.createElement('div');
    this.fade.className = 'fade';
    this.sub = document.createElement('div');
    this.sub.className = 'sub';
    this.cardFar = document.createElement('div');
    this.cardFar.className = 'card farfar';
    this.cardFar.innerHTML = '<div>A long time ago in a galaxy far,<br>far away....</div>';
    this.cardEnd = document.createElement('div');
    this.cardEnd.className = 'card endcard';
    root.append(this.fade, this.sub, this.cardFar, this.cardEnd);
  }

  /** Fit the canvas to a centred 2.39:1 band; returns the render size. */
  fit(canvas: HTMLCanvasElement, pageW: number, pageH: number): Layout {
    let w = pageW;
    let h = Math.round(pageW / ASPECT);
    if (h > pageH) {
      h = pageH;
      w = Math.round(h * ASPECT);
    }
    const top = Math.round((pageH - h) / 2);
    const left = Math.round((pageW - w) / 2);
    Object.assign(canvas.style, { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    this.layout = { width: w, height: h, top, left, pageW, pageH };
    // sized by the page height, capped by its width so long cues stay at two lines in narrow windows
    this.fs = Math.round(Math.min(pageH * 0.034, pageW * 0.0205));
    this.sub.style.fontSize = `${this.fs}px`;
    this.placeSub();
    Object.assign(this.fade.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    this.cardFar.style.fontSize = `${Math.round(pageH * 0.042)}px`;
    this.cardEnd.style.fontSize = `${Math.round(pageH * 0.05)}px`;
    return this.layout;
  }

  setSubtitle(speaker: string | null, line: string | null, opacity = 1): void {
    if (!line) {
      this.sub.style.opacity = '0';
      return;
    }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const html = speaker ? `<b>${esc(speaker)}:</b> ${esc(line)}` : esc(line);
    if (this.sub.innerHTML !== html) {
      this.sub.innerHTML = html;
      this.placeSub();
    }
    this.sub.style.opacity = String(opacity);
  }

  /** Centre the (possibly wrapped) caption in the lower bar above the reserve; overlay the picture's foot if the bar is too thin. */
  private placeSub(): void {
    const { top, height, pageH } = this.layout;
    const foot = top + height;
    const room = pageH - foot - this.reserve;
    const bh = this.sub.offsetHeight || Math.round(this.fs * 1.25);
    const y = room >= bh + 8 ? foot + Math.round((room - bh) / 2) : pageH - this.reserve - bh - 8;
    this.sub.style.top = `${y}px`;
  }

  setFade(black: number): void {
    this.fade.style.opacity = String(Math.max(0, Math.min(1, black)));
  }

  setCards(farfar: number, endcard: number, endHtml?: string): void {
    this.cardFar.style.opacity = String(Math.max(0, Math.min(1, farfar)));
    this.cardEnd.style.opacity = String(Math.max(0, Math.min(1, endcard)));
    if (endHtml !== undefined && this.cardEnd.innerHTML !== endHtml) this.cardEnd.innerHTML = endHtml;
  }
}
