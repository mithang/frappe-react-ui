// useDocRealtime (4A) — subscribes to real-time updates for one (doctype, docname), using the
// event names/payload verified against Frappe source (frappe/realtime/handlers.py,
// frappe/model/document.py's notify_update): the client emits `doc_subscribe`/`doc_unsubscribe`
// with two positional string args, and the server emits `doc_update` with
// `{ modified, doctype, name }` — a refetch signal, not the full document.
//
// This hook is deliberately unopinionated about WHAT to do on a remote change — it just plumbs
// the verified event through. The caller (useFormController) decides reload-vs-toast based on
// its own dirty state, which this hook has no visibility into.

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from './socket';

interface DocUpdatePayload {
  modified: string;
  doctype: string;
  name: string;
}

export interface UseDocRealtimeOptions {
  onRemoteChange: () => void;
  /** Injectable for tests — defaults to the real shared socket. */
  getSocketImpl?: () => Promise<Socket>;
}

export function useDocRealtime(
  doctype: string | undefined,
  docname: string | undefined,
  options: UseDocRealtimeOptions
): void {
  const { onRemoteChange, getSocketImpl = getSocket } = options;
  // Keep the latest callback without re-subscribing every render.
  const onRemoteChangeRef = useRef(onRemoteChange);
  onRemoteChangeRef.current = onRemoteChange;

  useEffect(() => {
    if (!doctype || !docname) return;

    let disposed = false;
    let socketRef: Socket | null = null;

    const handler = (payload: DocUpdatePayload) => {
      if (payload?.doctype === doctype && payload?.name === docname) {
        onRemoteChangeRef.current();
      }
    };

    getSocketImpl().then((socket) => {
      if (disposed) return;
      socketRef = socket;
      socket.emit('doc_subscribe', doctype, docname);
      socket.on('doc_update', handler);
    });

    return () => {
      disposed = true;
      if (socketRef) {
        socketRef.emit('doc_unsubscribe', doctype, docname);
        socketRef.off('doc_update', handler);
      }
    };
  }, [doctype, docname, getSocketImpl]);
}
