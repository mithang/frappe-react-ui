import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFormController } from '@/hooks/useFormController';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { FieldDispatcher } from '@/views/fields/FieldDispatcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { DocField, DocTypeMeta, Document } from '@/core/types';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { NumberCardWidget } from '@/components/widgets/NumberCardWidget';
import { FormStoreProvider } from '@/store/formStore';
import { getFrappeClient } from '@/lib/api/client';
import type { FormControllerImpl } from '@/controllers/FormController';

/**
 * SmartForm - SMVC-based dynamic form component
 * Automatically uses custom DocType forms if registered
 */
const SmartForm: React.FC<{ doctype?: string; name?: string; onClose?: () => void }> = ({
    doctype: propDoctype,
    name: propName,
    onClose,
}) => {
    const params = useParams<{ doctype: string; name?: string }>();
    const doctype = propDoctype || params.doctype;
    const name = propName || params.name;
    const navigate = useNavigate();
    const { toast } = useToast();

    // Check for custom form component
    const CustomForm = doctype ? DocTypeRegistry.getForm(doctype) : undefined;
    if (CustomForm) {
        // @ts-ignore - custom forms may not yet support onClose prop
        return <CustomForm doctype={doctype!} name={name} onClose={onClose} />;
    }

    // Use default dynamic form
    return <DefaultForm doctype={doctype!} name={name} onClose={onClose} />;
};

// ============================================================================
// Dashboard Preview Component
// ============================================================================

interface DashboardChartRef {
    chart: string;
    width?: string;
}

interface DashboardCardRef {
    card: string;
}

const DashboardPreview: React.FC<{ doc: Document; doctype: string }> = ({ doc, doctype }) => {
    // Only render for 'Dashboard' DocType
    if (doctype !== 'Dashboard') return null;

    const charts = (doc.charts as DashboardChartRef[] | undefined) || [];
    const numberCards = (doc.cards as DashboardCardRef[] | undefined) || [];

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
                    {numberCards.map((card, index: number) => (
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
                    {charts.map((chart, index: number) => {
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
    onClose?: () => void;
}

const DefaultForm: React.FC<DefaultFormProps> = ({ doctype, name, onClose }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const isNew = !name || name === 'new';
    const [loadError, setLoadError] = React.useState<string | null>(null);

    const {
        frm,
        store,
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
            if (onClose) onClose();
            else navigate(`/doctype/${doctype}`);
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
        try {
            await save('Save');
        } catch {
            // useFormController's onError already surfaced this as a toast; rethrowing here just
            // produced an "Uncaught (in promise)" console error on every failed/invalid save.
        }
    };

    const docstatus = doc.docstatus ?? 0;
    const isSubmittable = !!meta.is_submittable;
    const canSubmit = isSubmittable && docstatus === 0 && !isNew;
    const canCancelDoc = isSubmittable && docstatus === 1;
    const canAmend = isSubmittable && docstatus === 2;

    const handleSubmitDoc = async () => {
        try {
            await save('Submit');
        } catch {
            // onError already toasted — nothing further to do here
        }
    };

    const handleCancelDoc = async () => {
        try {
            await frm?.cancel();
            toast({ title: 'Cancelled', description: `${doctype} ${name} has been cancelled.` });
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to cancel';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        try {
            await getFrappeClient().deleteDoc(doctype, name!);
            toast({ title: 'Deleted', description: `${doctype} ${name} has been deleted.` });
            navigate(`/doctype/${doctype}`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to delete';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
    };

    const handleAmend = async () => {
        try {
            const amended = { ...doc, name: '', docstatus: 0 as const, amended_from: doc.name, __islocal: 1 as const };
            const { doc: newDoc } = await getFrappeClient().saveDoc(amended, 'Save');
            toast({ title: 'Amended', description: `Created ${newDoc.name} from ${doc.name}.` });
            navigate(`/doctype/${doctype}/${newDoc.name}`);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to amend';
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        }
    };

    return (
        <FormStoreProvider value={store!}>
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
                                {isSubmittable && !isNew && (
                                    <span className="ml-2 font-medium">
                                        {docstatus === 0 ? '· Draft' : docstatus === 1 ? '· Submitted' : '· Cancelled'}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onClose ? onClose() : navigate(`/doctype/${doctype}`)}>
                                {onClose ? 'Close' : '← Back to List'}
                            </Button>
                            {onClose && !isNew && (
                                <Button variant="outline" size="sm" onClick={() => window.open(`/doctype/${doctype}/${name}`, '_blank')}>
                                    Open Full View
                                </Button>
                            )}
                            {!isNew && (
                                <Button variant="outline" size="sm" onClick={() => window.open(`/doctype/${doctype}/print/${name}`, '_blank')}>
                                    Print
                                </Button>
                            )}
                            {!isNew && !canAmend && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={isSaving}>
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete {doctype} {name}?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This cannot be undone. This will permanently delete this {doctype.toLowerCase()} record.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            {canAmend && (
                                <Button size="sm" onClick={handleAmend} disabled={isSaving}>
                                    Amend
                                </Button>
                            )}
                            {canCancelDoc && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={isSaving}>
                                            Cancel Document
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Cancel {doctype} {name}?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will cancel the submitted document. You can amend it afterward to create a new draft.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Back</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleCancelDoc}>Cancel Document</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                            {docstatus === 0 && (
                                <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : isNew ? 'Create' : 'Update'}
                                </Button>
                            )}
                            {canSubmit && (
                                <Button size="sm" onClick={handleSubmitDoc} disabled={isSaving}>
                                    Submit
                                </Button>
                            )}
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
                                    readOnly={docstatus !== 0}
                                />

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                                    {docstatus === 0 && (
                                        <Button type="submit" disabled={isSaving} size="sm">
                                            {isSaving ? 'Saving...' : isNew ? 'Create' : 'Update'}
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onClose ? onClose() : navigate(`/doctype/${doctype}`)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </FormStoreProvider>
    );
};

// ============================================================================
// Form Content Renderer
// ============================================================================

interface FormContentProps {
    meta: DocTypeMeta;
    doc: Document;
    errors: Record<string, string>;
    setValue: (fieldname: string, value: unknown) => void;
    doctype: string;
    frm: FormControllerImpl | null;
    readOnly?: boolean;
}

const PlainFields: React.FC<{
    fields: DocField[];
    doc: Document;
    errors: Record<string, string>;
    setValue: (fieldname: string, value: unknown) => void;
    doctype: string;
    frm: FormControllerImpl | null;
    readOnly?: boolean;
}> = ({ fields, doc, errors, setValue, doctype, frm, readOnly }) => (
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
                doc={doc}
                disabled={readOnly && !field.allow_on_submit}
            />
        ))}
    </div>
);

const FormContent: React.FC<FormContentProps> = ({ meta, doc, errors, setValue, doctype, frm, readOnly }) => {
    const { tabs, sections, fields } = groupFieldsByStructure(meta.fields);

    // `fields` here are whatever precedes the FIRST Tab/Section Break — these must always render
    // even when tabs/sections also exist later in the doctype (bug C6: they were previously
    // dropped entirely whenever tabs.length > 0 or sections.length > 0 won the branch below).
    const leadingFields = fields.length > 0 && (
        <PlainFields fields={fields} doc={doc} errors={errors} setValue={setValue} doctype={doctype} frm={frm} readOnly={readOnly} />
    );

    // Sections declared before the first Tab Break (e.g. Journal Entry's leading "Company"/
    // "Posting Date" section) render as plain sections above the tab strip — same placement Desk
    // itself uses — not silently dropped, and not force-fit into whichever tab happens to be first.
    const leadingSections = sections.length > 0 && (
        <>
            {sections.map((section, index) => (
                <SectionRenderer
                    key={`leading-section-${index}`}
                    section={section}
                    doc={doc}
                    errors={errors}
                    setValue={setValue}
                    doctype={doctype}
                    frm={frm}
                    readOnly={readOnly}
                />
            ))}
        </>
    );

    // Render tabs if present
    if (tabs.length > 0) {
        const defaultTab = tabs[0]?.label.toLowerCase().replace(/\s+/g, '-') || 'tab-0';

        return (
            <div className="space-y-6">
                {leadingFields}
                {leadingSections}
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
                                    readOnly={readOnly}
                                />
                            ))}
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        );
    }

    // Render sections if present
    if (sections.length > 0) {
        return (
            <div className="space-y-6">
                {leadingFields}
                {sections.map((section, index) => (
                    <SectionRenderer
                        key={index}
                        section={section}
                        doc={doc}
                        errors={errors}
                        setValue={setValue}
                        doctype={doctype}
                        frm={frm}
                        readOnly={readOnly}
                    />
                ))}
            </div>
        );
    }

    // No tabs or sections — just the leading (only) fields.
    return <PlainFields fields={fields} doc={doc} errors={errors} setValue={setValue} doctype={doctype} frm={frm} readOnly={readOnly} />;
};

// ============================================================================
// Section Renderer
// ============================================================================

interface SectionProps {
    section: {
        label: string;
        columns: DocField[][];
    };
    doc: Document;
    errors: Record<string, string>;
    setValue: (fieldname: string, value: unknown) => void;
    doctype: string;
    frm: FormControllerImpl | null;
    readOnly?: boolean;
}

const SectionRenderer: React.FC<SectionProps> = ({ section, doc, errors, setValue, doctype, frm, readOnly }) => {
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
                            doc={doc}
                            disabled={readOnly && !field.allow_on_submit}
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
            // A Section Break can appear before the FIRST Tab Break (e.g. Journal Entry's
            // leading "Company"/"Posting Date" section) — route it to whichever bucket is
            // active. Previously this only flushed when `currentTab` already existed, so that
            // leading section (and every field in it) was silently dropped at the first Tab
            // Break, never rendered anywhere.
            if (currentSection) {
                if (currentTab) {
                    currentTab.sections.push(currentSection);
                } else {
                    groups.sections.push(currentSection);
                }
                currentSection = null;
            }
            if (currentTab) {
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
