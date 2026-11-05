const CATEGORY_LABELS = {
  farmacia: "Farmacia",
  clinica: "Clínica / centro médico",
  laboratorio: "Laboratorio",
  ecografia: "Ecografía",
};

const COBIJA_BOUNDS = {
  south: -11.15,
  north: -10.9,
  west: -68.9,
  east: -68.65,
};

const LOCATION_STORAGE_KEY = "cobija-salud-location-overrides-v1";
const COBIJA_CITY_CENTER = { lat: -11.0184614, lon: -68.7538149 };

export class Establecimiento {
  constructor(data) {
    Object.assign(this, data);
    this.categorias = Array.isArray(data.categorias) ? data.categorias : [];
    this.servicios = Array.isArray(data.servicios) ? data.servicios : [];
    this.coordenadas = data.coordenadas ?? null;
  }

  get tieneUbicacion() {
    return Number.isFinite(this.coordenadas?.lat) && Number.isFinite(this.coordenadas?.lon);
  }

  coincide(query) {
    const needle = normalize(query);
    if (!needle) return true;
    const searchable = [
      this.nombre,
      this.direccion,
      ...this.servicios,
      ...this.categorias.map((category) => CATEGORY_LABELS[category] ?? category),
    ].join(" ");
    return normalize(searchable).includes(needle);
  }
}

export class Farmacia extends Establecimiento {
  constructor(data) {
    super(data);
    this.esFarmacia = true;
  }
}

export class DirectorioSalud {
  #establecimientos;
  #locationOverrides;

  constructor(records) {
    const overrides = loadLocationOverrides();
    this.#locationOverrides = overrides;
    this.#establecimientos = records.map((record) => {
      const merged = overrides[record.id]
        ? { ...record, ...overrides[record.id] }
        : record;
      return merged.categorias?.includes("farmacia")
        ? new Farmacia(merged)
        : new Establecimiento(merged);
    });
  }

  todos() {
    return [...this.#establecimientos];
  }

  buscar({ query = "", categoria = "all", servicio = "all", sector = "all" } = {}) {
    return this.#establecimientos.filter((item) =>
      item.coincide(query)
      && (categoria === "all" || item.categorias.includes(categoria))
      && (servicio === "all" || item.servicios.some((value) => normalize(value) === normalize(servicio)))
      && (sector === "all" || item.sector === sector),
    );
  }

  contadores(items = this.#establecimientos) {
    return {
      total: items.length,
      farmacia: countCategory(items, "farmacia"),
      clinica: countCategory(items, "clinica"),
      laboratorio: countCategory(items, "laboratorio"),
      ecografia: countCategory(items, "ecografia"),
    };
  }

  get correccionesLocales() {
    return Object.keys(this.#locationOverrides).length;
  }

  estadoUbicacion(item) {
    const coordinateCheck = validateCoordinates(item.coordenadas);
    if (!coordinateCheck.valid) {
      return {
        estado: item.coordenadas || item.direccion ? "pendiente_verificacion" : "no_disponible",
        detalle: item.coordenadas
          ? coordinateCheck.reason
          : item.direccion
            ? "Hay una dirección publicada, pero el punto exacto no está confirmado."
            : "No hay coordenadas ni dirección suficiente.",
      };
    }

    const duplicates = this.#establecimientos.filter((other) =>
      other.id !== item.id
      && validateCoordinates(other.coordenadas).valid
      && other.coordenadas.lat === item.coordenadas.lat
      && other.coordenadas.lon === item.coordenadas.lon,
    );
    if (duplicates.length) {
      return {
        estado: "pendiente_verificacion",
        detalle: `Coordenada compartida con ${duplicates.map((other) => other.nombre).join(", ")}.`,
      };
    }

    const verification = item.verificacionCoordenadas;
    if (
      verification?.estado === "verificado"
      && typeof verification.fuente === "string"
      && verification.fuente.trim()
      && isValidDate(verification.fecha)
      && typeof verification.precision === "string"
      && verification.precision.trim()
    ) {
      return { estado: "verificado", detalle: verification.precision };
    }

    return {
      estado: item.tieneUbicacion ? "pendiente_verificacion" : "no_disponible",
      detalle: verification?.precision || "Coordenadas sin fuente y verificación completas.",
    };
  }

  validarNuevaUbicacion(id, coordinates) {
    const candidate = validateCoordinates(coordinates);
    if (!candidate.valid) return candidate;
    const duplicate = this.#establecimientos.find((item) =>
      item.id !== id
      && validateCoordinates(item.coordenadas).valid
      && item.coordenadas.lat === coordinates.lat
      && item.coordenadas.lon === coordinates.lon,
    );
    if (duplicate) {
      return { valid: false, reason: `Las coordenadas ya están asignadas a ${duplicate.nombre}.` };
    }
    return { valid: true, reason: "" };
  }

  guardarUbicacion(id, correction) {
    const item = this.#establecimientos.find((record) => record.id === id);
    if (!item) throw new Error("No se encontró el establecimiento seleccionado.");
    const validation = this.validarNuevaUbicacion(id, correction.coordenadas);
    if (!validation.valid) throw new Error(validation.reason);
    const verification = correction.verificacionCoordenadas;
    if (
      !["verificado", "pendiente_verificacion"].includes(verification?.estado)
      || typeof verification.fuente !== "string"
      || !verification.fuente.trim()
      || !isValidDate(verification.fecha)
      || typeof verification.precision !== "string"
      || !verification.precision.trim()
    ) {
      throw new Error("La verificación debe incluir estado, fuente, fecha y precisión.");
    }

    item.coordenadas = {
      lat: correction.coordenadas.lat,
      lon: correction.coordenadas.lon,
    };
    item.verificacionCoordenadas = { ...verification };
    this.#locationOverrides[id] = {
      coordenadas: item.coordenadas,
      verificacionCoordenadas: item.verificacionCoordenadas,
    };
  }

  guardarCorreccionesLocales() {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(this.#locationOverrides));
  }

  exportarDatos(originalData) {
    return {
      ...originalData,
      establecimientos: originalData.establecimientos.map((record) => {
        const current = this.#establecimientos.find((item) => item.id === record.id);
        return current
          ? {
            ...record,
            coordenadas: current.coordenadas,
            verificacionCoordenadas: current.verificacionCoordenadas ?? null,
          }
          : record;
      }),
    };
  }
}

export function validateCoordinates(coordinates) {
  if (
    !coordinates
    || !Number.isFinite(coordinates.lat)
    || !Number.isFinite(coordinates.lon)
  ) {
    return { valid: false, reason: "Latitud y longitud deben ser números válidos." };
  }
  if (
    coordinates.lat < COBIJA_BOUNDS.south
    || coordinates.lat > COBIJA_BOUNDS.north
    || coordinates.lon < COBIJA_BOUNDS.west
    || coordinates.lon > COBIJA_BOUNDS.east
  ) {
    return { valid: false, reason: "El punto queda fuera del área de control de Cobija." };
  }
  if (
    coordinates.lat === COBIJA_CITY_CENTER.lat
    && coordinates.lon === COBIJA_CITY_CENTER.lon
  ) {
    return { valid: false, reason: "El centro de Cobija no puede usarse como ubicación de un establecimiento." };
  }
  return { valid: true, reason: "" };
}

export function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function countCategory(items, category) {
  return items.filter((item) => item.categorias.includes(category)).length;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function loadLocationOverrides() {
  const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
  if (!saved) return {};
  const parsed = JSON.parse(saved);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Las correcciones locales de ubicaciones tienen un formato inválido.");
  }
  return parsed;
}
