import type { EventBusEvents, EventHandler } from '../types';

type EventKey = keyof EventBusEvents;

/**
 * EventBus - Cross-component event communication
 * Enables loose coupling between components and extensions
 */
class EventBusImpl {
    private listeners: Map<string, Set<EventHandler>> = new Map();

    /**
     * Subscribe to an event
     */
    on<K extends EventKey>(event: K, handler: EventHandler<EventBusEvents[K]>): () => void {
        const key = String(event);
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key)!.add(handler);

        // Return unsubscribe function
        return () => this.off(event, handler);
    }

    /**
     * Unsubscribe from an event
     */
    off<K extends EventKey>(event: K, handler: EventHandler<EventBusEvents[K]>): void {
        const handlers = this.listeners.get(String(event));
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * Subscribe to an event once
     */
    once<K extends EventKey>(event: K, handler: EventHandler<EventBusEvents[K]>): () => void {
        const wrappedHandler: EventHandler<EventBusEvents[K]> = (payload) => {
            this.off(event, wrappedHandler);
            handler(payload);
        };
        return this.on(event, wrappedHandler);
    }

    /**
     * Emit an event to all subscribers
     */
    emit<K extends EventKey>(event: K, payload: EventBusEvents[K]): void {
        const handlers = this.listeners.get(String(event));
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(payload);
                } catch (error) {
                    console.error(`EventBus: Error in handler for "${event}":`, error);
                }
            });
        }
    }

    /**
     * Clear all listeners for an event
     */
    clear(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * Get listener count for debugging
     */
    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}

// Singleton instance
export const EventBus = new EventBusImpl();

// Export type for consumers
export type { EventBusEvents };
