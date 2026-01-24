import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Item } from './items/item';
import type { HotbarPreviewEntry } from './hotbar-preview';
import { updateHotbarUI } from './inventory-overlay';
import { closeInventory, openInventory } from './inventory-ui';
import { terrainOptions } from '../terrain/terrain-options';

interface InventoryHost {
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
}
export class InventoryManager {
  host: InventoryHost;
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
  // Scene to place dropped items into. Set by the app after player creation.
  world: THREE.Scene | null = null;
  // Optional ground height callback (x,z) => y
  ground: ((x: number, z: number) => number) | null = null;
  // Items currently dropped into the world (with drop timestamp and original scale)
  dropped: Array<{
    item: Item;
    object: THREE.Object3D;
    droppedAt: number;
    originalScale: number;
  }> = [];
  // 27 main inventory slots + 9 hotbar slots = 36 total
  inventory: (Item | null)[] = Array.from({ length: 36 }, () => null);
  currentSlot = -1;
  // Only the hotbar (first 9 slots) needs renderers for the on-screen hotbar
  hotbarRenderers: (HotbarPreviewEntry | null)[] = Array.from(
    { length: 9 },
    () => null,
  );
  inventoryOpen = false;
  draggingItem: Item | null = null;
  draggingFromIndex: number | null = null;
  inventoryOverlay: HTMLElement | null = null;
  draggingPreview: HotbarPreviewEntry | null = null;
  onMouseMoveForDrag: ((event: MouseEvent) => void) | null = null;
  pointerWasLocked = false;
  blockerWasVisible = false;
  instructionsWasVisible = false;
  constructor(host: InventoryHost) {
    this.host = host;
    this.controls = host.controls;
    this.rightHand = host.rightHand;
  }

  toggleInventory(): void {
    if (this.inventoryOpen) closeInventory(this);
    else openInventory(this);
  }

  dropCurrent(): void {
    if (this.currentSlot < 0 || this.currentSlot >= this.inventory.length)
      return;
    const item = this.inventory[this.currentSlot];
    if (!item || !item.object) return;

    // Detach from hand if attached
    if (item.object.parent === this.rightHand)
      this.rightHand.remove(item.object);

    // Place well in front of the player so it isn't immediately re-picked
    const pos = this.controls.object.position.clone();
    const yaw = this.controls.object.rotation.y;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const dropDistance = 8;
    const dropPos = pos.add(forward.multiplyScalar(dropDistance));
    // Use terrain height if available so the item floats a bit above ground
    if (this.ground) {
      const groundY = this.ground(dropPos.x, dropPos.z);
      // Place slightly above ground, but never below water level if known
      const floatOffset = 4;
      let targetY = groundY + floatOffset;
      if (targetY < terrainOptions.waterLevel + floatOffset)
        targetY = terrainOptions.waterLevel + floatOffset;
      dropPos.y = targetY;
    }
    // Make dropped item 5x larger than its current scale and remember original
    const originalScale = item.object.scale.x;
    item.object.scale.setScalar(originalScale * 4);
    item.object.position.copy(dropPos);

    if (this.world) this.world.add(item.object);
    this.dropped.push({
      item,
      object: item.object,
      droppedAt: performance.now(),
      originalScale,
    });

    this.inventory[this.currentSlot] = null;
    // Keep the slot selected but empty so the hotbar shows selection
    // Ensure hand is empty (we already removed the object above)
    updateHotbarUI(this);
  }

  update(): void {
    if (this.dropped.length === 0) return;
    const playerPos = this.controls.object.position;
    // Use horizontal distance (ignore camera/player Y) so camera height
    // Does not prevent pickups. Radius chosen to feel natural.
    const pickupRadius = 3;
    const pickupRadiusSq = pickupRadius * pickupRadius;
    const now = performance.now();
    const worldPos = new THREE.Vector3();
    for (let index = 0; index < this.dropped.length; index++) {
      const rec = this.dropped[index];
      // Rotate dropped items slowly around the Y axis
      rec.object.rotation.y -= 0.04;
      // Ignore very recently dropped items to avoid immediate re-pickup
      if (now - rec.droppedAt < 800) continue;
      // Compare horizontal distance only (XZ plane)
      rec.object.getWorldPosition(worldPos);
      const dx = worldPos.x - playerPos.x;
      const dz = worldPos.z - playerPos.z;
      const horizontalDistanceSquare = dx * dx + dz * dz;
      if (horizontalDistanceSquare <= pickupRadiusSq) {
        // Find first free inventory slot
        const freeIndex = this.inventory.indexOf(null);
        if (freeIndex === -1) return;
        // Restore original scale before returning to inventory
        rec.object.scale.setScalar(rec.originalScale);
        this.inventory[freeIndex] = rec.item;
        // Remove from world
        if (this.world) this.world.remove(rec.object);
        this.dropped.splice(index, 1);
        // If nothing is equipped, or the item landed in the currently
        // Selected slot, equip it so the hand model appears; otherwise
        // Just refresh the hotbar UI.
        if (freeIndex === this.currentSlot) this.equipSlot(freeIndex);
        else updateHotbarUI(this);
        return;
      }
    }
  }

  equipSlot(index: number): void {
    if (index < 0 || index >= this.inventory.length) return;
    if (this.currentSlot !== -1) {
      const current = this.inventory[this.currentSlot];
      if (current && current.object && current.object.parent === this.rightHand)
        this.rightHand.remove(current.object);
    }

    this.currentSlot = index;

    const next = this.inventory[this.currentSlot];
    if (next && next.object) {
      // Reset local transform so the object appears correctly in the hand
      if (next.defaultPosition) next.object.position.copy(next.defaultPosition);
      else next.object.position.set(0, 0, 0);
      if (next.defaultRotation) next.object.rotation.copy(next.defaultRotation);
      else next.object.rotation.set(0, 0, 0);
      this.rightHand.add(next.object);
    }

    updateHotbarUI(this);
  }
}
