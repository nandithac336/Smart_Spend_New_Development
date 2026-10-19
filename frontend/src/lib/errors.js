export function getErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error?.message
    ?? error?.response?.data?.message
    ?? error?.message
    ?? fallback
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
