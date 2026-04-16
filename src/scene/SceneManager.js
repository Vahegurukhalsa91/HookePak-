import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildInsertInScene, buildPaperboardInScene, buildPackTransitPreview, isPaperboardStyle } from "../CartonBuilder";
import { setViewerCommandHandler } from "./viewerBridge.js";

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
    /** @type {string} */
    this.activeStageId = "primary";
    this._onViewerCommand = (cmd) => this.handleViewerCommand(cmd);
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
    this.controls.minDistance = 0.18;
    this.controls.maxDistance = 22;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = 1.15;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 0.75;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    setViewerCommandHandler(this._onViewerCommand);

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

  handleViewerCommand(cmd) {
    if (!cmd || !this.camera || !this.controls) return;
    const { type } = cmd;
    if (type === "resetCamera") {
      this.setActiveStage(this.activeStageId);
      return;
    }
    if (type === "framePackaging") {
      this.framePackaging();
      return;
    }
    if (type === "zoomIn") {
      this.dollyTowardTarget(0.82);
      return;
    }
    if (type === "zoomOut") {
      this.dollyTowardTarget(1.22);
      return;
    }
  }

  dollyTowardTarget(factor) {
    const target = this.controls.target;
    const pos = this.camera.position;
    const dir = pos.clone().sub(target);
    const len = dir.length();
    if (len < 1e-6) return;
    dir.multiplyScalar(factor);
    const nextLen = Math.max(this.controls.minDistance * 1.02, Math.min(this.controls.maxDistance * 0.98, dir.length()));
    dir.normalize().multiplyScalar(nextLen);
    pos.copy(target.clone().add(dir));
    this.controls.update();
  }

  framePackaging() {
    if (!this.packagingGroup || !this.camera || !this.controls) return;
    const box = new THREE.Box3().setFromObject(this.packagingGroup);
    if (!box.isEmpty()) {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const center = sphere.center.clone();
      const radius = Math.max(sphere.radius, 0.04);
      this.controls.target.copy(center);
      const offset = new THREE.Vector3(0.62, 0.48, 1.05).normalize().multiplyScalar(radius * 3.1);
      this.camera.position.copy(center.clone().add(offset));
      const span = Math.max(radius * 2.2, 0.25);
      this.controls.minDistance = Math.max(0.12, span * 0.12);
      this.controls.maxDistance = Math.max(6, span * 14);
      this.camera.near = Math.max(0.02, span / 2000);
      this.camera.far = Math.max(500, span * 80);
      this.camera.updateProjectionMatrix();
      this.controls.update();
      return;
    }
    this.setActiveStage(this.activeStageId);
  }

  setActiveStage(stageId) {
    if (!this.camera) return;
    this.activeStageId = stageId || "primary";
    const pose = CAMERA_POSES[this.activeStageId] || CAMERA_POSES.primary;
    this.camera.position.copy(pose.position);
    if (this.controls) {
      this.controls.target.copy(pose.target);
      this.controls.minDistance = 0.18;
      this.controls.maxDistance = 22;
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

    if (typeof activeStage === "string") {
      this.activeStageId = activeStage;
    }

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
    setViewerCommandHandler(null);
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
