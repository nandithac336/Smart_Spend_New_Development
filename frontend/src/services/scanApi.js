import api from './api.js'

export async function uploadScan(type, file) {
  const body = new FormData()
  body.append('image', file)
  try {
    const response = await api.post(`/scans/${type}`, body)
    return response.data.data
  } catch (error) {
    const scanId = error.response?.data?.error?.details?.scanId
    if (scanId) {
      try {
        error.scanDraft = await getScan(scanId)
      } catch {
        // The OCR error remains primary if the retained draft is temporarily unavailable.
      }
    }
    throw error
  }
}

export async function listScans(params = {}) {
  const response = await api.get('/scans', { params })
  return { scans: response.data.data, pagination: response.data.pagination }
}

export async function getScan(id) {
  const response = await api.get(`/scans/${id}`)
  return response.data.data
}

export async function updateScanDraft(id, changes) {
  const response = await api.patch(`/scans/${id}`, changes)
  return response.data.data
}

export async function confirmScan(id, payload) {
  const response = await api.post(`/scans/${id}/confirm`, payload)
  return response.data
}

export async function deleteScan(id) {
  const response = await api.delete(`/scans/${id}`)
  return response.data.data
}
