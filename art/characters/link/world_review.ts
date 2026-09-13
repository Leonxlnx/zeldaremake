import { AnimationMixer, Mesh, type Object3D, type Scene } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Diagnostic overlay only: copied into an isolated world checkout by capture_world.mjs.
// The production character, gameplay, terrain IK and audit remain Fable's implementation.
export async function installLinkReview(scene: Scene) {
  let host: Object3D | undefined;
  scene.traverse(ob => { if (ob.userData.character === 'link') host = ob; });
  if (!host) throw new Error('World has no Link root');
  const gltf = await new GLTFLoader().loadAsync('/astra-link.glb');
  const originals: [Mesh, boolean][] = [];
  host.traverse(ob => { if (ob instanceof Mesh) originals.push([ob, ob.visible]); });
  gltf.scene.traverse(ob => { if (ob instanceof Mesh) { ob.castShadow = true; ob.receiveShadow = true; } });
  host.add(gltf.scene);
  const mixer = new AnimationMixer(gltf.scene);
  const actions = Object.fromEntries(gltf.animations.map(c => [c.name, mixer.clipAction(c)]));
  return {
    pose(gait = 'idle', time = 0) {
      if (!actions[gait]) throw new Error('Missing clip ' + gait);
      mixer.stopAllAction(); actions[gait].reset().play(); mixer.setTime(time);
    },
    show(candidate: boolean) {
      for (const [mesh, visible] of originals) mesh.visible = candidate ? false : visible;
      gltf.scene.visible = candidate;
    },
    position: () => host!.position.toArray(),
    clips: Object.fromEntries(gltf.animations.map(c => [c.name, c.duration])),
  };
}
