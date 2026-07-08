// modules/render/chars.js
import { toNumber } from "./dom.js";

export const CHARACTERISTICS = [
  "Intelligence","Agility","Expression",
  "Perception","Dexterity","Cunning",
  "Will","Stamina","Presence",
  "Wits","Strength","Wisdom"
];

export function renderCharsGrid(container, npc) {
  container.innerHTML = "";

  for (const k of CHARACTERISTICS) {
    const row = document.createElement("h6");
    row.className = "char-item ";

    const kc = document.createElement("span");
    kc.className = "k";
    kc.textContent = k;

    const stat = document.createElement("span");
    stat.className = "stats";
    stat.textContent = String(": " + toNumber(npc[k]));

    row.appendChild(kc);
    row.appendChild(stat);
    container.appendChild(row);
  }
}