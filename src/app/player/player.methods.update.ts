import * as THREE from 'three';
import type { Player } from './player';
import { updateStaminaUI } from './player-ui';
import { heal } from './player.methods.ui';

export function update(player: Player, delta: number): void {
  const dt = Math.min(delta, 0.05);
  const damping = Math.exp(-10 * dt);
  player.velocity.x *= damping;
  player.velocity.z *= damping;
  player.velocity.y -=
    player.options.gravity * player.options.gravityScale * dt;

  player.direction.z = Number(player.moveForward) - Number(player.moveBackward);
  player.direction.x = Number(player.moveRight) - Number(player.moveLeft);
  player.direction.normalize();

  if (player.isSprinting && player.stamina > 0) {
    player.stamina -= player.staminaDrainRate * dt;
    if (player.stamina <= 0) {
      player.stamina = 0;
      player.isSprinting = false;
    }
  } else if (player.stamina < player.maxStamina) {
    player.stamina += player.staminaRegenRate * dt;
    if (player.stamina > player.maxStamina) player.stamina = player.maxStamina;
  } else if (!player.isSprinting && player.health < player.maxHealth) {
    heal(player, player.healthRegenRate * dt);
  }

  const moveSpeed =
    player.options.speed *
    (player.isSprinting ? player.options.sprintMultiplier : 1);
  if (player.moveForward || player.moveBackward)
    player.velocity.z -= player.direction.z * moveSpeed * dt;
  if (player.moveLeft || player.moveRight)
    player.velocity.x -= player.direction.x * moveSpeed * dt;

  player.controls.moveRight(-player.velocity.x * dt);
  player.controls.moveForward(-player.velocity.z * dt);
  player.object.position.y += player.velocity.y * dt;

  const groundY = Math.max(
    player.options.minLevel,
    player.options.ground(player.object.position.x, player.object.position.z),
  );
  const playerHeight = player.options.height * player.options.heightScale;
  if (player.object.position.y < groundY + playerHeight) {
    player.velocity.y = 0;
    player.object.position.y = groundY + playerHeight;
    player.canJump = true;
  }

  const isMoving =
    player.moveForward ||
    player.moveBackward ||
    player.moveLeft ||
    player.moveRight;
  player.viewBobbing.update(dt, isMoving);
  player.punchHandler.update(dt);

  player.inventoryManager.update();

  if (player.camera instanceof THREE.PerspectiveCamera) {
    const baseTargetFov = player.isZooming ? player.zoomFov : player.defaultFov;
    let targetFov = baseTargetFov;
    if (!player.isZooming && player.isSprinting)
      targetFov += player.sprintFovIncrease;
    const zoomParameter = 1 - Math.exp(-player.zoomSpeed * dt);
    const updatedFov =
      player.camera.fov + (targetFov - player.camera.fov) * zoomParameter;
    if (Math.abs(updatedFov - player.camera.fov) > 0.01) {
      player.camera.fov = updatedFov;
      player.camera.updateProjectionMatrix();
    }
  }

  updateStaminaUI(
    player.stamina,
    player.maxStamina,
    player.staminaFillElement,
    player.staminaTextElement,
  );
}
