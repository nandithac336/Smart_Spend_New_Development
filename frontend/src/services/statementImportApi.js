import api from './api.js'

export const MAX_STATEMENT_FILE_BYTES = 10 * 1024 * 1024
export const STATEMENT_UPLOAD_TIMEOUT_MS = 120_000
const extensions = ['csv', 'xlsx', 'pdf']

export function validateStatementFile(file) {
  if (!file) return 'Choose a bank statement file.'
  const extension = file.name?.split('.').pop()?.toLowerCase()
  if (!extensions.includes(extension)) return 'Choose a CSV, XLSX, or text-based PDF statement.'
  if (!file.size) return 'The selected file is empty.'
  if (file.size > MAX_STATEMENT_FILE_BYTES) return 'Statement files must be 10 MB or smaller.'
  return ''
}

export async function uploadStatement(file, { walletId, bankName, onUploadProgress }) {
  const form = new FormData()
  form.append('file', file)
  form.append('walletId', walletId)
  if (bankName?.trim()) form.append('bankName', bankName.trim())
  try {
    const response = await api.post('/imports/statements', form, {
      timeout: STATEMENT_UPLOAD_TIMEOUT_MS,
      onUploadProgress: (event) => {
        if (event.total) onUploadProgress?.(Math.round(event.loaded * 100 / event.total))
      },
    })
    return response.data.data
  } catch (error) {
    const id = error.response?.data?.error?.details?.importId
    if (id) {
      try {
        error.importRecord = await getStatementImport(id)
      } catch {
        // Preserve the parse error if the failed import record cannot be fetched.
      }
    }
    throw error
  }
}

export async function listStatementImports(params = {}) {
  const response = await api.get('/imports', { params })
  return { imports: response.data.data, pagination: response.data.pagination }
}

export async function getStatementImport(id) {
  const response = await api.get(`/imports/${id}`)
  return response.data.data
}

export async function listStatementDrafts(id, params = {}) {
  const response = await api.get(`/imports/${id}/transactions`, { params })
  return { drafts: response.data.data, pagination: response.data.pagination }
}

export async function updateStatementDraft(importId, draftId, changes) {
  const response = await api.patch(`/imports/${importId}/transactions/${draftId}`, changes)
  return response.data.data
}

export async function confirmStatementImport(importId, payload) {
  const response = await api.post(`/imports/${importId}/confirm`, payload)
  return response.data
}
