import { InventoryManager } from './inventory';
import { Sword } from './items/sword';
import { Pickaxe } from './items/pickaxe';
import { Axe } from './items/axe';
import { updateHotbarUI } from './inventory-overlay';

export async function initStartingInventory(
  inv: InventoryManager,
): Promise<void> {
  const sword = await Sword.create();
  inv.inventory[0] = sword;
  inv.equipSlot(0);

  const pickaxe = await Pickaxe.create();
  inv.inventory[1] = pickaxe;
  updateHotbarUI(inv);

  const axe = await Axe.create();
  inv.inventory[2] = axe;
  updateHotbarUI(inv);
}
