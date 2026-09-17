/**
 * Servicio de Integración con ORDENA (Librería de Documentos, Reglamentos y Protocolos)
 * Condominio Portada Norte VII - ALSI Administración Copropiedad
 */

const ORDENA_BASE_URL = process.env.ORDENA_BASE_URL || 'https://ordena-t0bg.onrender.com';

let cachedFolders = null;
let lastFoldersFetch = 0;
let cachedDocs = null;
let lastDocsFetch = 0;

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de caché en memoria

/**
 * Obtiene las carpetas oficiales de la librería en ORDENA
 */
async function fetchLibraryFolders(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedFolders && (now - lastFoldersFetch < CACHE_TTL_MS)) {
    return cachedFolders;
  }

  try {
    const res = await fetch(`${ORDENA_BASE_URL}/api/library/folders`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      console.warn(`[ORDENA] Error al obtener carpetas: ${res.status} ${res.statusText}`);
      return cachedFolders || [];
    }

    const data = await res.json();
    cachedFolders = Array.isArray(data) ? data : [];
    lastFoldersFetch = now;
    return cachedFolders;
  } catch (err) {
    console.error('[ORDENA] Fallo de conexión al consultar carpetas:', err.message);
    return cachedFolders || [];
  }
}

/**
 * Obtiene la lista de documentos publicados en ORDENA
 */
async function fetchLibraryDocuments(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedDocs && (now - lastDocsFetch < CACHE_TTL_MS)) {
    return cachedDocs;
  }

  try {
    const res = await fetch(`${ORDENA_BASE_URL}/api/library/documents`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      console.warn(`[ORDENA] Error al obtener documentos: ${res.status} ${res.statusText}`);
      return cachedDocs || [];
    }

    const data = await res.json();
    cachedDocs = Array.isArray(data) ? data : [];
    lastDocsFetch = now;
    return cachedDocs;
  } catch (err) {
    console.error('[ORDENA] Fallo de conexión al consultar documentos:', err.message);
    return cachedDocs || [];
  }
}

/**
 * Obtiene el detalle de un documento con su archivo binario (base64)
 */
async function fetchDocumentDetail(docId) {
  try {
    const res = await fetch(`${ORDENA_BASE_URL}/api/library/documents/${docId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      console.warn(`[ORDENA] Error al obtener detalle del documento ${docId}: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[ORDENA] Error descargando documento ${docId}:`, err.message);
    return null;
  }
}

/**
 * Búsqueda inteligente de carpetas y documentos por palabra clave
 */
async function searchLibrary(searchTerm = '') {
  const [folders, docs] = await Promise.all([
    fetchLibraryFolders(),
    fetchLibraryDocuments()
  ]);

  const cleanTerm = (searchTerm || '').toLowerCase().trim();

  if (!cleanTerm || cleanTerm === 'todos' || cleanTerm === 'libreria' || cleanTerm === 'documentos') {
    return {
      portalUrl: ORDENA_BASE_URL,
      folders: folders.map(f => ({
        id: f.id,
        nombre: f.nombre,
        descripcion: f.descripcion,
        icono: f.icono,
        document_count: f.document_count || 0
      })),
      documents: docs.map(d => ({
        id: d.id,
        nombre: d.nombre,
        categoria: d.categoria,
        tipo: d.tipo_archivo
      })),
      totalFolders: folders.length,
      totalDocuments: docs.length
    };
  }

  // Filtrar carpetas coincidentes
  const matchedFolders = folders.filter(f => 
    (f.nombre && f.nombre.toLowerCase().includes(cleanTerm)) ||
    (f.descripcion && f.descripcion.toLowerCase().includes(cleanTerm))
  );

  // Filtrar documentos coincidentes
  const matchedDocs = docs.filter(d => 
    (d.nombre && d.nombre.toLowerCase().includes(cleanTerm)) ||
    (d.descripcion && d.descripcion.toLowerCase().includes(cleanTerm)) ||
    (d.categoria && d.categoria.toLowerCase().includes(cleanTerm))
  );

  return {
    portalUrl: ORDENA_BASE_URL,
    matchedFolders: matchedFolders.map(f => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      document_count: f.document_count || 0
    })),
    matchedDocuments: matchedDocs.map(d => ({
      id: d.id,
      nombre: d.nombre,
      categoria: d.categoria,
      tipo: d.tipo_archivo
    })),
    allFoldersCount: folders.length,
    allDocumentsCount: docs.length
  };
}

module.exports = {
  ORDENA_BASE_URL,
  fetchLibraryFolders,
  fetchLibraryDocuments,
  fetchDocumentDetail,
  searchLibrary
};
