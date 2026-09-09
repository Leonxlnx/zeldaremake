/**
 * Image-based lighting from the procedural sky: a PMREM of the sky dome (sun core removed, ground
 * bounce colour below the horizon) so every MeshStandard/Physical material receives sky-coloured
 * ambient from above, green-brown bounce from below, and soft specular. Generated once at boot.
 */
import { Mesh, PMREMGenerator, Scene, SphereGeometry, type Texture, type WebGLRenderer, BackSide } from 'three';
import type { ShaderMaterial } from 'three';

export function buildSkyEnvironment(renderer: WebGLRenderer, envMaterial: ShaderMaterial): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();
  envMaterial.side = BackSide;
  const dome = new Mesh(new SphereGeometry(50, 32, 16), envMaterial);
  dome.frustumCulled = false;
  envScene.add(dome);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 200);
  pmrem.dispose();
  dome.geometry.dispose();
  envMaterial.dispose();
  rt.texture.name = 'sky-pmrem';
  return rt.texture;
}
