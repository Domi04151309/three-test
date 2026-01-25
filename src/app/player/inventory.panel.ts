import {
  createHotbarPreview,
  disposeHotbarPreview,
  HotbarPreviewEntry,
} from './hotbar.preview';
import type { InventoryManager } from './inventory.manager';
import { updateInventoryOverlay, updateHotbarUI } from './inventory.overlay';

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

  const title = document.createElement('div');
  title.id = 'inventory-title';
  title.textContent = 'Inventory';

  const mainGrid = document.createElement('ul');
  mainGrid.id = 'inventory-grid';
  mainGrid.classList.add('inventory-grid');

  for (let index = 9; index < manager.inventory.length; index++) {
    const li = document.createElement('li');
    li.classList.add('slot');
    li.dataset.slot = String(index);
    li.classList.add('inventory-slot');

    li.addEventListener('click', (event) => {
      event.stopPropagation();
      handleInventorySlotClick(manager, index);
    });

    mainGrid.append(li);
  }

  const hotbarWrap = document.createElement('ul');
  hotbarWrap.id = 'inventory-hotbar';
  hotbarWrap.classList.add('inventory-hotbar');
  for (let index = 0; index < 9; index++) {
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

  overlay.append(title, mainGrid, hotbarWrap);
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
    let restoredIndex =
      manager.draggingFromIndex !== null && manager.draggingFromIndex >= 0
        ? manager.draggingFromIndex
        : manager.inventory.indexOf(null);
    if (restoredIndex === -1) {
      if (manager.draggingFromIndex !== null)
        manager.inventory[manager.draggingFromIndex] = manager.draggingItem;
      restoredIndex = manager.draggingFromIndex ?? -1;
    } else {
      manager.inventory[restoredIndex] = manager.draggingItem;
    }
    if (restoredIndex !== -1 && restoredIndex === manager.currentSlot) {
      manager.equipSlot(restoredIndex);
    }
    manager.draggingItem = null;
    manager.draggingFromIndex = null;
  }

  if (manager.inventoryOverlay) {
    const slotElements =
      manager.inventoryOverlay.querySelectorAll('.inventory-slot');
    for (const li of slotElements) {
      const slotElement = li as HTMLElement & {
        preview?: HotbarPreviewEntry | null;
      };
      const { preview } = slotElement;
      if (preview) disposeHotbarPreview(preview);
      slotElement.preview = null;
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
    manager.draggingPreview = createHotbarPreview(manager.draggingItem, 64);
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
    if (manager.currentSlot === index) {
      const currentlyEquipped = manager.inventory[manager.currentSlot];
      if (
        currentlyEquipped &&
        currentlyEquipped.object &&
        currentlyEquipped.object.parent === manager.rightHand
      ) {
        manager.rightHand.remove(currentlyEquipped.object);
      }
    }
    manager.inventory[index] = manager.draggingItem;
    manager.draggingItem = null;
    manager.draggingFromIndex = null;
    if (manager.draggingPreview) {
      disposeHotbarPreview(manager.draggingPreview);
      manager.draggingPreview = null;
    }
    if (manager.currentSlot === index) manager.equipSlot(index);
    updateInventoryOverlay(manager);
    updateHotbarUI(manager);
    return;
  }

  if (
    manager.currentSlot === index &&
    target.object &&
    target.object.parent === manager.rightHand
  ) {
    manager.rightHand.remove(target.object);
  }
  manager.inventory[index] = manager.draggingItem;
  const updatedDragging = target;
  manager.draggingItem = updatedDragging;
  if (manager.draggingPreview) {
    disposeHotbarPreview(manager.draggingPreview);
    manager.draggingPreview = null;
  }

  manager.draggingPreview = createHotbarPreview(manager.draggingItem, 64);
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
  if (manager.currentSlot === index) manager.equipSlot(index);
}
