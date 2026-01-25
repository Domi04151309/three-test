import * as THREE from 'three';
import { App } from './app/app';
import { setHealth, setStamina } from './app/player/player.ui.handlers';

export class Cheats {
  constructor(private app: App) {}

  help(): this {
    console.table({
      'help()': 'Show this message',
      'health(value)': 'Set player health (0..maxHealth)',
      'stamina(value)': 'Set player stamina (0..maxStamina)',
      'time(value)': 'Set normalized time of day (0..1)',
      'teleport(x, y, z)': 'Move the player to the given coordinates',
    });
    return this;
  }

  health(value: number): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      console.warn('Health expects a numeric argument');
      return;
    }

    if (!Number.isFinite(value)) {
      console.warn('Health expects a finite numeric value');
      return;
    }

    setHealth(this.app.player, value);

    console.log('Player health set to', value);
  }

  stamina(value: number): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      console.warn('Stamina expects a numeric argument');
      return;
    }

    if (!Number.isFinite(value)) {
      console.warn('Stamina expects a finite numeric value');
      return;
    }

    setStamina(this.app.player, value);

    console.log('Player stamina set to', value);
  }

  time(value: number): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      console.warn('Time expects a numeric argument');
      return;
    }

    if (value < 0 || value > 1) {
      console.warn('Time expects a normalized value between', 0, 'and', 1);
      return;
    }

    this.app.skyController.setTimeOfDay(value);

    console.log('Time set to', value);
  }

  teleport(x: number, y: number, z: number): void {
    const pos = new THREE.Vector3(x, y, z);
    if (
      !Number.isFinite(pos.x) ||
      !Number.isFinite(pos.y) ||
      !Number.isFinite(pos.z)
    ) {
      console.warn('Teleport expects numeric x, y, z');
      return;
    }

    this.app.player.object.position.copy(pos);
    this.app.terrain.updatePlayerPosition(this.app.player.object.position);

    console.log('Teleported player to', pos.x, pos.y, pos.z);
  }

  install(): void {
    (globalThis as unknown as { cheats?: Cheats }).cheats = this;
    console.info('Cheats installed: window.cheats.help()');
  }
}
