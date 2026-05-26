import { useState, useEffect } from 'react';
import { getFrappeApp } from '@/lib/frappe';

interface DocMeta {
  name: string;
  module: string;
  fields: DocField[];
  title_field?: string;
  search_fields?: string[];
  sort_field?: string;
  sort_order?: string;
}

interface DocField {
  fieldname: string;
  fieldtype: string;
  label: string;
  reqd?: number;
  options?: string;
  default?: any;
  read_only?: number;
  hidden?: number;
}

interface ListData {
  data: any[];
  total_count: number;
}

export const useFrappe = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (method: string, args: any = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.call(method, args);
      return response.message;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getDoc = async (doctype: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.getDoc(doctype, name);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getList = async (
    doctype: string,
    options: {
      fields?: string[];
      filters?: any[];
      limit_start?: number;
      limit_page_length?: number;
      order_by?: string;
    } = {}
  ): Promise<ListData> => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.getDocList(doctype, options);
      return {
        data: response,
        total_count: response.length,
      };
    } catch (err: any) {
      setError(err.message || 'Failed to fetch list');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getMeta = async (doctype: string): Promise<DocMeta> => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.getMeta(doctype);
      // ERPNext returns metadata in response.docs[0]
      return response.docs?.[0] || response;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metadata');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createDoc = async (doctype: string, doc: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.createDoc(doctype, doc);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to create document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateDoc = async (doctype: string, name: string, doc: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.updateDoc(doctype, name, doc);
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to update document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteDoc = async (doctype: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const frappe = getFrappeApp();
      await frappe.deleteDoc(doctype, name);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete document');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    call,
    getDoc,
    getList,
    getMeta,
    createDoc,
    updateDoc,
    deleteDoc,
  };
};

export const useDocMeta = (doctype: string) => {
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const { getMeta, isLoading, error } = useFrappe();

  useEffect(() => {
    if (doctype) {
      getMeta(doctype).then(setMeta);
    }
  }, [doctype]);

  return { meta, isLoading, error };
};

export const useDocList = (
  doctype: string,
  options: {
    fields?: string[];
    filters?: any[];
    limit_start?: number;
    limit_page_length?: number;
    order_by?: string;
  } = {}
) => {
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { getList, isLoading, error } = useFrappe();

  const refresh = async () => {
    if (doctype) {
      const result = await getList(doctype, options);
      setData(result.data);
      setTotalCount(result.total_count);
    }
  };

  useEffect(() => {
    refresh();
  }, [doctype, JSON.stringify(options)]);

  return { data, totalCount, isLoading, error, refresh };
};