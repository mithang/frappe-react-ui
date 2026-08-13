// FormRegistry (1C) — the DATA layer for form toolbar buttons and named slots. This registry
// only stores registrations; 2A is responsible for actually rendering them inside SmartForm
// (the "+ toolbar/slot extension points" part of its Wave 2 brief). Splitting it this way is
// what lets 1C ship a testable exit criterion ("add a form toolbar button") without needing
// SmartForm's rendering to exist yet.

import type { ReactNode } from 'react';
import type { FormController } from '@/core/types';

export interface FormButton {
  label: string;
  group?: 'Actions' | 'Create' | string;
  onClick: (frm: FormController) => void;
  condition?: (frm: FormController) => boolean;
}

/** Matches Desk's named slots: before-fields, after-fields, sidebar, tab:<name>. */
export type FormSlotName = 'before-fields' | 'after-fields' | 'sidebar' | `tab:${string}`;

class FormRegistryImpl {
  private buttons = new Map<string, FormButton[]>();
  private slots = new Map<string, Map<FormSlotName, ReactNode[]>>();

  addButton(doctype: string, button: FormButton): () => void {
    const list = this.buttons.get(doctype) ?? [];
    list.push(button);
    this.buttons.set(doctype, list);
    return () => {
      this.buttons.set(doctype, (this.buttons.get(doctype) ?? []).filter((b) => b !== button));
    };
  }

  getButtons(doctype: string): FormButton[] {
    return this.buttons.get(doctype) ?? [];
  }

  addSlot(doctype: string, slot: FormSlotName, content: ReactNode): () => void {
    const doctypeSlots = this.slots.get(doctype) ?? new Map<FormSlotName, ReactNode[]>();
    const contents = doctypeSlots.get(slot) ?? [];
    contents.push(content);
    doctypeSlots.set(slot, contents);
    this.slots.set(doctype, doctypeSlots);
    return () => {
      const current = this.slots.get(doctype)?.get(slot) ?? [];
      this.slots.get(doctype)?.set(slot, current.filter((c) => c !== content));
    };
  }

  getSlotContent(doctype: string, slot: FormSlotName): ReactNode[] {
    return this.slots.get(doctype)?.get(slot) ?? [];
  }

  clear(): void {
    this.buttons.clear();
    this.slots.clear();
  }
}

export const FormRegistry = new FormRegistryImpl();
