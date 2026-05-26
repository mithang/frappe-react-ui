import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useDocMeta, useFrappe } from '@/hooks/useFrappe';
import { useToast } from '@/hooks/use-toast';

const DynamicForm: React.FC = () => {
  const { doctype, name } = useParams<{ doctype: string; name?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = name === 'new';

  const { meta, isLoading: metaLoading } = useDocMeta(doctype || '');
  const { getDoc, createDoc, updateDoc, isLoading } = useFrappe();
  const [docData, setDocData] = useState<any>(null);

  // Create dynamic schema based on meta
  const createFormSchema = (meta: any) => {
    if (!meta?.fields) return z.object({});

    const schemaFields: any = {};
    
    meta.fields.forEach((field: any) => {
      if (field.hidden || field.read_only) return;

      let fieldSchema: any;
      
      switch (field.fieldtype) {
        case 'Data':
        case 'Small Text':
        case 'Text':
        case 'Long Text':
          fieldSchema = z.string();
          break;
        case 'Int':
          fieldSchema = z.coerce.number();
          break;
        case 'Float':
        case 'Currency':
        case 'Percent':
          fieldSchema = z.coerce.number();
          break;
        case 'Check':
          fieldSchema = z.boolean();
          break;
        case 'Select':
        case 'Link':
          fieldSchema = z.string();
          break;
        case 'Date':
        case 'Datetime':
        case 'Time':
          fieldSchema = z.string();
          break;
        case 'Table':
          fieldSchema = z.array(z.any()).optional();
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.reqd && !['Table'].includes(field.fieldtype)) {
        if (fieldSchema.min) {
          schemaFields[field.fieldname] = fieldSchema.min(1, `${field.label} is required`);
        } else {
          schemaFields[field.fieldname] = fieldSchema;
        }
      } else {
        schemaFields[field.fieldname] = fieldSchema.optional ? fieldSchema.optional() : fieldSchema;
      }
    });

    return z.object(schemaFields);
  };

  const formSchema = meta ? createFormSchema(meta) : z.object({});
  
  // Debug logging
  console.log('DynamicForm Debug:', {
    doctype,
    name,
    isNew,
    metaLoading,
    meta: meta ? {
      name: meta.name,
      fields: meta.fields?.length,
      fieldNames: meta.fields?.map(f => `${f.fieldname} (${f.fieldtype})${f.hidden ? ' [hidden]' : ''}${f.read_only ? ' [readonly]' : ''}`)
    } : null,
    docData
  });
  
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!isNew && doctype && name) {
      loadDoc();
    }
  }, [doctype, name, isNew]);

  useEffect(() => {
    if (docData) {
      // Set form values from loaded document
      const formData: any = {};
      meta?.fields?.forEach((field: any) => {
        if (docData[field.fieldname] !== undefined) {
          formData[field.fieldname] = docData[field.fieldname];
        }
      });
      form.reset(formData);
    }
  }, [docData, meta, form]);

  const loadDoc = async () => {
    try {
      const doc = await getDoc(doctype!, name!);
      setDocData(doc);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load document',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: any) => {
    try {
      if (isNew) {
        await createDoc(doctype!, data);
        toast({
          title: 'Success',
          description: `${doctype} created successfully`,
        });
      } else {
        await updateDoc(doctype!, name!, data);
        toast({
          title: 'Success',
          description: `${doctype} updated successfully`,
        });
      }
      navigate(`/doctype/${doctype}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${isNew ? 'create' : 'update'} ${doctype}`,
        variant: 'destructive',
      });
    }
  };

  // Group fields by tabs and sections
  const groupFieldsByStructure = (fields: any[]) => {
    if (!fields) return { tabs: [], sections: [], fields: [] };

    const groups: {
      tabs: { label: string; sections: any[] }[];
      sections: any[];
      fields: any[];
    } = {
      tabs: [],
      sections: [],
      fields: []
    };

    let currentTab: { label: string; sections: any[] } | null = null;
    let currentSection: { label: string; fields: any[]; columns: any[][] } | null = null;
    let currentColumnIndex = 0;

    fields.forEach((field) => {
      if (field.fieldtype === 'Tab Break') {
        // Save previous tab
        if (currentTab) {
          if (currentSection) {
            currentTab.sections.push(currentSection);
            currentSection = null;
          }
          groups.tabs.push(currentTab);
        }
        // Start new tab
        currentTab = {
          label: field.label || 'Unnamed Tab',
          sections: []
        };
        currentColumnIndex = 0;
      } else if (field.fieldtype === 'Section Break') {
        // Save previous section
        if (currentSection) {
          if (currentTab) {
            currentTab.sections.push(currentSection);
          } else {
            groups.sections.push(currentSection);
          }
        }
        // Start new section
        currentSection = {
          label: field.label || '',
          fields: [],
          columns: [[]]
        };
        currentColumnIndex = 0;
      } else if (field.fieldtype === 'Column Break') {
        if (currentSection) {
          currentColumnIndex++;
          if (!currentSection.columns[currentColumnIndex]) {
            currentSection.columns[currentColumnIndex] = [];
          }
        }
      } else if (!field.hidden && !field.read_only && field.fieldtype !== 'HTML') {
        // Regular field
        if (currentSection) {
          if (!currentSection.columns[currentColumnIndex]) {
            currentSection.columns[currentColumnIndex] = [];
          }
          currentSection.columns[currentColumnIndex].push(field);
        } else if (currentTab) {
          // Field belongs to tab but no section yet
          if (currentTab.sections.length === 0) {
            currentTab.sections.push({
              label: '',
              fields: [],
              columns: [[]]
            });
          }
          const lastSection = currentTab.sections[currentTab.sections.length - 1];
          if (!lastSection.columns[0]) {
            lastSection.columns[0] = [];
          }
          lastSection.columns[0].push(field);
        } else {
          // Field doesn't belong to any tab or section
          groups.fields.push(field);
        }
      }
    });

    // Clean up remaining section and tab
    if (currentSection) {
      if (currentTab) {
        currentTab.sections.push(currentSection);
      } else {
        groups.sections.push(currentSection);
      }
    }
    if (currentTab) {
      groups.tabs.push(currentTab);
    }

    return groups;
  };

  const renderSection = (section: any, index: number) => {
    if (!section.label) {
      // Section without label - render columns directly
      return (
        <div key={index} className="space-y-4">
          <div className={`grid gap-4 ${section.columns.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {section.columns.map((column: any[], colIndex: number) => (
              <div key={colIndex} className="space-y-4">
                {column.map(renderField)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Section with label - use accordion
    return (
      <Accordion key={index} type="single" collapsible className="w-full">
        <AccordionItem value={`section-${index}`} className="border-border">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            {section.label}
          </AccordionTrigger>
          <AccordionContent className="pt-4">
            <div className={`grid gap-4 ${section.columns.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
              {section.columns.map((column: any[], colIndex: number) => (
                <div key={colIndex} className="space-y-4">
                  {column.map(renderField)}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const renderFormContent = () => {
    if (!meta?.fields?.length) {
      return (
        <div className="col-span-full text-center text-muted-foreground py-8">
          No fields available for {doctype}
        </div>
      );
    }

    const groups = groupFieldsByStructure(meta.fields);
    
    // If we have tabs, render tabs
    if (groups.tabs.length > 0) {
      const defaultTab = groups.tabs[0]?.label.toLowerCase().replace(/\s+/g, '-') || 'tab-0';
      
      return (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className={`grid w-full grid-cols-${Math.min(groups.tabs.length, 4)}`}>
            {groups.tabs.map((tab, index) => (
              <TabsTrigger 
                key={index} 
                value={tab.label.toLowerCase().replace(/\s+/g, '-') || `tab-${index}`}
                className="text-sm"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.tabs.map((tab, tabIndex) => (
            <TabsContent 
              key={tabIndex} 
              value={tab.label.toLowerCase().replace(/\s+/g, '-') || `tab-${tabIndex}`}
              className="space-y-6 mt-6"
            >
              {tab.sections.map(renderSection)}
            </TabsContent>
          ))}
        </Tabs>
      );
    }

    // If we have sections but no tabs
    if (groups.sections.length > 0) {
      return (
        <div className="space-y-6">
          {groups.sections.map(renderSection)}
        </div>
      );
    }

    // Plain fields with no structure
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {groups.fields.map(renderField)}
      </div>
    );
  };

  const renderField = (field: any) => {
    console.log('Rendering field - full object:', field);
    if (!field || field.hidden || field.read_only) return null;

    const fieldName = field.fieldname;
    const fieldLabel = field.label || field.fieldname || 'Unnamed Field';

    // Handle child table fields
    if (field.fieldtype === 'Table') {
      return (
        <div key={fieldName} className="col-span-full">
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{fieldLabel}</CardTitle>
              {field.description && (
                <CardDescription className="text-xs">{field.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                Child table with {Array.isArray(docData?.[fieldName]) ? docData[fieldName].length : 0} rows
                {field.options && ` (${field.options})`}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <FormField
        key={fieldName}
        control={form.control}
        name={fieldName as any}
        render={({ field: formField }) => (
           <FormItem className="space-y-1">
             <FormLabel className="text-sm font-medium text-foreground">
               {fieldLabel}
               {field.reqd && <span className="text-destructive ml-1">*</span>}
             </FormLabel>
            <FormControl>
              {(() => {
                switch (field.fieldtype) {
                  case 'Text':
                  case 'Small Text':
                  case 'Long Text':
                    return (
                      <Textarea
                         placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                        className="min-h-[80px] resize-none"
                        {...formField}
                      />
                    );
                  
                  case 'Select':
                    const options = field.options?.split('\n').filter(Boolean) || [];
                    return (
                      <Select
                        onValueChange={formField.onChange}
                        defaultValue={formField.value}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}`} />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border shadow-md z-50">
                          {options.map((option: string) => (
                            <SelectItem key={option} value={option} className="hover:bg-accent">
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  
                  case 'Link':
                    return (
                      <Input
                        placeholder={`Select ${fieldLabel.toLowerCase()}`}
                        className="bg-background"
                        {...formField}
                      />
                    );
                  
                  case 'Int':
                  case 'Float':
                  case 'Currency':
                  case 'Percent':
                    return (
                      <Input
                        type="number"
                        step={field.fieldtype === 'Int' ? '1' : '0.01'}
                         placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                        className="bg-background"
                        {...formField}
                        onChange={(e) => formField.onChange(e.target.value ? Number(e.target.value) : '')}
                      />
                    );
                  
                  case 'Check':
                    return (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={formField.value || false}
                          onChange={(e) => formField.onChange(e.target.checked)}
                        />
                        <span className="text-sm text-muted-foreground">Enable {fieldLabel.toLowerCase()}</span>
                      </div>
                    );
                  
                  case 'Date':
                    return (
                      <Input
                        type="date"
                        className="bg-background"
                        {...formField}
                        value={formField.value ? formField.value.split(' ')[0] : ''}
                        onChange={(e) => formField.onChange(e.target.value)}
                      />
                    );
                  
                  case 'Datetime':
                    return (
                      <Input
                        type="datetime-local"
                        className="bg-background"
                        {...formField}
                        value={formField.value ? formField.value.replace(' ', 'T').substring(0, 16) : ''}
                        onChange={(e) => formField.onChange(e.target.value.replace('T', ' '))}
                      />
                    );
                  
                  case 'Time':
                    return (
                      <Input
                        type="time"
                        className="bg-background"
                        {...formField}
                      />
                    );
                  
                  default:
                    return (
                      <Input
                        placeholder={`Enter ${fieldLabel.toLowerCase()}`}
                        className="bg-background"
                        {...formField}
                      />
                    );
                }
              })()}
            </FormControl>
            {field.description && (
              <FormDescription className="text-xs text-muted-foreground">
                {field.description}
              </FormDescription>
            )}
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    );
  };

  if (!doctype) {
    return <div>Invalid doctype</div>;
  }

  if (metaLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="space-y-2">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-10 bg-muted rounded"></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isNew ? `New ${doctype}` : `Edit ${doctype}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNew ? `Create a new ${doctype.toLowerCase()} record` : `Modify ${doctype.toLowerCase()} details`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/doctype/${doctype}`)}>
            Back to List
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-medium">
              {isNew ? `New ${doctype}` : name}
            </CardTitle>
            <CardDescription className="text-sm">
              {isNew ? 'Fill in the details below' : 'Update the fields you want to modify'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {renderFormContent()}
                
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <Button type="submit" disabled={isLoading} size="sm">
                    {isLoading ? 'Saving...' : isNew ? 'Create' : 'Update'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/doctype/${doctype}`)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DynamicForm;