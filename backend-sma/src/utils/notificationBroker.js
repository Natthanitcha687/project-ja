const clientsByUser = new Map();
const clientsByStore = new Map();

function sendEvent(res, event, payload) {
  try {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  } catch (e) {
    // ignore
  }
}

export function subscribe({ userId, storeId, res }) {
  // set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('\n')

  const entry = { res }
  if (userId) {
    const list = clientsByUser.get(userId) || []
    list.push(entry)
    clientsByUser.set(userId, list)
  }
  if (storeId) {
    const list = clientsByStore.get(storeId) || []
    list.push(entry)
    clientsByStore.set(storeId, list)
  }

  const cleanup = () => {
    if (userId) {
      const list = (clientsByUser.get(userId) || []).filter((x) => x.res !== res)
      if (list.length) clientsByUser.set(userId, list)
      else clientsByUser.delete(userId)
    }
    if (storeId) {
      const list = (clientsByStore.get(storeId) || []).filter((x) => x.res !== res)
      if (list.length) clientsByStore.set(storeId, list)
      else clientsByStore.delete(storeId)
    }
  }

  res.on('close', cleanup)
  res.on('finish', cleanup)

  return () => cleanup()
}

export async function publishNotification({ prisma, notification }) {
  // notification: { id, userId, storeId, title, body, data, createdAt }
  // send to user clients
  const payload = notification
  if (notification.userId) {
    const list = clientsByUser.get(notification.userId) || []
    for (const { res } of list) sendEvent(res, 'notification', payload)
  }
  if (notification.storeId) {
    const list = clientsByStore.get(notification.storeId) || []
    for (const { res } of list) sendEvent(res, 'notification', payload)
  }
}
