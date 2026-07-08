// modules/render/chars.js
import { toNumber } from "./dom.js";

export const CHARACTERISTICS = [
  "Intelligence","Agility","Expression",
  "Perception","Dexterity","Cunning",
  "Will","Stamina","Presence",
  "Wits","Strength","Wisdom"
];

export function renderCharsGrid(container, npc, onNpcChanged) {
  container.innerHTML = "";

  for (const k of CHARACTERISTICS) {
    const row = document.createElement("div");
    row.className = "char-item";

    const kc = document.createElement("p");
    kc.className = "k";
    kc.textContent = k;

    const stat = document.createElement("h3");
    stat.className = "stats";
    stat.textContent = String(toNumber(npc[k]));

/*     input.addEventListener("input", () => {
      npc[k] = input.value === "" ? "" : Number(input.value);
      onNpcChanged?.(npc);
    }); */

    row.appendChild(kc);
    /* row.appendChild(stat); */
    container.appendChild(row);
  }
}
