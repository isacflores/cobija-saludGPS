import { normalize } from "./model.js";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CACHE_KEY = "cobija-salud-nominatim-cache-v1";
const MIN_REQUEST_GAP_MS = 1100;

export class NominatimGeocoder {
  #lastRequestAt = 0;
  #cache;

  constructor() {
    this.#cache = this.#readCache();
  }

  async buscar(establecimiento) {
    const city = "Cobija, Pando, Bolivia";
    const queries = [
      [establecimiento.nombre, establecimiento.direccion, city].filter(Boolean).join(", "),
      [establecimiento.nombre, city].filter(Boolean).join(", "),
      [establecimiento.direccion, city].filter(Boolean).join(", "),
    ];
    for (const query of [...new Set(queries)]) {
      const candidates = await this.#search(query);
      if (candidates.length) return candidates;
    }
    return [];
  }

  async #search(query) {
    const key = normalize(query);
    if (Object.prototype.hasOwnProperty.call(this.#cache, key)) return this.#cache[key];

    const elapsed = Date.now() - this.#lastRequestAt;
    if (elapsed < MIN_REQUEST_GAP_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, MIN_REQUEST_GAP_MS - elapsed));
    }

    const url = new URL(NOMINATIM_ENDPOINT);
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
    }).toString();

    this.#lastRequestAt = Date.now();
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    if (!response.ok) throw new Error(`Nominatim respondió ${response.status}.`);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error("Nominatim devolvió una respuesta inesperada.");

    const candidates = results.map((result) => ({
      lat: Number(result.lat),
      lon: Number(result.lon),
      nombre: result.name || result.display_name?.split(",")[0] || query,
      direccion: result.display_name,
      tipo: `${result.category ?? result.class ?? "lugar"} · ${result.type ?? "sin tipo"}`,
      osmType: result.osm_type,
      osmId: result.osm_id,
      fuente: "Nominatim / OpenStreetMap (resultado automático; pendiente de verificación)",
    }));

    this.#cache[key] = candidates;
    this.#writeCache();
    return candidates;
  }

  #readCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("La caché de geocodificación tiene un formato inválido.");
    }
    return parsed;
  }

  #writeCache() {
    const entries = Object.entries(this.#cache).slice(-100);
    this.#cache = Object.fromEntries(entries);
    localStorage.setItem(CACHE_KEY, JSON.stringify(this.#cache));
  }
}
