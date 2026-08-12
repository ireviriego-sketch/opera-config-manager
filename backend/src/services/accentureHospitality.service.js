const baseUrl = process.env.ACC_HOSPITALITY_BASE_URL;
const apiKey = process.env.ACC_HOSPITALITY_API_KEY;

function ensureConfigured() {
  if (!baseUrl) {
    const error = new Error('ACC_HOSPITALITY_BASE_URL is not configured');
    error.statusCode = 500;
    throw error;
  }
}

async function getJson(path) {
  ensureConfigured();

  const headers = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}${path}`, { headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.ok === false) {
    const error = new Error(body.error || `Accenture Hospitality HTTP ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return body;
}

function readRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.rows)) return body.rows;
  if (Array.isArray(body.data)) return body.data;
  return [];
}

async function listChains() {
  return readRows(await getJson('/api/chains'));
}

async function listHotelsByChain(accChainId) {
  return readRows(await getJson(`/api/hotels?chainId=${encodeURIComponent(accChainId)}`));
}

async function findChainByName(chainName) {
  const normalized = normalize(chainName);
  const chains = await listChains();
  return chains.find(chain => normalize(chain.COMMERCIALNAME || chain.commercialName || chain.chainName) === normalized) || null;
}

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

module.exports = { listChains, listHotelsByChain, findChainByName };
