const BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api')

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  reportCase: (payload) => request('/cases', { method: 'POST', body: JSON.stringify(payload) }),
  listCases: () => request('/cases'),
  getCase: (id) => request(`/cases/${id}`),
  assignVet: (caseId, vetId) => request(`/cases/${caseId}/assign`, { method: 'POST', body: JSON.stringify({ vetId }) }),
  updateStatus: (caseId, status) => request(`/cases/${caseId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listVets: () => request('/vets'),
  nearbyVets: (lat, lng) => request(`/vets/nearby?lat=${lat}&lng=${lng}`),
  analyzePhoto: (payload) => request('/photo-analysis', { method: 'POST', body: JSON.stringify(payload) }),
  createVet: (payload) => request('/vets', { method: 'POST', body: JSON.stringify(payload) }),
  listHotspots: () => request('/hotspots'),
}
