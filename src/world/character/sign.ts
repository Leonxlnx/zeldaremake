/**
 * The picket sign's meshes (signPose.ts has the layout): a wooden pole and a board with the
 * screenshot on both faces. BoxGeometry maps its +z and −z faces each to read the right way round
 * from its own side, so the camera behind Link and anyone in front of him both read the note.
 * The face is lit a little from within so the note stays legible under the canopy's shade.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, TextureLoader } from 'three';
import { SIGN_BOARD, SIGN_POLE } from './signPose';

export interface HeldSign {
  /** parent it to the chest bone; its local frame is signPose.ts's */
  group: Group;
  dispose(): void;
}

export function createHeldSign(textureUrl: string, anisotropy = 8): HeldSign {
  const group = new Group();
  group.name = 'link-sign';
  const texture = new TextureLoader().load(textureUrl);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  const wood = new MeshStandardMaterial({ color: 0x7b5b3b, roughness: 0.85, metalness: 0 });
  const face = new MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.45, roughness: 0.75, metalness: 0 });
  const boardGeometry = new BoxGeometry(SIGN_BOARD.width, SIGN_BOARD.height, SIGN_BOARD.depth);
  // BoxGeometry's groups run +x, −x, +y, −y, +z, −z
  const board = new Mesh(boardGeometry, [wood, wood, wood, wood, face, face]);
  board.name = 'link-sign-board';
  board.position.set(SIGN_BOARD.x, SIGN_BOARD.bottom + SIGN_BOARD.height / 2, SIGN_BOARD.z);
  const poleGeometry = new CylinderGeometry(SIGN_POLE.radius, SIGN_POLE.radius, SIGN_POLE.y1 - SIGN_POLE.y0, 10);
  const pole = new Mesh(poleGeometry, wood);
  pole.name = 'link-sign-pole';
  pole.position.set(SIGN_POLE.x, (SIGN_POLE.y0 + SIGN_POLE.y1) / 2, SIGN_POLE.z);
  for (const m of [board, pole]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  group.add(board, pole);
  return {
    group,
    dispose() {
      group.removeFromParent();
      boardGeometry.dispose();
      poleGeometry.dispose();
      wood.dispose();
      face.dispose();
      texture.dispose();
    },
  };
}
