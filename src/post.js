import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.5 },
    grain: { value: 0.08 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignette;
    uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += vec3(-0.015, 0.012, 0.02) * (1.0 - smoothstep(0.0, 0.45, luma));
      c.rgb += vec3(0.03, 0.012, -0.008) * smoothstep(0.35, 1.15, luma);
      float d = distance(vUv, vec2(0.5));
      float vig = smoothstep(0.9, 0.28, d);
      c.rgb *= mix(1.0 - vignette, 1.0, vig);
      float n = hash(vUv * vec2(1280.0, 720.0) + fract(time * 0.73) * 17.0);
      c.rgb += (n - 0.5) * grain;
      gl_FragColor = c;
    }
  `,
};

function patchGTAOSkip() {
  const proto = GTAOPass.prototype;
  if (proto.__skipAOPatched) return;
  const orig = proto._overrideVisibility;
  proto._overrideVisibility = function patched() {
    orig.call(this);
    const cache = this._visibilityCache;
    this.scene.traverse((object) => {
      if (object.userData && object.userData.skipAO && object.visible) {
        object.visible = false;
        cache.push(object);
      }
    });
  };
  proto.__skipAOPatched = true;
}

export function createPost(renderer, scene, camera) {
  patchGTAOSkip();

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
  renderer.setPixelRatio(pixelRatio);

  const rt = new THREE.WebGLRenderTarget(
    Math.floor(window.innerWidth * pixelRatio),
    Math.floor(window.innerHeight * pixelRatio),
    { type: THREE.HalfFloatType, samples: 2 }
  );
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.82;
  gtao.updateGtaoMaterial({
    radius: 0.48,
    distanceExponent: 1.05,
    thickness: 0.55,
    scale: 1.25,
    samples: 6,
    distanceFallOff: 0.85,
    screenSpaceRadius: false,
  });
  gtao.updatePdMaterial({
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 6,
    rings: 2,
    samples: 4,
  });
  composer.addPass(gtao);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42,
    0.55,
    1.35
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function setSize(width, height) {
    const pr = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    gtao.setSize(Math.max(1, Math.floor(width * pr)), Math.max(1, Math.floor(height * pr)));
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function render(time) {
    grade.uniforms.time.value = time;
    composer.render();
  }

  setSize(window.innerWidth, window.innerHeight);
  return { composer, bloom, gtao, grade, setSize, render };
}
