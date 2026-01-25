import type { Player } from './player.entity';
import {
  updateHealthUI,
  updateStaminaUI,
  setupPointerLockUI,
  handleDeath as uiHandleDeath,
} from './player.hud';

export function takeDamage(player: Player, amount: number): void {
  const dmg = Math.abs(amount);
  player.health = Math.max(0, player.health - dmg);
  updateHealthUI(
    player.health,
    player.maxHealth,
    player.healthFillElement,
    player.healthTextElement,
  );
  if (player.health <= 0) uiHandleDeath(player.controls, player.blocker);
}

export function heal(player: Player, amount: number): void {
  const value = Math.abs(amount);
  player.health = Math.min(player.maxHealth, player.health + value);
  updateHealthUI(
    player.health,
    player.maxHealth,
    player.healthFillElement,
    player.healthTextElement,
  );
}

export function setHealth(player: Player, value: number): void {
  player.health = Math.max(0, Math.min(player.maxHealth, value));
  updateHealthUI(
    player.health,
    player.maxHealth,
    player.healthFillElement,
    player.healthTextElement,
  );
  if (player.health <= 0) uiHandleDeath(player.controls, player.blocker);
}

export function setStamina(player: Player, value: number): void {
  player.stamina = Math.max(0, Math.min(player.maxStamina, value));
  updateStaminaUI(
    player.stamina,
    player.maxStamina,
    player.staminaFillElement,
    player.staminaTextElement,
  );
}

export function enablePointerLockUI(
  player: Player,
  blocker: HTMLElement | null,
  instructions: HTMLElement | null,
): void {
  player.blocker = blocker;
  setupPointerLockUI(player.controls, blocker, instructions);
}
