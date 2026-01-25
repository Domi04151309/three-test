import type { Player } from './player';

export function handleKey(player: Player, code: string, down: boolean): void {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      player.moveForward = down;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      player.moveLeft = down;
      break;
    case 'ArrowDown':
    case 'KeyS':
      player.moveBackward = down;
      break;
    case 'ArrowRight':
    case 'KeyD':
      player.moveRight = down;
      break;
    case 'Space':
      if (down && player.canJump) {
        player.velocity.y +=
          player.options.jumpVelocity *
          player.options.jumpScale *
          (player.isSprinting ? player.options.sprintMultiplier / 2 : 1);
        player.canJump = false;
      }
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      if (down) {
        if (player.stamina > 0) player.isSprinting = true;
      } else {
        player.isSprinting = false;
      }
      break;
    case 'KeyC':
      player.isZooming = down;
      break;
    case 'KeyE':
      if (down) player.inventoryManager.toggleInventory();
      break;
    case 'KeyQ':
      if (down) player.inventoryManager.dropCurrent();
      break;
    case 'Digit1':
    case 'Digit2':
    case 'Digit3':
    case 'Digit4':
    case 'Digit5':
    case 'Digit6':
    case 'Digit7':
    case 'Digit8':
    case 'Digit9':
      if (down) {
        const slot = Number(code.replace('Digit', '')) - 1;
        if (!Number.isNaN(slot)) player.inventoryManager.equipSlot(slot);
      }
      break;
    default:
      break;
  }
}
