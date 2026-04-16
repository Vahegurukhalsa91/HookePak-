import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildInsertInScene, buildPaperboardInScene, buildPackTransitPreview, isPaperboardStyle } from "../CartonBuilder";

const SC = 0.005;

const CAMERA_POSES = {
  primary: { position: new THREE.Vector3(0.8, 0.5, 1.4), target: new THREE.Vector3(0, 0, 0) },
  pack: { position: new THREE.Vector3(1.0, 0.6, 1.8), target: new THREE.Vector3(0, 0, 0) },
  pallet: { position: new THREE.Vector3(4.0, 4.5, 9.0), target: new THREE.Vector3(0, 1.0, 0) },
  report: { position: new THREE.Vector3(4.5, 5.0, 10.0), target: new THREE.Vector3(0, 0, 0) },
};

/**
 * Three.js scene for HookePak centre viewer — warm dark room, no grid, soft ground shadow.
 */
export class SceneManager {
  constructor() {
    this.mount = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.root = null;
    this.packagingGroup = null;
    this.directionalLight = null;
    this._raf = 0;
    this.controls = null;
  }

  init(mount) {
    this.dispose();
    this.mount = mount;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(mount.clientWidth, mount.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0d0c0b, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, mount.clientWidth / mount.clientHeight, 0.1, 2000);

    const vignetteGeo = new THREE.SphereGeometry(50, 16, 16);
    const vignetteMat = new THREE.MeshBasicMaterial({
      color: 0x0d0c0b,
      side: THREE.BackSide,
    });
    const vignette = new THREE.Mesh(vignetteGeo, vignetteMat);
    this.scene.add(vignette);

    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(new THREE.AmbientLight(0xfff5e0, 0.45));
    this.directionalLight = new THREE.DirectionalLight(0xfff0cc, 0.85);
    this.directionalLight.position.set(2.5, 4, 2);
    this.directionalLight.castShadow = true;
    this.scene.add(this.directionalLight);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.packagingGroup = new THREE.Group();
    this.root.add(this.packagingGroup);

    this.setActiveStage("primary");

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 14;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    const onResize = () => {
      if (!this.mount) return;
      this.renderer.setSize(this.mount.clientWidth, this.mount.clientHeight);
      this.camera.aspect = this.mount.clientWidth / this.mount.clientHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    this._onResize = onResize;

    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      if (!this.renderer || !this.scene || !this.camera) return;
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  setActiveStage(stageId) {
    if (!this.camera) return;
    const pose = CAMERA_POSES[stageId] || CAMERA_POSES.primary;
    this.camera.position.copy(pose.position);
    if (this.controls) {
      this.controls.target.copy(pose.target);
      this.controls.update();
    } else {
      this.camera.lookAt(pose.target);
    }
  }

  /**
   * @param {object} opts
   * @param {object} opts.designState
   * @param {string} opts.activeStage
   * @param {number} opts.foldProgress
   */
  rebuildPackaging({ designState, activeStage, foldProgress }) {
    if (!this.packagingGroup) return;
    while (this.packagingGroup.children.length) this.packagingGroup.remove(this.packagingGroup.children[0]);

    const primary = designState?.primary;
    const transit = designState?.transitCarton;

    if (activeStage === "pack") {
      if (primary && transit) {
        buildPackTransitPreview(this.packagingGroup, primary, transit);
      }
      return;
    }

    if (!primary) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.2, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xe8a838, roughness: 0.85 })
      );
      m.castShadow = true;
      this.packagingGroup.add(m);
      return;
    }

    const L = Number(primary.L || 200);
    const W = Number(primary.W || 200);
    const H = Number(primary.H || 200);

    if (activeStage !== "pack" && isPaperboardStyle(primary.style)) {
      buildPaperboardInScene(this.packagingGroup, primary, foldProgress);
    } else {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(L * SC, H * SC, W * SC),
        new THREE.MeshStandardMaterial({ color: 0xe8a838, roughness: 0.85 })
      );
      mesh.castShadow = true;
      this.packagingGroup.add(mesh);
    }
    if (primary.insertRequired) buildInsertInScene(this.packagingGroup, primary);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this.controls?.dispose?.();
    this.controls = null;
    if (this.renderer && this.mount?.contains(this.renderer.domElement)) {
      this.mount.removeChild(this.renderer.domElement);
    }
    this.renderer?.dispose?.();
    this.mount = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.root = null;
    this.packagingGroup = null;
  }
}
