import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFormController } from '@/hooks/useFormController';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { FieldDispatcher } from '@/views/fields/FieldDispatcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import type { DocField, DocTypeMeta } from '@/core/types';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { NumberCardWidget } from '@/components/widgets/NumberCardWidget';

/**
 * SmartForm - SMVC-based dynamic form component
 * Automatically uses custom DocType forms if registered
 */
const SmartForm: React.FC = () => {
    const { doctype, name } = useParams<{ doctype: string; name?: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Check for custom form component
    const CustomForm = doctype ? DocTypeRegistry.getForm(doctype) : undefined;
    if (CustomForm) {
        return <CustomForm doctype={doctype!} name={name} />;
    }

    // Use default dynamic form
    return <DefaultForm doctype={doctype!} name={name} />;
};

// ============================================================================
// Dashboard Preview Component
// ============================================================================

const DashboardPreview: React.FC<{ doc: any; doctype: string }> = ({ doc, doctype }) => {
    // Only render for 'Dashboard' DocType
    if (doctype !== 'Dashboard') return null;

    const charts = doc.charts || [];
    const numberCards = doc.cards || [];

    if (charts.length === 0 && numberCards.length === 0) return null;

    return (
        <div className="space-y-6 mb-8 p-6 bg-muted/20 border rounded-lg">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">Dashboard Preview</h3>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Live Preview</span>
            </div>

            {/* Number Cards Grid */}
            {numberCards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {numberCards.map((card: any, index: number) => (
                        <div key={index} className="col-span-1 h-32">
                            <NumberCardWidget
                                cardName={card.card}
                                col={12} // Full width of the grid cell
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Charts Grid */}
            {charts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {charts.map((chart: any, index: number) => {
                        const isFullWidth = chart.width === 'Full';
                        return (
                            <div key={index} className={isFullWidth ? 'col-span-1 md:col-span-2' : 'col-span-1'}>
                                <ChartWidget
                                    chartName={chart.chart}
                                    col={12} // Full width of the grid cell
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

interface DefaultFormProps {
    doctype: string;
    name?: string;
}

const DefaultForm: React.FC<DefaultFormProps> = ({ doctype, name }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const isNew = !name || name === 'new';
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const {
        frm,
        doc,
        meta,
        isLoading,
        isSaving,
        isDirty,
        errors,
        save,
        setValue,
    } = useFormController({
        doctype,
        name,
        onSave: (savedDoc) => {
            toast({
                title: 'Success',
                description: `${doctype} ${isNew ? 'created' : 'updated'} successfully`,
            });
            navigate(`/doctype/${doctype}`);
        },
        onError: (error) => {
            const msg = error.message || `Failed to ${isNew ? 'create' : 'update'} ${doctype}`;
            setLoadError(msg);
            toast({
                title: 'Error',
                description: msg,
                variant: 'destructive',
            });
        },
    });

    if (isLoading) {
        return <FormSkeleton />;
    }

    if (!meta || !doc) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-destructive">
                            <p className="font-semibold text-lg mb-2">Failed to load form</p>
                            {loadError && <p className="text-muted-foreground mb-4">{loadError}</p>}
                            <Button onClick={() => navigate(-1)} className="mt-4">
                                Go Back
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await save();
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            {isNew ? `New ${doctype}` : `Edit ${doctype}`}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {isNew ? `Create a new ${doctype.toLowerCase()} record` : `Modify ${doctype.toLowerCase()} details`}
                            {isDirty && <span className="text-yellow-600 ml-2">(unsaved changes)</span>}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/doctype/${doctype}`)}>
                            ← Back to List
                        </Button>
                        <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                            {isSaving ? 'Saving...' : isNew ? 'Create' : 'Update'}
                        </Button>
                    </div>
                </div>

                {/* Form */}
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
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <DashboardPreview doc={doc} doctype={doctype} />

                            <FormContent
                                meta={meta}
                                doc={doc}
                                errors={errors}
                                setValue={setValue}
                                doctype={doctype}
                                frm={frm}
                            />

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                                <Button type="submit" disabled={isSaving} size="sm">
                                    {isSaving ? 'Saving...' : isNew ? 'Create' : 'Update'}
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// ============================================================================
// Form Content Renderer
// ============================================================================

interface FormContentProps {
    meta: DocTypeMeta;
    doc: any;
    errors: Record<string, string>;
    setValue: (fieldname: string, value: any) => void;
    doctype: string;
    frm: any;
}

const FormContent: React.FC<FormContentProps> = ({ meta, doc, errors, setValue, doctype, frm }) => {
    const { tabs, sections, fields } = groupFieldsByStructure(meta.fields);

    // Render tabs if present
    if (tabs.length > 0) {
        const defaultTab = tabs[0]?.label.toLowerCase().replace(/\s+/g, '-') || 'tab-0';

        return (
            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                    {tabs.map((tab, index) => (
                        <TabsTrigger
                            key={index}
                            value={tab.label.toLowerCase().replace(/\s+/g, '-') || `tab-${index}`}
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {tabs.map((tab, tabIndex) => (
                    <TabsContent
                        key={tabIndex}
                        value={tab.label.toLowerCase().replace(/\s+/g, '-') || `tab-${tabIndex}`}
                        className="space-y-6 mt-6"
                    >
                        {tab.sections.map((section, sectionIndex) => (
                            <SectionRenderer
                                key={sectionIndex}
                                section={section}
                                doc={doc}
                                errors={errors}
                                setValue={setValue}
                                doctype={doctype}
                                frm={frm}
                            />
                        ))}
                    </TabsContent>
                ))}
            </Tabs>
        );
    }

    // Render sections if present
    if (sections.length > 0) {
        return (
            <div className="space-y-6">
                {sections.map((section, index) => (
                    <SectionRenderer
                        key={index}
                        section={section}
                        doc={doc}
                        errors={errors}
                        setValue={setValue}
                        doctype={doctype}
                        frm={frm}
                    />
                ))}
            </div>
        );
    }

    // Render plain fields
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((field) => (
                <FieldDispatcher
                    key={field.fieldname}
                    field={field}
                    value={doc[field.fieldname]}
                    onChange={(value) => setValue(field.fieldname, value)}
                    doctype={doctype}
                    error={errors[field.fieldname]}
                    frm={frm}
                />
            ))}
        </div>
    );
};

// ============================================================================
// Section Renderer
// ============================================================================

interface SectionProps {
    section: {
        label: string;
        columns: DocField[][];
    };
    doc: any;
    errors: Record<string, string>;
    setValue: (fieldname: string, value: any) => void;
    doctype: string;
    frm: any;
}

const SectionRenderer: React.FC<SectionProps> = ({ section, doc, errors, setValue, doctype, frm }) => {
    // Determine grid columns based on actual column breaks
    const gridCols = section.columns.length === 1 ? 'grid-cols-1' :
        section.columns.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
            section.columns.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

    const content = (
        <div className={`grid gap-4 ${gridCols}`}>
            {section.columns.map((column, colIndex) => (
                <div key={colIndex} className="space-y-4">
                    {column.map((field) => (
                        <FieldDispatcher
                            key={field.fieldname}
                            field={field}
                            value={doc[field.fieldname]}
                            onChange={(value) => setValue(field.fieldname, value)}
                            doctype={doctype}
                            error={errors[field.fieldname]}
                            frm={frm}
                        />
                    ))}
                </div>
            ))}
        </div>
    );

    if (!section.label) {
        return <div className="space-y-4">{content}</div>;
    }

    return (
        <div className="space-y-4">
            <h3 className="text-base font-semibold text-foreground border-b pb-2">
                {section.label}
            </h3>
            <div className="pt-2">
                {content}
            </div>
        </div>
    );
};

// ============================================================================
// Helper Functions
// ============================================================================

function groupFieldsByStructure(fields: DocField[]) {
    const groups: {
        tabs: { label: string; sections: { label: string; columns: DocField[][] }[] }[];
        sections: { label: string; columns: DocField[][] }[];
        fields: DocField[];
    } = { tabs: [], sections: [], fields: [] };

    let currentTab: { label: string; sections: { label: string; columns: DocField[][] }[] } | null = null;
    let currentSection: { label: string; columns: DocField[][] } | null = null;
    let currentColumnIndex = 0;

    for (const field of fields) {
        if (field.fieldtype === 'Tab Break') {
            if (currentTab) {
                if (currentSection) {
                    currentTab.sections.push(currentSection);
                    currentSection = null;
                }
                groups.tabs.push(currentTab);
            }
            currentTab = { label: field.label || 'Unnamed Tab', sections: [] };
            currentColumnIndex = 0;
        } else if (field.fieldtype === 'Section Break') {
            if (currentSection) {
                if (currentTab) {
                    currentTab.sections.push(currentSection);
                } else {
                    groups.sections.push(currentSection);
                }
            }
            currentSection = { label: field.label || '', columns: [[]] };
            currentColumnIndex = 0;
        } else if (field.fieldtype === 'Column Break') {
            if (currentSection) {
                currentColumnIndex++;
                if (!currentSection.columns[currentColumnIndex]) {
                    currentSection.columns[currentColumnIndex] = [];
                }
            }
        } else if (!field.hidden && field.fieldtype !== 'HTML') {
            if (currentSection) {
                if (!currentSection.columns[currentColumnIndex]) {
                    currentSection.columns[currentColumnIndex] = [];
                }
                currentSection.columns[currentColumnIndex].push(field);
            } else if (currentTab) {
                if (currentTab.sections.length === 0) {
                    currentTab.sections.push({ label: '', columns: [[]] });
                }
                const lastSection = currentTab.sections[currentTab.sections.length - 1];
                lastSection.columns[0].push(field);
            } else {
                groups.fields.push(field);
            }
        }
    }

    // Clean up
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
}

// ============================================================================
// Loading Skeleton
// ============================================================================

const FormSkeleton: React.FC = () => (
    <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto p-6">
            <div className="animate-pulse space-y-6">
                <div className="space-y-2">
                    <div className="h-8 bg-muted rounded w-1/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                </div>
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <div className="h-6 bg-muted rounded w-1/3" />
                        <div className="h-4 bg-muted rounded w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-4 bg-muted rounded w-1/3" />
                                    <div className="h-10 bg-muted rounded" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
);

export default SmartForm;
