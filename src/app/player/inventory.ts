import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { Item } from './items/item';
import type { HotbarPreviewEntry } from './hotbar-preview';
import { updateHotbarUI } from './inventory-overlay';
import { closeInventory, openInventory } from './inventory-ui';

interface InventoryHost {
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
}
export class InventoryManager {
  host: InventoryHost;
  controls: PointerLockControls;
  rightHand: THREE.Mesh;
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

  equipSlot(index: number): void {
    if (index < 0 || index >= this.inventory.length) return;
    if (this.currentSlot !== -1) {
      const current = this.inventory[this.currentSlot];
      if (current && current.object && current.object.parent === this.rightHand)
        this.rightHand.remove(current.object);
    }

    this.currentSlot = index;

    const next = this.inventory[this.currentSlot];
    if (next && next.object) this.rightHand.add(next.object);

    updateHotbarUI(this);
  }
}
