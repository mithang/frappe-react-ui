import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDocList, useDocMeta } from '@/hooks/useFrappe';
import { useToast } from '@/hooks/use-toast';

const DynamicList: React.FC = () => {
  const { doctype } = useParams<{ doctype: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { meta, isLoading: metaLoading } = useDocMeta(doctype || '');
  const { data, isLoading, error, refresh } = useDocList(doctype || '', {
    fields: ['name', 'creation', 'modified'],
    limit_page_length: 20,
  });

  if (!doctype) {
    return <div>Invalid doctype</div>;
  }

  if (metaLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Error loading {doctype} list</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={refresh} className="mt-4">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (name: string) => {
    navigate(`/doctype/${doctype}/${name}`);
  };

  const handleNewDoc = () => {
    navigate(`/doctype/${doctype}/new`);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{doctype} List</h1>
          <p className="text-muted-foreground">
            Manage your {doctype.toLowerCase()} records
          </p>
        </div>
        <Button onClick={handleNewDoc}>
          New {doctype}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All {doctype}s</CardTitle>
              <CardDescription>
                {filteredData.length} of {data.length} records
              </CardDescription>
            </div>
            <Input
              placeholder={`Search ${doctype}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow
                    key={item.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(item.name)}
                  >
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      {new Date(item.creation).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(item.modified).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredData.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? 'No records match your search' : `No ${doctype} records found`}
              </p>
              {!searchTerm && (
                <Button onClick={handleNewDoc} className="mt-4">
                  Create your first {doctype}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DynamicList;