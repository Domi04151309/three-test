import {
  createHotbarPreview,
  disposeHotbarPreview,
  HotbarPreviewEntry,
} from './hotbar-preview';
import type { InventoryManager } from './inventory';

export function openInventory(manager: InventoryManager): void {
  if (manager.inventoryOpen) return;
  manager.inventoryOpen = true;

  const controlsAny = manager.controls as unknown as { isLocked?: boolean };
  manager.pointerWasLocked = Boolean(controlsAny.isLocked);
  const blockerElement = document.getElementById('blocker');
  if (blockerElement) {
    const style = globalThis.getComputedStyle(blockerElement);
    manager.blockerWasVisible = style.display !== 'none';
  } else {
    manager.blockerWasVisible = false;
  }
  if (manager.pointerWasLocked) manager.controls.unlock();

  const instructionsElement = document.getElementById('instructions');
  if (instructionsElement) {
    const style = globalThis.getComputedStyle(instructionsElement);
    manager.instructionsWasVisible = style.display !== 'none';
    instructionsElement.style.display = 'none';
  } else {
    manager.instructionsWasVisible = false;
  }

  const overlay = document.createElement('div');
  overlay.id = 'inventory-overlay';
  overlay.classList.add('inventory-overlay');

  const hotbarWrap = document.createElement('ul');
  hotbarWrap.id = 'inventory-hotbar';
  hotbarWrap.classList.add('inventory-hotbar');

  for (let index = 0; index < manager.inventory.length; index++) {
    const li = document.createElement('li');
    li.classList.add('slot');
    li.dataset.slot = String(index);
    li.classList.add('inventory-slot');

    li.addEventListener('click', (event) => {
      event.stopPropagation();
      handleInventorySlotClick(manager, index);
    });

    hotbarWrap.append(li);
  }

  overlay.append(hotbarWrap);
  document.body.append(overlay);
  manager.inventoryOverlay = overlay;

  manager.onMouseMoveForDrag = (event: MouseEvent) => {
    if (!manager.draggingPreview) return;
    const element = manager.draggingPreview.canvas;
    if (!element.classList.contains('dragging-preview'))
      element.classList.add('dragging-preview');
    element.style.left = `${String(event.clientX)}px`;
    element.style.top = `${String(event.clientY)}px`;
  };
  document.addEventListener(
    'mousemove',
    manager.onMouseMoveForDrag as unknown as EventListener,
  );

  updateInventoryOverlay(manager);
}

export function closeInventory(manager: InventoryManager): void {
  if (!manager.inventoryOpen) return;
  manager.inventoryOpen = false;

  if (manager.draggingItem) {
    const index =
      manager.draggingFromIndex !== null && manager.draggingFromIndex >= 0
        ? manager.draggingFromIndex
        : manager.inventory.indexOf(null);
    if (index === -1) {
      if (manager.draggingFromIndex !== null)
        manager.inventory[manager.draggingFromIndex] = manager.draggingItem;
    } else {
      manager.inventory[index] = manager.draggingItem;
    }
    manager.draggingItem = null;
    manager.draggingFromIndex = null;
  }

  if (manager.inventoryOverlay) {
    const hotbarWrap =
      manager.inventoryOverlay.querySelector('#inventory-hotbar');
    if (hotbarWrap) {
      const children = [...hotbarWrap.children];
      for (const li of children) {
        const slotElement = li as HTMLElement & {
          preview?: HotbarPreviewEntry | null;
        };
        const { preview } = slotElement;
        if (preview) disposeHotbarPreview(preview);
        slotElement.preview = null;
      }
    }
    manager.inventoryOverlay.remove();
    manager.inventoryOverlay = null;
  }
  if (manager.draggingPreview) {
    disposeHotbarPreview(manager.draggingPreview);
    manager.draggingPreview = null;
  }
  if (manager.onMouseMoveForDrag) {
    document.removeEventListener('mousemove', manager.onMouseMoveForDrag);
    manager.onMouseMoveForDrag = null;
  }

  document.body.classList.remove('inventory-open');

  const instructionsElement = document.getElementById('instructions');
  if (instructionsElement) {
    instructionsElement.style.display = manager.instructionsWasVisible
      ? 'block'
      : 'none';
  }
  if (manager.pointerWasLocked) {
    manager.controls.lock();
  }
  manager.pointerWasLocked = false;
  manager.blockerWasVisible = false;
  manager.instructionsWasVisible = false;

  updateHotbarUI(manager);
}

export function handleInventorySlotClick(
  manager: InventoryManager,
  index: number,
): void {
  if (!manager.draggingItem) {
    const item = manager.inventory[index];
    if (!item) return;
    if (
      manager.currentSlot === index &&
      item.object &&
      item.object.parent === manager.rightHand
    ) {
      manager.rightHand.remove(item.object);
    }
    manager.draggingItem = item;
    manager.draggingFromIndex = index;
    manager.inventory[index] = null;
    updateInventoryOverlay(manager);
    updateHotbarUI(manager);
    if (manager.draggingPreview) {
      disposeHotbarPreview(manager.draggingPreview);
      manager.draggingPreview = null;
    }
    manager.draggingPreview = createHotbarPreview(manager.draggingItem, 96);
    const { canvas } = manager.draggingPreview;
    Object.assign(canvas.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '10000',
      transform: 'translate(-50%, -50%)',
    } as Record<string, string>);
    document.body.append(canvas);
    return;
  }

  const target = manager.inventory[index];
  if (!target) {
    manager.inventory[index] = manager.draggingItem;
    manager.draggingItem = null;
    manager.draggingFromIndex = null;
    if (manager.draggingPreview) {
      disposeHotbarPreview(manager.draggingPreview);
      manager.draggingPreview = null;
    }
    updateInventoryOverlay(manager);
    updateHotbarUI(manager);
    return;
  }

  manager.inventory[index] = manager.draggingItem;
  const updatedDragging = target;
  manager.draggingItem = updatedDragging;
  if (manager.draggingPreview) {
    disposeHotbarPreview(manager.draggingPreview);
    manager.draggingPreview = null;
  }

  manager.draggingPreview = createHotbarPreview(manager.draggingItem, 96);
  const { canvas } = manager.draggingPreview;
  Object.assign(canvas.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '10000',
    transform: 'translate(-50%, -50%)',
  } as Record<string, string>);
  document.body.append(canvas);

  updateInventoryOverlay(manager);
  updateHotbarUI(manager);
}

export function updateInventoryOverlay(manager: InventoryManager): void {
  if (!manager.inventoryOverlay) return;
  const hotbarWrap =
    manager.inventoryOverlay.querySelector('#inventory-hotbar');
  if (!hotbarWrap) return;
  const children = [...hotbarWrap.children];
  for (const [index, li] of children.entries()) {
    const slotElement = li as HTMLElement & {
      preview?: HotbarPreviewEntry | null;
    };
    const old = slotElement.querySelector('canvas');
    if (old) old.remove();
    const item = manager.inventory[index];
    if (item && item.object) {
      const entry = createHotbarPreview(item, 96);
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
