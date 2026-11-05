import { DirectorioSalud, validateCoordinates } from "./model.js";
import { NominatimGeocoder } from "./geocoding.js";
import { DirectorioView } from "./view.js";

const COBIJA_CENTER = [-11.0184614, -68.7538149];

class DirectorioController {
  constructor() {
    this.view = new DirectorioView();
    this.geocoder = null;
    this.directory = null;
    this.originalData = null;
    this.selectedId = null;
    this.adminRecordId = null;
    this.mapPickActive = false;
    this.filters = { query: "", categoria: "all", servicio: "all", sector: "all" };
  }

  async start() {
    try {
      this.view.initializeMap(COBIJA_CENTER);
      const response = await fetch("./data/establecimientos.json");
      if (!response.ok) throw new Error(`El servidor respondió ${response.status} al cargar los datos.`);
      this.originalData = await response.json();
      this.directory = new DirectorioSalud(this.originalData.establecimientos);
      const records = this.directory.todos();
      this.adminRecordId = records.find((item) => this.directory.estadoUbicacion(item).estado !== "verificado")?.id
        ?? records[0]?.id;
      this.view.setServices([...new Set(records.flatMap((item) => item.servicios))].sort((a, b) => a.localeCompare(b, "es")));
      this.bindEvents();
      this.refresh();
      this.showAdminRecord();
      window.setTimeout(() => this.view.map.invalidateSize(), 100);
    } catch (error) {
      console.error("Error al iniciar Cobija Salud:", error);
      this.view.showError(error instanceof Error ? error.message : "Error inesperado.");
    }
  }

  bindEvents() {
    document.querySelector("#search-input").addEventListener("input", (event) => {
      this.filters.query = event.target.value;
      this.update();
    });
    document.querySelector("#search-button").addEventListener("click", () => {
      this.filters.query = document.querySelector("#search-input").value;
      this.update();
    });
    document.querySelector("#category-filter").addEventListener("change", (event) => {
      this.filters.categoria = event.target.value;
      this.setActiveNavigation(event.target.value);
      this.update();
    });
    document.querySelector("#service-filter").addEventListener("change", (event) => {
      this.filters.servicio = event.target.value;
      this.update();
    });
    document.querySelector("#sector-filter").addEventListener("change", (event) => {
      this.filters.sector = event.target.value;
      this.update();
    });
    document.querySelector("#clear-filters").addEventListener("click", () => this.clearFilters());
    document.querySelectorAll(".nav-link").forEach((button) => {
      button.addEventListener("click", () => {
        this.filters.categoria = button.dataset.category;
        document.querySelector("#category-filter").value = button.dataset.category;
        this.setActiveNavigation(button.dataset.category);
        this.update();
        this.closeMobileMenu();
      });
    });
    document.querySelector("#menu-toggle").addEventListener("click", () => this.toggleMobileMenu());
    document.querySelector("#geo-record-select").addEventListener("change", (event) => {
      this.adminRecordId = event.target.value;
      this.showAdminRecord();
    });
    document.querySelector("#geo-search").addEventListener("click", () => this.searchNominatim());
    document.querySelector("#geo-pick-map").addEventListener("click", () => this.toggleMapPick());
    document.querySelector("#geo-save").addEventListener("click", () => this.saveLocation());
    document.querySelector("#geo-export").addEventListener("click", () => this.exportUpdatedJson());
    document.querySelector("#geo-lat").addEventListener("input", () => this.updateOsmLink());
    document.querySelector("#geo-lon").addEventListener("input", () => this.updateOsmLink());
    document.querySelector("#geo-lat").addEventListener("input", () => { document.querySelector("#geo-confirmed").checked = false; });
    document.querySelector("#geo-lon").addEventListener("input", () => { document.querySelector("#geo-confirmed").checked = false; });
    document.querySelector("#geo-source").addEventListener("input", () => { document.querySelector("#geo-confirmed").checked = false; });
    this.view.map.on("click", (event) => this.setLocationFromMap(event));
    document.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector("#search-input").focus();
      }
      if (event.key === "Escape") {
        this.closeMobileMenu();
        this.setMapPickActive(false);
      }
    });
    window.addEventListener("resize", () => this.view.map.invalidateSize());
  }

  update() {
    const records = this.directory.todos();
    const matches = this.directory.buscar(this.filters);
    const locationState = (item) => this.directory.estadoUbicacion(item);
    this.view.setStats(this.directory.contadores(matches));
    this.view.renderResults(matches, this.selectedId, locationState, (item) => this.select(item));
    this.view.renderMarkers(matches, this.selectedId, locationState, (item) => this.select(item));
    this.view.renderLocationAudit(records, locationState, this.directory.correccionesLocales);
    this.view.renderLocationOptions(records, this.adminRecordId);
  }

  refresh() {
    this.update();
    this.showAdminRecord();
  }

  select(item) {
    this.selectedId = item.id;
    this.update();
    this.view.select(item, (record) => this.directory.estadoUbicacion(record));
  }

  clearFilters() {
    this.filters = { query: "", categoria: "all", servicio: "all", sector: "all" };
    document.querySelector("#search-input").value = "";
    document.querySelector("#category-filter").value = "all";
    document.querySelector("#service-filter").value = "all";
    document.querySelector("#sector-filter").value = "all";
    this.setActiveNavigation("all");
    this.update();
  }

  setActiveNavigation(category) {
    document.querySelectorAll(".nav-link").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.category === category);
    });
  }

  toggleMobileMenu() {
    const sidebar = document.querySelector("#sidebar");
    const button = document.querySelector("#menu-toggle");
    const open = sidebar.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(open));
  }

  closeMobileMenu() {
    document.querySelector("#sidebar").classList.remove("is-open");
    document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
  }

  showAdminRecord() {
    if (!this.adminRecordId) return;
    const record = this.directory.todos().find((item) => item.id === this.adminRecordId);
    if (!record) return;
    this.view.renderLocationOptions(this.directory.todos(), this.adminRecordId);
    this.view.showLocationRecord(record, this.directory.estadoUbicacion(record));
  }

  async searchNominatim() {
    const record = this.getAdminRecord();
    if (!record) return;
    const button = document.querySelector("#geo-search");
    button.disabled = true;
    this.view.setAdminMessage("Consultando Nominatim; cada búsqueda es manual y sus resultados no se consideran verificados…");
    try {
      if (!this.geocoder) this.geocoder = new NominatimGeocoder();
      const candidates = await this.geocoder.buscar(record);
      this.view.renderGeocodingCandidates(
        candidates,
        (candidate) => this.useCandidate(candidate),
        (candidate) => validateCoordinates({ lat: candidate.lat, lon: candidate.lon }),
      );
      if (candidates.length) {
        this.view.setAdminMessage("Resultados automáticos: comprueba nombre y dirección antes de usarlos. Se guardarán como pendientes.");
      }
    } catch (error) {
      console.error("Error al consultar Nominatim:", error);
      this.view.setAdminMessage(error instanceof Error ? error.message : "Error inesperado al consultar Nominatim.", "error");
    } finally {
      button.disabled = false;
    }
  }

  useCandidate(candidate) {
    this.view.setCoordinatesInputs(candidate.lat, candidate.lon);
    document.querySelector("#geo-source").value = candidate.fuente;
    document.querySelector("#geo-date").value = localDate();
    document.querySelector("#geo-precision").value = `Resultado automático de Nominatim (${candidate.tipo}); contraste pendiente`;
    this.view.setAdminMessage("Coordenadas copiadas como pendientes. Confirma la identidad y contrasta el punto antes de marcarlo verificado.");
  }

  toggleMapPick() {
    this.setMapPickActive(!this.mapPickActive);
    if (this.mapPickActive) {
      this.view.setAdminMessage("Haz clic en el punto confiable del mapa. El punto quedará pendiente hasta registrar fuente y confirmarlo.");
    }
  }

  setMapPickActive(active) {
    this.mapPickActive = active;
    this.view.setMapPickMode(active);
  }

  setLocationFromMap(event) {
    if (!this.mapPickActive) return;
    const { lat, lng } = event.latlng;
    const check = validateCoordinates({ lat, lon: lng });
    if (!check.valid) {
      this.view.setAdminMessage(check.reason, "error");
      return;
    }
    this.view.setCoordinatesInputs(lat, lng);
    document.querySelector("#geo-precision").value = "Punto elegido manualmente en Leaflet; pendiente de contrastar con una fuente";
    this.setMapPickActive(false);
    this.view.setAdminMessage("Punto copiado. Añade la fuente que lo respalda; no se marcará verificado automáticamente.");
  }

  saveLocation() {
    const record = this.getAdminRecord();
    if (!record) return;
    const latText = document.querySelector("#geo-lat").value.trim();
    const lonText = document.querySelector("#geo-lon").value.trim();
    const source = document.querySelector("#geo-source").value.trim();
    const date = document.querySelector("#geo-date").value;
    const precision = document.querySelector("#geo-precision").value.trim();
    if (!latText || !lonText) {
      this.view.setAdminMessage("Ingresa latitud y longitud antes de guardar.", "error");
      return;
    }
    if (!source || !date || !precision) {
      this.view.setAdminMessage("Completa la fuente, fecha y precisión conocida.", "error");
      return;
    }
    if (!Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
      this.view.setAdminMessage("La fecha de verificación no es válida.", "error");
      return;
    }
    const coordinates = { lat: Number(latText), lon: Number(lonText) };
    const validation = this.directory.validarNuevaUbicacion(record.id, coordinates);
    if (!validation.valid) {
      this.view.setAdminMessage(validation.reason, "error");
      return;
    }
    const verified = document.querySelector("#geo-confirmed").checked;
    if (verified && /pendiente|nominatim|geocodificaci[oó]n autom[aá]tica/i.test(`${source} ${precision}`)) {
      this.view.setAdminMessage("Un resultado geocodificado automáticamente no basta para verificar. Contrasta el punto con la fuente y registra esa fuente.", "error");
      return;
    }
    const correction = {
      coordenadas: coordinates,
      verificacionCoordenadas: {
        estado: verified ? "verificado" : "pendiente_verificacion",
        fuente: source,
        fecha: date,
        precision,
      },
    };
    try {
      this.directory.guardarUbicacion(record.id, correction);
      this.directory.guardarCorreccionesLocales();
      this.selectedId = record.id;
      this.refresh();
      this.view.setAdminMessage(verified
        ? "Ubicación guardada y marcada como verificada. Se conserva localmente; exporta el JSON para incorporarla al directorio."
        : "Ubicación guardada como pendiente de verificación; todavía no aparecerá como marcador.", "success");
      this.view.select(this.getAdminRecord(), (item) => this.directory.estadoUbicacion(item));
    } catch (error) {
      console.error("Error al guardar corrección local:", error);
      this.view.setAdminMessage(error instanceof Error ? error.message : "No se pudo guardar la corrección.", "error");
    }
  }

  exportUpdatedJson() {
    try {
      const data = this.directory.exportarDatos(this.originalData);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "establecimientos-actualizado.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.view.setAdminMessage("JSON actualizado descargado. Sustituye el archivo del directorio solo después de revisar los cambios.", "success");
    } catch (error) {
      console.error("Error al exportar JSON:", error);
      this.view.setAdminMessage(error instanceof Error ? error.message : "No se pudo exportar el JSON.", "error");
    }
  }

  updateOsmLink() {
    const lat = Number(document.querySelector("#geo-lat").value);
    const lon = Number(document.querySelector("#geo-lon").value);
    this.view.setOpenOsmLink(
      validateCoordinates({ lat, lon }).valid ? { lat, lon } : null,
      this.getAdminRecord(),
    );
  }

  getAdminRecord() {
    return this.directory.todos().find((item) => item.id === this.adminRecordId) ?? null;
  }
}

function localDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

new DirectorioController().start();
