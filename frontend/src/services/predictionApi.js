import api from './api.js'

async function getPredictionEndpoint(path, params) {
  const response = await api.get(path, { params })
  return response.data.data
}

export function getPredictionOverview() {
  return getPredictionEndpoint('/predictions/overview')
}

export function getCategoryPredictions(month) {
  return getPredictionEndpoint('/predictions/categories', { month })
}

export function getDailyPredictions(month) {
  return getPredictionEndpoint('/predictions/daily', { month })
}

export async function getExpensePredictionData(month) {
  const overview = await getPredictionOverview()
  const selectedMonth = month || overview.currentMonth.forecastPeriod
  const [categories, daily] = await Promise.all([
    getCategoryPredictions(selectedMonth),
    getDailyPredictions(selectedMonth),
  ])
  return { overview, categories, daily, selectedMonth }
}
