import * as THREE from 'three';

const USE_KEY = {
  bed: 'E: Sleep',
  galley: 'E: Eat',
  bathroom: 'E: Wash',
};

export function createInteract({ camera, dom, interactables, ship, setExposure }) {
  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const promptEl = document.getElementById('prompt');
  const statusEl = document.getElementById('status');
  const fadeEl = document.getElementById('fade');
  const fadeText = fadeEl.querySelector('span');
  let current = null;
  let busy = false;
  let statusTimer = 0;
  let suppressed = false;

  const meshes = interactables.map((item) => item.mesh);

  function setHover(item, on) {
    const mat = item.mesh.material;
    if (!mat.emissive) return;
    if (on) {
      mat.emissive.setHex(0x1c4a44);
      mat.emissiveIntensity = 0.45;
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = item.baseEmissive || 0;
    }
  }

  function setPrompt(text) {
    if (!text) {
      promptEl.classList.remove('show');
      promptEl.textContent = '';
      return;
    }
    promptEl.textContent = text;
    promptEl.classList.add('show');
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setFade(opacity, text) {
    fadeEl.classList.toggle('on', opacity > 0.5);
    fadeText.textContent = text || '';
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fadeTo(on, text) {
    setFade(on ? 1 : 0, text);
    await wait(on ? 620 : 680);
  }

  async function perform(id) {
    if (busy) return statusEl.textContent;
    busy = true;
    setPrompt('');
    if (id === 'bed') {
      await fadeTo(true, '8 hours pass');
      ship.setCycleImmediate(1);
      setExposure(0.74);
      setStatus('8 hours pass');
      await wait(350);
      await fadeTo(false, '');
      await wait(1500);
      ship.setCycle(0);
      setExposure(1.0);
      await wait(1700);
      setStatus('Rested.');
    } else if (id === 'galley') {
      setStatus('You eat. Energy restored.');
    } else if (id === 'bathroom') {
      await fadeTo(true, 'Refreshed.');
      await wait(500);
      await fadeTo(false, '');
      setStatus('Refreshed.');
    }
    statusTimer = 4.5;
    busy = false;
    return statusEl.textContent;
  }

  function tryUse() {
    if (current && !busy) perform(current.id);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryUse();
  });

  function update(dt) {
    if (suppressed) {
      if (current) setHover(current, false);
      current = null;
      setPrompt('');
    }
    if (statusTimer > 0) {
      statusTimer -= dt;
      if (statusTimer <= 0 && !busy) {
        setStatus(ship.getCycle() > 0.5 ? 'Rest cycle' : 'Flight cycle');
      }
    }
    if (busy || suppressed) return;
    raycaster.setFromCamera(center, camera);
    const hits = raycaster.intersectObjects(meshes, false);
    const hit = hits.find((h) => h.distance < 2.6);
    const next = hit ? interactables.find((item) => item.mesh === hit.object) : null;
    if (next !== current) {
      if (current) setHover(current, false);
      current = next || null;
      if (current) setHover(current, true);
      setPrompt(current ? USE_KEY[current.id] : '');
    }
  }

  return {
    update,
    tryUse,
    perform,
    setPrompt,
    setStatus,
    setFade,
    getStatus: () => statusEl.textContent,
    getPrompt: () => promptEl.textContent,
    isBusy: () => busy,
    setSuppressed: (value) => {
      suppressed = value;
      if (value) {
        if (current) setHover(current, false);
        current = null;
        setPrompt('');
      }
    },
  };
}
