import * as THREE from 'three';

export interface FirefliesOptions {
  count: number;
  minDistance: number;
  maxDistance: number;
}

export class Fireflies extends THREE.Object3D {
  private spheres: THREE.Mesh[];
  private velocities: Float32Array;
  private life: Float32Array;
  private count: number;
  private minDistance: number;
  private maxDistance: number;

  constructor(options: FirefliesOptions) {
    super();
    this.count = options.count;

    this.minDistance = options.minDistance;
    this.maxDistance = options.maxDistance;
    this.spheres = [];
    this.velocities = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);

    const geom = new THREE.SphereGeometry(0.05, 1, 1);
    for (let index = 0; index < this.count; index++) {
      const mat = new THREE.MeshBasicMaterial();
      mat.color.setRGB(8, 8, 8);

      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 1001;

      this.add(mesh);
      this.spheres.push(mesh);
    }

    for (let index = 0; index < this.count; index++) this.respawn(index);
  }

  public initialize(center: THREE.Vector3): void {
    this.position.copy(center);
    for (let index = 0; index < this.count; index++) this.respawn(index);
  }

  private respawn(index: number): void {
    const base = index * 3;
    const radius =
      this.minDistance +
      Math.random() * Math.max(0, this.maxDistance - this.minDistance);
    const phi = Math.random() * Math.PI * 2;
    const theta = (Math.random() - 0.5) * Math.PI * 0.5;
    const x = Math.cos(phi) * Math.cos(theta) * radius;
    const z = Math.sin(phi) * Math.cos(theta) * radius;
    const y = (Math.random() - 0.2) * 2;

    this.spheres[index].position.set(x, y, z);

    const speed = 0.5 + Math.random() * 1.5;
    this.velocities[base] =
      (x / (radius + 0.0001)) * speed + (Math.random() - 0.5) * 0.1;
    this.velocities[base + 1] = (Math.random() - 0.5) * 0.2;
    this.velocities[base + 2] =
      (z / (radius + 0.0001)) * speed + (Math.random() - 0.5) * 0.1;

    this.life[index] = 2 + Math.random() * 6;
  }

  public update(dt: number, playerPosition: THREE.Vector3): void {
    this.position.copy(playerPosition);
    for (let index = 0; index < this.count; index++) {
      const base = index * 3;
      const mesh = this.spheres[index];
      mesh.position.x += this.velocities[base] * dt;
      mesh.position.y += this.velocities[base + 1] * dt;
      mesh.position.z += this.velocities[base + 2] * dt;

      this.life[index] -= dt;

      const dx = mesh.position.x;
      const dy = mesh.position.y;
      const dz = mesh.position.z;
      const distance2 = dx * dx + dy * dy + dz * dz;
      if (
        this.life[index] <= 0 ||
        distance2 > this.maxDistance * this.maxDistance * 16
      ) {
        this.respawn(index);
      }
    }
  }

  public getParticlePosition(index: number): THREE.Vector3 {
    const clamped = Math.max(0, Math.min(this.count - 1, index));
    const position = new THREE.Vector3();
    position.copy(this.spheres[clamped].position).add(this.position);
    return position;
  }
}
