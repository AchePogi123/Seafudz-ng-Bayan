import { EventEmitter } from 'events';

export const realtimeEmitter = new EventEmitter();
realtimeEmitter.setMaxListeners(100);

/**
 * Broadcasts order state changes to all connected SSE clients in 0ms
 */
export const emitOrderUpdate = (orderData) => {
  try {
    realtimeEmitter.emit('order_update', orderData || { type: 'ORDER_UPDATE', timestamp: Date.now() });
  } catch (err) {
    console.warn('[SSE] Event emit error:', err.message);
  }
};
