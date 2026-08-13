// TanStack Query write hooks (1A). Both invalidate `doc`/`docinfo`/`list` for the affected
// doctype on success — never leave stale server state cached across a write.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Document } from '@/core/types';
import { getFrappeClient } from '@/lib/api/client';
import { qk } from './keys';

export function useSaveDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doc,
      action,
    }: {
      doc: Document & { __islocal?: 0 | 1 };
      action: 'Save' | 'Submit' | 'Cancel' | 'Update';
    }) => getFrappeClient().saveDoc(doc, action),
    onSuccess: (result, { doc }) => {
      queryClient.invalidateQueries({ queryKey: qk.doc(doc.doctype, result.doc.name) });
      queryClient.invalidateQueries({ queryKey: qk.docinfo(doc.doctype, result.doc.name) });
      queryClient.invalidateQueries({ queryKey: ['list', doc.doctype] });
    },
  });
}

export function useDeleteDoc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doctype, name }: { doctype: string; name: string }) =>
      getFrappeClient().deleteDoc(doctype, name),
    onSuccess: (_result, { doctype }) => {
      queryClient.invalidateQueries({ queryKey: ['list', doctype] });
    },
  });
}
