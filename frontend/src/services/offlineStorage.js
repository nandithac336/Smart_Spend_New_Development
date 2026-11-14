const DATABASE_NAME = 'smart-spend-offline'
const DATABASE_VERSION = 1
const OPERATIONS_STORE = 'operations'
const METADATA_STORE = 'metadata'

let databasePromise

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Offline storage is unavailable in this browser.'))
  }
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
        const operations = database.createObjectStore(OPERATIONS_STORE, { keyPath: 'id' })
        operations.createIndex('userId', 'userId')
      }
      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage.'))
    request.onblocked = () => reject(new Error('Offline storage is blocked by another open tab.'))
  }).catch((error) => {
    databasePromise = undefined
    throw error
  })

  return databasePromise
}

function operationKey(userId, clientOperationId) {
  return `${userId}:${clientOperationId}`
}

function metadataKey(userId, name) {
  return `${userId}:${name}`
}

function operationIdentity(operation) {
  const identity = { ...operation }
  delete identity.clientTimestamp
  return JSON.stringify(identity)
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error ?? new Error('Offline storage transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Offline storage transaction was aborted.'))
  })
}

export async function listOfflineOperations(userId) {
  if (!userId) return []
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS_STORE, 'readonly')
  const completion = transactionCompletion(transaction)
  const request = transaction.objectStore(OPERATIONS_STORE).index('userId').getAll(userId)
  const records = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not read the offline queue.'))
  })
  await completion
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

export async function enqueueOfflineOperation(userId, operation) {
  if (!userId) throw new Error('Sign in before saving an offline transaction.')
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS_STORE, 'readwrite')
  const completion = transactionCompletion(transaction)
  const store = transaction.objectStore(OPERATIONS_STORE)
  const record = {
    id: operationKey(userId, operation.clientOperationId),
    userId,
    operation,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: new Date().toISOString(),
    error: null,
  }
  let result
  let failure
  const request = store.index('userId').getAll(userId)
  request.onsuccess = () => {
    const records = request.result
    const existing = records.find((item) => item.id === record.id)
    if (existing) {
      if (operationIdentity(existing.operation) !== operationIdentity(operation)) {
        failure = new Error('This operation ID is already associated with different transaction data.')
        transaction.abort()
        return
      }
      result = existing
      return
    }
    if (operation.entityId && records.some((item) =>
      item.operation.entityId === operation.entityId && item.status !== 'synced'
    )) {
      failure = new Error('A change for this transaction is already waiting to synchronize.')
      transaction.abort()
      return
    }
    result = record
    store.add(record)
  }
  request.onerror = () => {
    failure = request.error ?? new Error('Could not inspect the offline queue.')
    transaction.abort()
  }
  try {
    await completion
  } catch (error) {
    throw failure ?? error
  }
  return result
}

export async function updateOfflineOperation(userId, clientOperationId, changes) {
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS_STORE, 'readwrite')
  const completion = transactionCompletion(transaction)
  const store = transaction.objectStore(OPERATIONS_STORE)
  const key = operationKey(userId, clientOperationId)
  let result
  const request = store.get(key)
  request.onsuccess = () => {
    if (!request.result || request.result.userId !== userId) return
    result = { ...request.result, ...changes }
    store.put(result)
  }
  await completion
  if (!result) throw new Error('The queued operation is no longer available.')
  return result
}

export async function removeOfflineOperation(userId, clientOperationId) {
  const database = await openDatabase()
  const transaction = database.transaction(OPERATIONS_STORE, 'readwrite')
  const completion = transactionCompletion(transaction)
  const store = transaction.objectStore(OPERATIONS_STORE)
  const key = operationKey(userId, clientOperationId)
  let removed = false
  const request = store.get(key)
  request.onsuccess = () => {
    if (request.result?.userId !== userId) return
    removed = true
    store.delete(key)
  }
  await completion
  return removed
}

export async function getOfflineMetadata(userId, name) {
  const database = await openDatabase()
  const transaction = database.transaction(METADATA_STORE, 'readonly')
  const completion = transactionCompletion(transaction)
  const request = transaction.objectStore(METADATA_STORE).get(metadataKey(userId, name))
  const result = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.value ?? null)
    request.onerror = () => reject(request.error ?? new Error('Could not read offline metadata.'))
  })
  await completion
  return result
}

export async function setOfflineMetadata(userId, name, value) {
  const database = await openDatabase()
  const transaction = database.transaction(METADATA_STORE, 'readwrite')
  const completion = transactionCompletion(transaction)
  transaction.objectStore(METADATA_STORE).put({
    key: metadataKey(userId, name),
    userId,
    name,
    value,
  })
  await completion
}
