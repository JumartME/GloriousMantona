// modules/render/modal.js
import { qs, clean } from "./dom.js";
import { kvSet, kvAppend, selectRow } from "./kv.js";
import { renderCharsGrid } from "./chars.js";
import { renderSkillsGrid } from "./skills.js";
import { ensureNpcImages, setImgForImageEntry } from "../images.js";
import { inParty, addToParty } from "../party.js";

const REP_OPTIONS = ["Player", "Friendly", "Neutral", "Hostile"];
const REL_OPTIONS = ["Recruited", "Met", "Unknown", "Imprisoned", "Defeated"];

export function openNpcModal({
  npc,
  imageResolver,
  onImageRefResolved,
  onPartyChanged,
  onNpcChanged,
}) {
  qs("modalTitle").textContent = npc.Name;
  qs("modalSubtitle").textContent =
    [npc.Species, npc.Origin, npc.Concept].filter(Boolean).join(" • ");
    console.log("NPC debug:", { name: npc?.Name, origin: npc?.Origin, imgCount: npc?._images?.length });

  // Image
    const imgEl = qs("modalImg");


    // Load image list lazily, then wire navigation
    (async () => {
    const { images, primary } = await ensureNpcImages({ npc, imageResolver, onImageRefResolved });
    let idx = Math.max(0, images.findIndex((x) => x === primary));
    if (idx < 0) idx = 0;

    async function show(i) {
        if (!images.length) {
        imgEl.removeAttribute("src");
        imgEl.classList.add("missing");
        return;
        }
        idx = ((i % images.length) + images.length) % images.length;
        await setImgForImageEntry({ imgEl, entry: images[idx], imageResolver });
    }


 

    await show(idx);
    })();


  // Description
  qs("descBox").textContent = clean(npc.Description) || "—";

  // Identity: först dropdowns, sen resten
  const identityEl = qs("kvIdentity");
  identityEl.innerHTML = "";

  identityEl.appendChild(
    selectRow({
      label: "Reputation",
      value: npc.Reputation || "Neutral",
      options: REP_OPTIONS,
      onChange: (v) => {
        npc.Reputation = v;
        onNpcChanged?.(npc);
      },
    })
  );

  identityEl.appendChild(
    selectRow({
      label: "Relation",
      value: npc.Relation || "Unknown",
      options: REL_OPTIONS,
      onChange: (v) => {
        npc.Relation = v;
        onNpcChanged?.(npc);
      },
    })
  );

  kvAppend(identityEl, [
    ["Gender", npc.Gender],
    ["Age", npc.Age],
    ["Species", npc.Species],
    ["Origin", npc.Origin],
    ["Concept", npc.Concept],
    ["Group", npc.Group],
  ]);

  // Vitals / Combat / Gear (som innan) ----BRA ATT HA KVAR SPARA!!!
/*   kvSet(qs("kvVitals"), [
    ["Size", npc.Size],
    ["Health", npc.Health],
    ["Spirit", npc.Spirit],
    ["MP", npc.MP],
  ]); */

  kvSet(qs("kvCombat"), [
    ["Magic", npc.Magic],
    ["Special", npc.Special],
    ["Healing", npc.Healing],
    ["Wpn", npc.wpn],
    ["Arm", npc.arm],
  ]);

  kvSet(qs("kvGear"), [
    ["Equipment", npc.Equipment],
    ["Weapon", npc.Weapon],
    ["Armor", npc.Armor],
    ["Shield", npc.Shield],
  ]);

  // Characteristics + Skills (editbara)
  renderCharsGrid(qs("charsGrid"), npc, onNpcChanged);
  renderSkillsGrid(qs("skillsBox"), npc, onNpcChanged);

  // Party button
  const partyBtn = qs("modalPartyBtn");
  const already = inParty(npc.id);

  partyBtn.textContent = already ? "In Party" : "Add to Party";
  partyBtn.disabled = already;
  partyBtn.className = "btn " + (already ? "btn-outline-secondary" : "btn-primary");

  partyBtn.onclick = () => {
    addToParty(npc.id);
    partyBtn.textContent = "In Party";
    partyBtn.disabled = true;
    partyBtn.className = "btn btn-outline-secondary";
    onPartyChanged?.();
  };

  bootstrap.Modal.getOrCreateInstance(qs("npcModal")).show();
}
