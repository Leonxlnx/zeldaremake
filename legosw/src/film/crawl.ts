import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

/**
 * The opening crawl: yellow text on a plane tipped back into the stars, receding over time.
 * Text is our own paraphrase of the episode set-up.
 */
const TITLE = ['Episode III', 'REVENGE OF THE SITH'];
const BODY = [
  'War! The Republic is crumbling under the attacks of the Separatist droid armies, led by the Sith Lord Count Dooku.',
  'In a bold strike, the fiendish droid commander General Grievous has swept into the Republic capital and seized Supreme Chancellor Palpatine.',
  'As the droid fleet tries to flee the besieged planet with its prisoner, two Jedi Knights lead a desperate mission to rescue the Chancellor....',
];

export class Crawl {
  group = new Group();
  plane: Mesh;
  mat: MeshBasicMaterial;
  constructor() {
    this.group.name = 'crawl';
    const W = 1024, H = 2200;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#f2c230';
    g.textAlign = 'center';
    // title lines are measured and shrunk to 90% of the texture width: the fallback fonts that actually
    // render (no web font is loaded) set "REVENGE OF THE SITH" ~1350 px wide at 104 px, clipping both ends
    const fitLine = (text: string, weight: number, size: number, y: number) => {
      const face = (s: number) => `${weight} ${s}px "Source Sans 3", Inter, Arimo, sans-serif`;
      g.font = face(size);
      const wide = g.measureText(text).width;
      if (wide > W * 0.9) g.font = face(Math.floor((size * W * 0.9) / wide));
      g.fillText(text, W / 2, y);
    };
    fitLine(TITLE[0], 600, 64, 120);
    fitLine(TITLE[1], 800, 104, 250);
    g.font = '600 64px "Source Sans 3", Inter, Arimo, sans-serif';
    let y = 400;
    const lineH = 84;
    const maxW = W - 90;
    for (const para of BODY) {
      const words = para.split(' ');
      const lines: string[][] = [];
      let cur: string[] = [];
      for (const w of words) {
        const test = [...cur, w].join(' ');
        if (g.measureText(test).width > maxW && cur.length) {
          lines.push(cur);
          cur = [w];
        } else cur.push(w);
      }
      if (cur.length) lines.push(cur);
      lines.forEach((ln, li) => {
        const last = li === lines.length - 1;
        if (last || ln.length === 1) {
          g.textAlign = 'left';
          g.fillText(ln.join(' '), 45, y);
        } else {
          // justified
          const wsum = ln.reduce((s, w) => s + g.measureText(w).width, 0);
          const gap = (maxW - wsum) / (ln.length - 1);
          let x = 45;
          g.textAlign = 'left';
          for (const w of ln) {
            g.fillText(w, x, y);
            x += g.measureText(w).width + gap;
          }
        }
        y += lineH;
      });
      y += lineH * 0.9;
    }
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 16;
    this.mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false });
    this.plane = new Mesh(new PlaneGeometry(1, H / W), this.mat);
    this.plane.renderOrder = 10;
    this.group.add(this.plane);
  }
}
