export function getErrorMessage(error, fallback = 'Something went wrong') {
  if (error?.response) {
    if (error.response.status === 429) return 'Too many attempts. Please wait a few minutes.'
    return error.response.data?.error?.message
      ?? error.response.data?.message
      ?? fallback
  }

  if (error?.code === 'ERR_NETWORK' || error?.request) {
    return "Can't reach the server. Is the backend running?"
  }

  return fallback
}

export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details
  if (!Array.isArray(details)) return {}

  return details.reduce((fieldErrors, detail) => {
    const field = detail.field ?? (Array.isArray(detail.path) ? detail.path.join('.') : detail.path)
    if (field && detail.message) fieldErrors[field] = detail.message
    return fieldErrors
  }, {})
}
