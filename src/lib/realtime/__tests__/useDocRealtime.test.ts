import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Socket } from 'socket.io-client';
import { useDocRealtime } from '../useDocRealtime';

// A real `Socket` has 60+ members we don't use — this mock implements exactly the surface
// useDocRealtime touches (emit/on/off) and is cast at the one boundary that needs the real type,
// rather than typing it (or getSocketImpl) as `any` throughout the test.
function createMockSocket() {
  const listeners: Record<string, ((payload: unknown) => void)[]> = {};
  const mock = {
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      (listeners[event] ??= []).push(cb);
    }),
    off: vi.fn((event: string, cb: (payload: unknown) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((l) => l !== cb);
    }),
    __emitServerEvent(event: string, payload: unknown) {
      (listeners[event] ?? []).forEach((cb) => cb(payload));
    },
  };
  return mock as typeof mock & Socket;
}

describe('useDocRealtime', () => {
  let socket: ReturnType<typeof createMockSocket>;
  let getSocketImpl: () => Promise<Socket>;

  beforeEach(() => {
    socket = createMockSocket();
    getSocketImpl = vi.fn().mockResolvedValue(socket);
  });

  it('subscribes with doc_subscribe(doctype, docname) on mount', async () => {
    renderHook(() => useDocRealtime('Sales Order', 'SO-0001', { onRemoteChange: vi.fn(), getSocketImpl }));
    await vi.waitFor(() => expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'Sales Order', 'SO-0001'));
    expect(socket.on).toHaveBeenCalledWith('doc_update', expect.any(Function));
  });

  it('does nothing when doctype or docname is undefined (e.g. a new, unsaved doc)', () => {
    renderHook(() => useDocRealtime('Sales Order', undefined, { onRemoteChange: vi.fn(), getSocketImpl }));
    expect(getSocketImpl).not.toHaveBeenCalled();
  });

  it('calls onRemoteChange only for the subscribed (doctype, docname)', async () => {
    const onRemoteChange = vi.fn();
    renderHook(() => useDocRealtime('Sales Order', 'SO-0001', { onRemoteChange, getSocketImpl }));
    await vi.waitFor(() => expect(socket.on).toHaveBeenCalled());

    socket.__emitServerEvent('doc_update', { doctype: 'Sales Order', name: 'SO-0002', modified: 'x' });
    expect(onRemoteChange).not.toHaveBeenCalled();

    socket.__emitServerEvent('doc_update', { doctype: 'Sales Order', name: 'SO-0001', modified: 'x' });
    expect(onRemoteChange).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes with doc_unsubscribe and removes the listener on unmount', async () => {
    const { unmount } = renderHook(() => useDocRealtime('Sales Order', 'SO-0001', { onRemoteChange: vi.fn(), getSocketImpl }));
    await vi.waitFor(() => expect(socket.on).toHaveBeenCalled());

    unmount();

    expect(socket.emit).toHaveBeenCalledWith('doc_unsubscribe', 'Sales Order', 'SO-0001');
    expect(socket.off).toHaveBeenCalledWith('doc_update', expect.any(Function));
  });

  it('switching docname unsubscribes the old room and subscribes the new one', async () => {
    const { rerender } = renderHook(
      ({ name }: { name: string }) => useDocRealtime('Sales Order', name, { onRemoteChange: vi.fn(), getSocketImpl }),
      { initialProps: { name: 'SO-0001' } }
    );
    await vi.waitFor(() => expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'Sales Order', 'SO-0001'));

    rerender({ name: 'SO-0002' });
    await vi.waitFor(() => expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'Sales Order', 'SO-0002'));

    expect(socket.emit).toHaveBeenCalledWith('doc_unsubscribe', 'Sales Order', 'SO-0001');
  });
});
