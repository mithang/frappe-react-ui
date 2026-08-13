import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer } from 'lucide-react';
import { getFrappeApp } from '@/lib/frappe';

interface PrintPreviewProps {
  doctype: string;
  name: string;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({ doctype, name }) => {
  const [printFormat, setPrintFormat] = useState('Standard');
  const [availableFormats, setAvailableFormats] = useState<string[]>(['Standard']);
  const [withLetterhead, setWithLetterhead] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadFormats = async () => {
      try {
        const frappe = getFrappeApp();
        const res = await frappe.getDocList('Print Format', {
          fields: ['name'],
          filters: { doc_type: doctype },
        });
        if (res && res.length > 0) {
          const names = res.map((f: Record<string, unknown>) => String(f.name));
          if (!names.includes('Standard')) names.unshift('Standard');
          setAvailableFormats(names);
        }
      } catch (err) {
        console.error('Failed to load print formats:', err);
      }
    };
    loadFormats();
  }, [doctype]);

  const fetchPrintHTML = useCallback(async () => {
    setLoading(true);
    try {
      const frappe = getFrappeApp();
      const response = await frappe.call('frappe.www.printview.get_html_and_style', {
        doc: { doctype, name },
        print_format: printFormat,
        no_letterhead: withLetterhead ? 0 : 1,
      });
      const result = response?.message;
      setHtmlContent(typeof result === 'string' ? result : result?.html || '');
    } catch (err) {
      console.error('Failed to load print HTML:', err);
    } finally {
      setLoading(false);
    }
  }, [doctype, name, printFormat, withLetterhead]);

  useEffect(() => {
    fetchPrintHTML();
  }, [fetchPrintHTML]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-card p-4 border rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-48">
            <Select value={printFormat} onValueChange={setPrintFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Print Format" />
              </SelectTrigger>
              <SelectContent>
                {availableFormats.map((fmt) => (
                  <SelectItem key={fmt} value={fmt}>
                    {fmt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="letterhead"
              checked={withLetterhead}
              onCheckedChange={(checked) => setWithLetterhead(checked === true)}
            />
            <label htmlFor="letterhead" className="text-xs cursor-pointer font-medium">
              With Letterhead
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print / PDF
          </Button>
        </div>
      </div>

      <Card className="min-h-[700px] border shadow-md p-8 bg-white text-black">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center text-sm text-muted-foreground">Loading print preview...</div>
          ) : (
            <iframe
              ref={iframeRef}
              title="Print Preview"
              srcDoc={htmlContent}
              sandbox="allow-same-origin allow-scripts allow-modals"
              className="w-full h-[700px] border-0"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};
