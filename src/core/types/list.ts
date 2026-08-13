// List/reportview types (1A). Verified shapes — see src/test/fixtures/frappe/README.md and
// docs/agent-rules/frappe-api.md: `reportview.get` returns columnar data with NO count;
// pagination params are `start`/`page_length`, not `limit_start`/`limit_page_length`.

export type FrappeFilterOperator =
    | '=' | '!=' | '>' | '<' | '>=' | '<='
    | 'like' | 'not like' | 'in' | 'not in' | 'is' | 'between';

export type FrappeFilter =
    | [fieldname: string, operator: FrappeFilterOperator, value: unknown]
    | [fieldname: string, value: unknown];

export interface GetListArgs {
    doctype: string;
    fields?: string[];
    filters?: FrappeFilter[];
    orderBy?: string;
    start?: number;
    pageLength?: number;
}

export interface UploadFileArgs {
    file: File;
    doctype?: string;
    docname?: string;
    fieldname?: string;
    isPrivate?: boolean;
    folder?: string;
}

export interface UploadedFile {
    name: string;
    file_name: string;
    file_url: string;
    is_private: 0 | 1;
}

export interface LinkOption {
    value: string;
    description?: string;
    label?: string;
}
