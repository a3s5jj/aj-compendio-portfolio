import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export async function createRobotScene(canvas, width, height) {
  THREE.Cache.enabled = true;
  const model = await new GLTFLoader().loadAsync(new URL('../assets/robot/workshop-robot.glb', import.meta.url).href);
  if (!model.animations.length) throw new Error('The robot GLB contains no animation.');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.04).texture;
  scene.environmentIntensity = 0.45;
  environment.dispose();
  pmrem.dispose();
  const aspect = width / height;
  const camera = new THREE.OrthographicCamera(-3.5 * aspect, 3.5 * aspect, 3.5, -3.5, 0.1, 100);
  camera.aspect = aspect;
  const target = new THREE.Vector3(-0.25, 2.95, 0);
  camera.position.set(-4.8, 6.2, 16);
  camera.lookAt(target);
  scene.add(new THREE.HemisphereLight(0xe7efff, 0x18213a, 0.65));
  const key = new THREE.DirectionalLight(0xffdfac, 2.1);
  key.position.set(-4, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 6, bottom: -2, near: 0.5, far: 25 });
  key.shadow.bias = -0.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa4c3ff, 0.7);
  fill.position.set(5, 4, 3);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffc181, 1.6);
  rim.position.set(2, 8, -4);
  scene.add(rim);
  model.scene.traverse(object => {
    if (object.isMesh) {
      object.castShadow = true;
      // The floating hand moves beyond the skin's cached bounds.
      object.frustumCulled = false;
      if (object.userData.idlePart === 'glow') {
        object.castShadow = false;
        object.material.depthWrite = false;
      }
    }
  });
  scene.add(model.scene);
  const handGlow = model.scene.getObjectByName('HandGlow');
  const handLight = new THREE.PointLight(0x64ffd4, 0, 2.2, 2);
  scene.add(handLight);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.015;
  ground.receiveShadow = true;
  scene.add(ground);
  const mixer = new THREE.AnimationMixer(model.scene);
  const states = ['Greeting', 'Thinking', 'Working'];
  const clips = new Map(model.animations.map(clip => [clip.name, clip]));
  const durations = { Greeting: 7, Thinking: 9, Working: 7 };
  for (const name of states) {
    if (!clips.has(name) || Math.abs(clips.get(name).duration - durations[name]) > 1e-5) throw new Error(`Missing ${durations[name]}-second ${name} animation.`);
  }
  let currentState;
  function setState(name) {
    if (!states.includes(name)) throw new Error(`Unknown animation state: ${name}`);
    mixer.stopAllAction();
    mixer.clipAction(clips.get(name)).reset().play();
    mixer.setTime(0);
    currentState = name;
    model.scene.traverse(object => {
      if (!object.isMesh) return;
      const part = object.userData.idlePart;
      object.visible = part === 'body' ? name !== 'Thinking' : part === 'thought' ? name === 'Thinking' : part === 'workflow' || part === 'glow' ? name === 'Working' : true;
    });
    ground.visible = name !== 'Thinking';
    const view = name === 'Thinking' ? { x: 0, y: 4.9, span: 2.9 } : name === 'Working' ? { x: 1.2, y: 3.0, span: 4.5 } : { x: -.25, y: 2.95, span: 3.5 };
    target.set(view.x, view.y, 0);
    camera.position.set(view.x - 4.55, view.y + 3.25, 16);
    camera.zoom = 1;
    camera.left = -view.span * camera.aspect;
    camera.right = view.span * camera.aspect;
    camera.top = view.span;
    camera.bottom = -view.span;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  setState('Greeting');
  function renderAt(time) {
    if (!Number.isFinite(time) || time < 0) throw new Error('Animation time must be finite and nonnegative.');
    mixer.setTime(time);
    scene.updateMatrixWorld(true);
    handGlow.getWorldPosition(handLight.position);
    handLight.position.y += .15;
    handLight.position.z += .5;
    handLight.intensity = currentState === 'Working' ? .75*handGlow.scale.x : 0;
    renderer.render(scene, camera);
  }
  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.left = -camera.top * camera.aspect;
    camera.right = camera.top * camera.aspect;
    camera.updateProjectionMatrix();
  }
  renderAt(0);
  return { renderer, scene, camera, target, model: model.scene, mixer, get duration() { return durations[currentState]; }, states, setState, get currentState() { return currentState; }, renderAt, resize };
}
