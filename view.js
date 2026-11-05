const CATEGORY_NAMES = {
  farmacia: "Farmacia",
  hospital: "Hospital",
  clinica: "Clínica",
  laboratorio: "Laboratorio",
  ecografia: "Ecografía",
};

const CATEGORY_COLORS = {
  farmacia: "#18a66c",
  hospital: "#dc4f55",
  clinica: "#7862df",
  laboratorio: "#dc7d31",
  ecografia: "#199cac",
};

export class DirectorioView {
  constructor() {
    this.elements = {
      service: document.querySelector("#service-filter"),
      list: document.querySelector("#results-list"),
      resultCount: document.querySelector("#result-count"),
      mappedCount: document.querySelector("#mapped-count"),
      mapSelectionStatus: document.querySelector("#map-selection-status"),
      detailTitle: document.querySelector("#detail-title"),
      detailDescription: document.querySelector("#detail-description"),
      detailAddress: document.querySelector("#detail-address"),
      detailServices: document.querySelector("#detail-services"),
      detailPhone: document.querySelector("#detail-phone"),
      detailHours: document.querySelector("#detail-hours"),
      detailSource: document.querySelector("#detail-source"),
      detailSourceLink: document.querySelector("#detail-source-link"),
      geoAuditSummary: document.querySelector("#geo-audit-summary"),
      geoRecordSelect: document.querySelector("#geo-record-select"),
      geoRecordMeta: document.querySelector("#geo-record-meta"),
      geoCandidates: document.querySelector("#geo-candidates"),
      geoAdminMessage: document.querySelector("#geo-admin-message"),
      geoLat: document.querySelector("#geo-lat"),
      geoLon: document.querySelector("#geo-lon"),
      geoSource: document.querySelector("#geo-source"),
      geoDate: document.querySelector("#geo-date"),
      geoPrecision: document.querySelector("#geo-precision"),
      geoConfirmed: document.querySelector("#geo-confirmed"),
      geoPickMap: document.querySelector("#geo-pick-map"),
      geoOpenOsm: document.querySelector("#geo-open-osm"),
    };
    this.map = null;
    this.mapCenter = null;
    this.markerLayer = null;
    this.markers = new Map();
  }

  initializeMap(center) {
    if (!window.L) throw new Error("No se pudo cargar Leaflet. Comprueba tu conexión e inténtalo de nuevo.");
    this.mapCenter = center;
    this.map = L.map("map", { scrollWheelZoom: false }).setView(center, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(this.map);
    this.markerLayer = L.markerClusterGroup
      ? L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false })
      : L.layerGroup();
    this.markerLayer.addTo(this.map);
  }

  setServices(services) {
    this.elements.service.replaceChildren(new Option("Todos", "all"));
    services.forEach((service) => this.elements.service.add(new Option(service, service)));
  }

  setStats(counts) {
    document.querySelector("#count-total").textContent = counts.total;
    document.querySelector("#count-farmacia").textContent = counts.farmacia;
    document.querySelector("#count-clinica").textContent = counts.clinica;
    document.querySelector("#count-laboratorio").textContent = counts.laboratorio;
    document.querySelector("#count-ecografia").textContent = counts.ecografia;
  }

  renderResults(items, selectedId, locationState, onSelect) {
    this.elements.list.replaceChildren();
    this.elements.resultCount.textContent = `${items.length} ${items.length === 1 ? "resultado" : "resultados"}`;
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>No encontramos resultados</strong>Prueba con otro nombre, servicio o filtro.";
      this.elements.list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const state = locationState(item);
      const category = getMarkerCategory(item);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `result-card${item.id === selectedId ? " is-selected" : ""}`;
      button.setAttribute("aria-pressed", String(item.id === selectedId));
      button.setAttribute("aria-label", `${item.nombre}, ${locationLabel(state.estado)}`);

      const icon = document.createElement("span");
      icon.className = `result-icon ${category}`;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = markerGlyph(category);

      const copy = document.createElement("span");
      copy.className = "result-copy";
      const title = document.createElement("strong");
      title.textContent = item.nombre;
      const address = document.createElement("span");
      address.textContent = item.direccion || "Dirección por confirmar";
      copy.append(title, address);

      const status = document.createElement("span");
      status.className = `status-pin ${state.estado === "verificado" ? "is-mapped" : ""}`;
      status.textContent = locationLabel(state.estado);
      button.append(icon, copy, status);
      button.addEventListener("click", () => onSelect(item));
      fragment.append(button);
    });
    this.elements.list.append(fragment);
  }

  renderMarkers(items, selectedId, locationState, onSelect) {
    this.map.closePopup();
    this.markerLayer.clearLayers();
    this.markers.clear();
    const mapped = items.filter((item) => locationState(item).estado === "verificado");
    mapped.forEach((item) => {
      const category = getMarkerCategory(item);
      const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.clinica;
      const icon = L.divIcon({
        className: `health-marker${item.id === selectedId ? " is-selected" : ""}`,
        html: `<span style="--marker-color:${color}">${markerGlyph(category)}</span>`,
        iconSize: [36, 42],
        iconAnchor: [18, 38],
        popupAnchor: [0, -36],
      });
      const marker = L.marker([item.coordenadas.lat, item.coordenadas.lon], { icon });
      marker.bindPopup(
        `<strong>${escapeHtml(item.nombre)}</strong>`
        + `<span>${escapeHtml(categoryLabel(item))}</span>`
        + `<span class="popup-address">${escapeHtml(item.direccion || "Dirección por confirmar")}</span>`
        + `<span class="popup-precision">${escapeHtml(item.verificacionCoordenadas.precision)}</span>`,
      );
      marker.on("click", () => onSelect(item));
      this.markerLayer.addLayer(marker);
      this.markers.set(item.id, marker);
    });
    this.elements.mappedCount.textContent = mapped.length;
  }

  select(item, locationState) {
    this.elements.detailTitle.textContent = item.nombre;
    const state = locationState(item);
    this.elements.detailDescription.textContent = `${categoryLabel(item)} · ${state.estado === "verificado" ? `Verificado: ${state.detalle}` : state.estado === "pendiente_verificacion" ? `Pendiente de verificación: ${state.detalle}` : "Ubicación no disponible."}`;
    this.elements.detailAddress.textContent = item.direccion || "Por confirmar";
    this.elements.detailServices.textContent = item.servicios.length ? item.servicios.join(", ") : "Por confirmar";
    this.elements.detailPhone.textContent = item.telefono || "Por confirmar";
    this.elements.detailHours.textContent = item.horario || "Por confirmar";
    this.elements.detailSource.textContent = item.verificacionCoordenadas?.fuente || item.fuente || "Fuente por confirmar";
    this.elements.detailSourceLink.hidden = !item.urlFuente;
    if (item.urlFuente) this.elements.detailSourceLink.href = item.urlFuente;

    const marker = this.markers.get(item.id);
    if (marker) {
      this.elements.mapSelectionStatus.hidden = true;
      const revealMarker = () => {
        this.map.flyTo(marker.getLatLng(), Math.max(this.map.getZoom(), 17), { duration: 0.8 });
        marker.openPopup();
      };
      if (typeof this.markerLayer.zoomToShowLayer === "function") {
        this.markerLayer.zoomToShowLayer(marker, revealMarker);
      } else {
        revealMarker();
      }
    } else {
      this.map.closePopup();
      this.map.flyTo(this.mapCenter, 14, { duration: 0.8 });
      this.elements.mapSelectionStatus.textContent = `${item.nombre}: ${locationLabel(state.estado).toLowerCase()}`;
      this.elements.mapSelectionStatus.hidden = false;
    }
  }

  renderLocationAudit(records, locationState, correctedCount) {
    const states = records.map((item) => locationState(item).estado);
    const verified = states.filter((state) => state === "verificado").length;
    const pending = states.filter((state) => state === "pendiente_verificacion").length;
    const unavailable = records.filter((item) =>
      !Number.isFinite(item.coordenadas?.lat) || !Number.isFinite(item.coordenadas?.lon),
    ).length;
    const withCoordinates = records.length - unavailable;
    const duplicateCount = findDuplicateGroups(records).length;
    this.elements.geoAuditSummary.replaceChildren();
    const values = [
      ["Registros", records.length],
      ["Verificados", verified],
      ["Pendientes", pending],
      ["Sin coordenadas", unavailable],
      ["Con coordenadas", withCoordinates],
      ["Duplicados", duplicateCount],
      ["Corregidas localmente", correctedCount],
    ];
    values.forEach(([label, count]) => {
      const cell = document.createElement("div");
      const value = document.createElement("strong");
      value.textContent = count;
      const caption = document.createElement("span");
      caption.textContent = label;
      cell.append(value, caption);
      this.elements.geoAuditSummary.append(cell);
    });
  }

  renderLocationOptions(records, selectedId) {
    this.elements.geoRecordSelect.replaceChildren();
    records.forEach((item) => {
      const option = new Option(`${item.nombre} · ${item.direccion || "dirección pendiente"}`, item.id);
      this.elements.geoRecordSelect.add(option);
    });
    if (selectedId) this.elements.geoRecordSelect.value = selectedId;
  }

  showLocationRecord(item, state) {
    this.elements.geoLat.value = item.coordenadas?.lat ?? "";
    this.elements.geoLon.value = item.coordenadas?.lon ?? "";
    this.elements.geoSource.value = item.verificacionCoordenadas?.fuente ?? "";
    this.elements.geoDate.value = item.verificacionCoordenadas?.fecha ?? localDate();
    this.elements.geoPrecision.value = item.verificacionCoordenadas?.precision ?? "";
    this.elements.geoConfirmed.checked = state.estado === "verificado";
    const coordinates = item.coordenadas
      ? `${item.coordenadas.lat}, ${item.coordenadas.lon}`
      : "Sin coordenadas";
    this.elements.geoRecordMeta.textContent = `${locationLabel(state.estado)} · ${coordinates} · ${state.detalle}`;
    this.setOpenOsmLink(item.coordenadas, item);
    this.clearCandidates();
  }

  setOpenOsmLink(coordinates, item = null) {
    if (!coordinates) {
      const query = [item?.nombre, item?.direccion, "Cobija", "Pando", "Bolivia"]
        .filter(Boolean)
        .join(", ");
      this.elements.geoOpenOsm.href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
      return;
    }
    this.elements.geoOpenOsm.href = `https://www.openstreetmap.org/?mlat=${coordinates.lat}&mlon=${coordinates.lon}#map=19/${coordinates.lat}/${coordinates.lon}`;
  }

  renderGeocodingCandidates(candidates, onChoose, validate) {
    this.clearCandidates();
    if (!candidates.length) {
      this.setAdminMessage("Nominatim no devolvió resultados. No se asignaron coordenadas.", "info");
      return;
    }
    candidates.forEach((candidate) => {
      const validation = validate(candidate);
      const card = document.createElement("article");
      card.className = "geo-candidate";
      const title = document.createElement("strong");
      title.textContent = candidate.nombre;
      const address = document.createElement("span");
      address.textContent = candidate.direccion;
      const meta = document.createElement("small");
      meta.textContent = `${candidate.tipo} · ${candidate.lat}, ${candidate.lon} · ${validation.valid ? "No verificado" : validation.reason}`;
      const actions = document.createElement("div");
      actions.className = "candidate-actions";
      const choose = document.createElement("button");
      choose.type = "button";
      choose.className = "secondary-button";
      choose.textContent = "Usar como pendiente";
      choose.disabled = !validation.valid;
      choose.addEventListener("click", () => onChoose(candidate));
      actions.append(choose);
      if (candidate.osmType && candidate.osmId) {
        const osm = document.createElement("a");
        osm.className = "candidate-osm-link";
        osm.href = `https://www.openstreetmap.org/${encodeURIComponent(candidate.osmType)}/${encodeURIComponent(candidate.osmId)}`;
        osm.target = "_blank";
        osm.rel = "noopener noreferrer";
        osm.textContent = "Ver objeto OSM";
        actions.append(osm);
      }
      card.append(title, address, meta, actions);
      this.elements.geoCandidates.append(card);
    });
  }

  setCoordinatesInputs(lat, lon) {
    this.elements.geoLat.value = lat.toFixed(7);
    this.elements.geoLon.value = lon.toFixed(7);
    this.elements.geoConfirmed.checked = false;
    this.setOpenOsmLink({ lat, lon });
  }

  setMapPickMode(active) {
    this.elements.geoPickMap.textContent = active ? "Haz clic en el mapa para elegir el punto…" : "Elegir punto en el mapa";
    this.elements.geoPickMap.classList.toggle("is-picking", active);
  }

  setAdminMessage(message, type = "info") {
    this.elements.geoAdminMessage.textContent = message;
    this.elements.geoAdminMessage.dataset.type = type;
  }

  clearCandidates() {
    this.elements.geoCandidates.replaceChildren();
  }

  showError(message) {
    this.elements.list.replaceChildren();
    const error = document.createElement("div");
    error.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "No se pudo cargar el directorio";
    const description = document.createElement("span");
    description.textContent = message;
    error.append(title, description);
    this.elements.list.append(error);
    this.elements.resultCount.textContent = "Error";
  }
}

export function getMarkerCategory(item) {
  if (item.categorias.includes("farmacia")) return "farmacia";
  if (item.tipo === "hospital") return "hospital";
  if (item.categorias.includes("clinica")) return "clinica";
  if (item.categorias.includes("laboratorio")) return "laboratorio";
  return "ecografia";
}

function categoryLabel(item) {
  if (item.tipo === "hospital") {
    return ["hospital", ...item.categorias.filter((category) => category !== "clinica")]
      .map((category) => CATEGORY_NAMES[category] ?? category)
      .join(" · ");
  }
  return item.categorias.map((category) => CATEGORY_NAMES[category] ?? category).join(" · ");
}

function markerGlyph(category) {
  if (category === "farmacia" || category === "clinica" || category === "hospital") return "✚";
  return category === "laboratorio" ? "⌬" : "◉";
}

function locationLabel(state) {
  if (state === "verificado") return "Verificado";
  if (state === "pendiente_verificacion") return "Pendiente de verificación";
  return "No disponible";
}

function findDuplicateGroups(records) {
  const locations = new Map();
  records.forEach((item) => {
    if (!Number.isFinite(item.coordenadas?.lat) || !Number.isFinite(item.coordenadas?.lon)) return;
    const key = `${item.coordenadas.lat},${item.coordenadas.lon}`;
    locations.set(key, [...(locations.get(key) ?? []), item]);
  });
  return [...locations.values()].filter((group) => group.length > 1);
}

function localDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}
