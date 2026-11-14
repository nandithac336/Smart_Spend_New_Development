import { executeFinancialQuery, identifyFinancialIntent } from "./financialQueryService.js";

const MAX_CONTEXT_BYTES = 12_000;

export async function buildFinancialContext(user, message) {
  const intent = identifyFinancialIntent(message);
  const result = await executeFinancialQuery(user, message, intent);
  const boundedData = JSON.parse(JSON.stringify(result.data));
  while (JSON.stringify(boundedData).length > MAX_CONTEXT_BYTES) {
    if (Array.isArray(boundedData?.transactions) && boundedData.transactions.length > 1) {
      boundedData.transactions.pop();
    } else if (Array.isArray(boundedData?.merchants) && boundedData.merchants.length > 1) {
      boundedData.merchants.pop();
    } else if (Array.isArray(boundedData?.budgets) && boundedData.budgets.length > 1) {
      boundedData.budgets.pop();
    } else if (Array.isArray(boundedData?.goals) && boundedData.goals.length > 1) {
      boundedData.goals.pop();
    } else if (Array.isArray(boundedData?.confirmed?.byMerchant) && boundedData.confirmed.byMerchant.length > 1) {
      boundedData.confirmed.byMerchant.pop();
    } else if (Array.isArray(boundedData?.confirmed?.byCategory) && boundedData.confirmed.byCategory.length > 1) {
      boundedData.confirmed.byCategory.pop();
    } else if (Array.isArray(boundedData?.detected?.byMerchant) && boundedData.detected.byMerchant.length > 1) {
      boundedData.detected.byMerchant.pop();
    } else if (Array.isArray(boundedData?.detected?.byCategory) && boundedData.detected.byCategory.length > 1) {
      boundedData.detected.byCategory.pop();
    } else if (Array.isArray(boundedData?.detected?.subscriptions) && boundedData.detected.subscriptions.length > 1) {
      boundedData.detected.subscriptions.pop();
    } else if (Array.isArray(boundedData?.upcomingPayments) && boundedData.upcomingPayments.length > 1) {
      boundedData.upcomingPayments.pop();
    } else {
      break;
    }
  }
  return {
    intent: result.intent,
    financialData: boundedData,
    deterministicAnswer: result.deterministicAnswer,
    recommendations: result.recommendations.slice(0, 5),
  };
}
