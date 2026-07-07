// modules/localFolder.js
// Läser från:
//  - en enskild vald data.xlsx-fil (File System Access API: showOpenFilePicker)
//  - valfritt: en separat vald Img-mapp (File System Access API: showDirectoryPicker)
//    <ImgRoot>/<Origin>/<Name>*.jpg|.jpeg|.png

import { imageNameCandidates, matchImageFileNames } from "./images.js";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png"];

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

async function findChildDir(parentHandle, wantedNameLower) {
  const wanted = norm(wantedNameLower);
  for await (const [name, handle] of parentHandle.entries()) {
    if (handle.kind === "directory" && norm(name) === wanted) {
      return handle; // matchar Img / img / IMG
    }
  }
  return null;
}

// Case-insensitive lookup av en fil i en directory
async function findFileCaseInsensitive(dirHandle, fileName) {
  const wanted = norm(fileName);
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "file" && norm(name) === wanted) return handle;
  }
  return null;
}

// Case-insensitive lookup av subfolder (Origin)
async function findDirCaseInsensitive(dirHandle, folderName) {
  const wanted = norm(folderName);
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === "directory" && norm(name) === wanted) return handle;
  }
  return null;
}

// ---------------------------------------------------------------------------
// NYTT: Plocka en enskild Excel-fil istället för en mapp
// ---------------------------------------------------------------------------
export async function pickLocalXlsxFile() {
  if (!window.showOpenFilePicker) {
    throw new Error(
      "Din browser stödjer inte file picker (showOpenFilePicker). Kör i Chromium-baserad browser."
    );
  }
  const [fileHandle] = await window.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: false,
    types: [
      {
        description: "Excel-filer",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
        },
      },
    ],
  });
  return fileHandle;
}

// Fortfarande kvar om ni vill erbjuda mappval på andra ställen
export async function pickLocalRootFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error(
      "Din browser stödjer inte folder picker (showDirectoryPicker). Kör i Chromium-baserad browser."
    );
  }
  return await window.showDirectoryPicker({ mode: "read" });
}

// Valfri separat Img-mapp (frågas efter EFTER Excel-filvalet)
export async function pickLocalImgFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error(
      "Din browser stödjer inte folder picker (showDirectoryPicker). Kör i Chromium-baserad browser."
    );
  }
  return await window.showDirectoryPicker({ mode: "read" });
}

// ---------------------------------------------------------------------------
// NYTT: Ladda bundle utifrån en filhandle (Excel) + valfri imgRootHandle
// ---------------------------------------------------------------------------
export async function loadBundleFromLocalFile({
  fileHandle,
  imgRootHandle = null, // valfri: DirectoryHandle till Img-roten
  parseXlsxBuffer,
  rowsToJson,
  setStatus = null,
} = {}) {
  if (!fileHandle) throw new Error("Missing fileHandle.");
  if (!parseXlsxBuffer) throw new Error("Missing parseXlsxBuffer.");
  if (!rowsToJson) throw new Error("Missing rowsToJson.");

  setStatus?.("Läser vald Excel-fil…");
  const file = await fileHandle.getFile();
  const buf = await file.arrayBuffer();

  setStatus?.("Tolkar Excel…");
  const rows = await parseXlsxBuffer(buf);
  const json = rowsToJson(rows);

  let imageResolver = null;
  if (imgRootHandle) {
    imageResolver = createLocalFolderImageResolver({ imgRootHandle });
  } else {
    setStatus?.(`Laddade ${json.count ?? "?"} NPCs (utan bilder) ✔`);
  }

  return { json, imageResolver, fileHandle, imgRootHandle };
}

// Behålls oförändrad för bakåtkompatibilitet (mappval av HELA roten inkl. data.xlsx + Img)
export async function loadBundleFromLocalFolder({
  rootHandle,
  parseXlsxBuffer,
  rowsToJson,
  setStatus = null,
} = {}) {
  if (!rootHandle) throw new Error("Missing rootHandle.");
  if (!parseXlsxBuffer) throw new Error("Missing parseXlsxBuffer.");
  if (!rowsToJson) throw new Error("Missing rowsToJson.");

  setStatus?.("Letar efter data.xlsx…");
  const xlsxHandle = await findChildDir(rootHandle, "data.xlsx"); // obs: bug i original, se not nedan
  if (!xlsxHandle) throw new Error("Hittar ingen data.xlsx i vald mapp.");

  setStatus?.('Letar efter "Img/img"-mapp…');
  let imgHandle = await findChildDir(rootHandle, "img");
  if (!imgHandle) {
    throw new Error('Hittar ingen "Img/img"-mapp i vald mapp. (Den måste ligga direkt under root.)');
  }

  setStatus?.("Läser data.xlsx…");
  const file = await xlsxHandle.getFile();
  const buf = await file.arrayBuffer();

  setStatus?.("Tolkar Excel…");
  const rows = await parseXlsxBuffer(buf);
  const json = rowsToJson(rows);

  const imageResolver = createLocalFolderImageResolver({ imgRootHandle: imgHandle });
  return { json, imageResolver, rootHandle, imgHandle };
}

export function createLocalFolderImageResolver({ imgRootHandle }) {
  // Cache origin -> DirectoryHandle
  const originDirCache = new Map();
  // Cache origin -> ["Alden.png", ...]
  const originFileListCache = new Map();
  // Cache origin|filename -> objectUrl
  const urlCache = new Map();

  async function getOriginDir(origin) {
    const key = norm(origin);
    if (originDirCache.has(key)) return originDirCache.get(key);

    const dir = await findDirCaseInsensitive(imgRootHandle, origin);
    originDirCache.set(key, dir || null);
    return dir || null;
  }

  async function getOriginFileList(origin) {
    const key = norm(origin);
    if (originFileListCache.has(key)) return originFileListCache.get(key);

    const originDir = await getOriginDir(origin);
    if (!originDir) {
      originFileListCache.set(key, []);
      return [];
    }

    const files = [];
    for await (const [name, handle] of originDir.entries()) {
      if (handle.kind !== "file") continue;
      if (!IMAGE_EXTS.some((ext) => norm(name).endsWith(ext))) continue;
      files.push(name);
    }
    originFileListCache.set(key, files);
    return files;
  }

  // ✅ Multi-image: returnerar ALLA matchande URLs (primary först)
  async function getNpcImageUrls(origin, npcName) {
    const originDir = await getOriginDir(origin);
    if (!originDir) return [];

    const fileNames = await getOriginFileList(origin);
    const matches = matchImageFileNames(fileNames, npcName); // sorterade primary->varianter

    const urls = [];
    for (const fn of matches) {
      const cacheKey = `${norm(origin)}|${norm(fn)}`;
      if (urlCache.has(cacheKey)) {
        urls.push(urlCache.get(cacheKey));
        continue;
      }
      const fh = await findFileCaseInsensitive(originDir, fn);
      if (!fh) continue;
      const f = await fh.getFile();
      const url = URL.createObjectURL(f);
      urlCache.set(cacheKey, url);
      urls.push(url);
    }

    // Fallback: gamla namngissningen (för bakåtkomp)
    if (!urls.length) {
      const names = imageNameCandidates(npcName);
      for (const name of names) {
        for (const ext of IMAGE_EXTS) {
          const filename = `${name}${ext}`;
          const cacheKey = `${norm(origin)}|${norm(filename)}`;
          if (urlCache.has(cacheKey)) return [urlCache.get(cacheKey)];

          const fh = await findFileCaseInsensitive(originDir, filename);
          if (!fh) continue;

          const f = await fh.getFile();
          const url = URL.createObjectURL(f);
          urlCache.set(cacheKey, url);
          return [url];
        }
      }
    }

    return urls;
  }

  // Back-compat (primary only)
  async function getNpcImageUrl(origin, npcName) {
    const urls = await getNpcImageUrls(origin, npcName);
    return urls[0] || null;
  }

  function revokeAll() {
    for (const url of urlCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    urlCache.clear();
    originDirCache.clear();
    originFileListCache.clear();
  }

  return { getNpcImageUrls, getNpcImageUrl, revokeAll, kind: "local-folder" };
}