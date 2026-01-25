import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

export function updateHealthUI(
  health: number,
  maxHealth: number,
  healthFillElement: HTMLElement | null,
  healthTextElement: HTMLElement | null,
): void {
  if (healthFillElement) {
    const percentage = (health / maxHealth) * 100;
    healthFillElement.style.width = `${percentage.toString()}%`;
  }
  if (healthTextElement) {
    healthTextElement.textContent = `${Math.round(health).toString()} / ${maxHealth.toString()}`;
  }
}

export function updateStaminaUI(
  stamina: number,
  maxStamina: number,
  staminaFillElement: HTMLElement | null,
  staminaTextElement: HTMLElement | null,
): void {
  if (staminaFillElement) {
    const percentage = (stamina / maxStamina) * 100;
    staminaFillElement.style.width = `${percentage.toString()}%`;
  }
  if (staminaTextElement) {
    staminaTextElement.textContent = `${Math.round(stamina).toString()} / ${maxStamina.toString()}`;
  }
}

export function setupPointerLockUI(
  controls: PointerLockControls,
  blocker: HTMLElement | null,
  instructions: HTMLElement | null,
): void {
  if (instructions)
    instructions.addEventListener('click', () => {
      controls.lock();
    });

  controls.addEventListener('lock', () => {
    if (blocker) blocker.style.display = 'none';
  });

  controls.addEventListener('unlock', () => {
    if (blocker) blocker.style.display = 'flex';
  });
}

export function handleDeath(
  controls: PointerLockControls,
  blocker: HTMLElement | null,
): void {
  console.log('Player died');
  controls.unlock();
  if (blocker) blocker.style.display = 'flex';
}
