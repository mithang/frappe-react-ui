import React from 'react';
import { useParams } from 'react-router-dom';
import { PrintPreview } from '@/components/print/PrintPreview';

export const PrintView: React.FC = () => {
  const { doctype, name } = useParams<{ doctype: string; name: string }>();

  if (!doctype || !name) {
    return <div className="p-8 text-destructive">DocType and Name required for print view</div>;
  }

  return <PrintPreview doctype={doctype} name={name} />;
};

export default PrintView;
