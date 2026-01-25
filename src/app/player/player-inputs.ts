import { Player } from './player';
import { handleKey } from './player.methods.inputs';

export function attachPlayerInputHandlers(
  player: Player,
  domElement: HTMLElement,
): () => void {
  const isBlockedByMenu = (): boolean => {
    const { blocker } = player;
    if (!blocker) return false;
    const style = globalThis.getComputedStyle(blocker);
    return style.display !== 'none';
  };

  const onKeyDown = (event: KeyboardEvent) => {
    // Always allow inventory toggle to pass through so player can open/close
    // Inventory even when the pause blocker is visible.
    if (event.code === 'KeyE') {
      handleKey(player, event.code, true);
      return;
    }
    if (isBlockedByMenu()) return;
    handleKey(player, event.code, true);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'KeyE') {
      handleKey(player, event.code, false);
      return;
    }
    if (isBlockedByMenu()) return;
    handleKey(player, event.code, false);
  };

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    if (isBlockedByMenu()) return;
    // Disable punch while inventory is open
    if (player.inventoryManager.inventoryOpen) return;
    player.punchHandler.startPunch();
  };
  const onWheel = (event: WheelEvent) => {
    if (isBlockedByMenu()) return;
    player.wheelAccumulator += event.deltaY;
    const threshold = 100;
    if (Math.abs(player.wheelAccumulator) < threshold) return;
    const directionSign = player.wheelAccumulator > 0 ? 1 : -1;
    player.wheelAccumulator = 0;
    // Only cycle through the hotbar (first 9 slots), not the whole inventory
    const hotbarLength = 9;
    let next = player.inventoryManager.currentSlot;
    if (next === -1) next = 0;
    // If currentSlot is outside hotbar (e.g. -1 or >8), clamp into hotbar range
    if (next >= hotbarLength || next < 0) next = 0;
    next = (next + directionSign + hotbarLength) % hotbarLength;
    player.inventoryManager.equipSlot(next);
  };

  const onTouchStart = (event: TouchEvent) => {
    if (isBlockedByMenu()) return;
    if (event.touches.length !== 1) return;
    const [touch] = event.touches;
    player.touchId = touch.identifier;
    player.lastTouchX = touch.clientX;
    player.lastTouchY = touch.clientY;
    if (player.blocker) player.blocker.style.display = 'none';
    event.preventDefault();
  };

  const onTouchMove = (event: TouchEvent) => {
    if (isBlockedByMenu()) return;
    if (player.touchId === null) return;
    let touch: Touch | null = null;
    for (let index = 0; index < event.touches.length; index++) {
      const tt = event.touches.item(index);
      if (tt && tt.identifier === player.touchId) {
        touch = tt;
        break;
      }
    }
    if (!touch) return;
    const dx = touch.clientX - player.lastTouchX;
    const dy = touch.clientY - player.lastTouchY;
    player.lastTouchX = touch.clientX;
    player.lastTouchY = touch.clientY;
    const yawObject = player.controls.object;
    yawObject.rotation.y -= dx * player.options.touchSensitivity;
    const cam = player.camera;
    const maxPitch = Math.PI / 2 - 0.01;
    const minPitch = -maxPitch;
    const updatedPitch = cam.rotation.x - dy * player.options.touchSensitivity;
    cam.rotation.x = Math.max(minPitch, Math.min(maxPitch, updatedPitch));
    cam.rotation.z = 0;
    event.preventDefault();
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (isBlockedByMenu()) return;
    if (player.touchId === null) return;
    let stillActive = false;
    for (let index = 0; index < event.touches.length; index++) {
      const tt = event.touches.item(index);
      if (tt && tt.identifier === player.touchId) {
        stillActive = true;
        break;
      }
    }
    if (!stillActive) player.touchId = null;
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  domElement.addEventListener('mousedown', onMouseDown);
  domElement.addEventListener('wheel', onWheel, { passive: true });
  domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  domElement.addEventListener('touchend', onTouchEnd);
  domElement.addEventListener('touchcancel', onTouchEnd);

  return () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    domElement.removeEventListener('mousedown', onMouseDown);
    domElement.removeEventListener('wheel', onWheel);
    domElement.removeEventListener('touchstart', onTouchStart);
    domElement.removeEventListener('touchmove', onTouchMove);
    domElement.removeEventListener('touchend', onTouchEnd);
    domElement.removeEventListener('touchcancel', onTouchEnd);
  };
}
