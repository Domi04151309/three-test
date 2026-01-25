import {
  createHotbarPreview,
  disposeHotbarPreview,
  HotbarPreviewEntry,
} from './hotbar.preview';
import type { InventoryManager } from './inventory.manager';

export function updateInventoryOverlay(manager: InventoryManager): void {
  if (!manager.inventoryOverlay) return;
  const slotElements =
    manager.inventoryOverlay.querySelectorAll('.inventory-slot');
  for (const element of slotElements) {
    const slotElement = element as HTMLElement & {
      preview?: HotbarPreviewEntry | null;
    };
    const old = slotElement.querySelector('canvas');
    if (old) old.remove();
    const index = Number(slotElement.dataset.slot);
    const item = manager.inventory[index];
    if (item && item.object) {
      const entry = createHotbarPreview(item, 64);
      slotElement.append(entry.canvas);
      slotElement.preview = entry;
    } else if (slotElement.preview) {
      const { preview } = slotElement;
      disposeHotbarPreview(preview);
      slotElement.preview = null;
    }
    slotElement.classList.toggle('selected', index === manager.currentSlot);
  }
}

export function updateHotbarUI(manager: InventoryManager): void {
  const hotbar = document.getElementById('hotbar');
  if (!hotbar) return;
  const children = hotbar.querySelectorAll('.slot');
  for (const [index, element] of children.entries()) {
    element.classList.toggle('selected', index === manager.currentSlot);
    const item = manager.inventory[index];
    if (item && item.object) {
      const existing = manager.hotbarRenderers[index];
      if (!existing || existing.object !== item.object) {
        if (existing) disposeHotbarPreview(existing);
        const entry = createHotbarPreview(item);
        const old = (element as HTMLElement).querySelector('canvas');
        if (old) old.remove();
        (element as HTMLElement).append(entry.canvas);
        manager.hotbarRenderers[index] = entry;
      }
    } else if (manager.hotbarRenderers[index]) {
      const entry = manager.hotbarRenderers[index];
      disposeHotbarPreview(entry);
      manager.hotbarRenderers[index] = null;
    }
  }
}
