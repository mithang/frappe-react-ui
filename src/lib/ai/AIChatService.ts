export interface AIPrefillData {
    targetDocType: string;
    prefill: Record<string, any>;
}

/**
 * Service to handle AI chat parsing and extraction.
 * Later, this will be connected to MCP servers.
 */
export class AIChatService {
    
    /**
     * MOCK implementation of parsing a natural language query into a DocType and fields.
     */
    static async parseQueryToDoc(query: string): Promise<AIPrefillData> {
        // MOCK: Simulate network/LLM delay
        await new Promise(resolve => setTimeout(resolve, 600));

        const q = query.toLowerCase();
        let targetDocType = 'Task';
        let prefill: Record<string, any> = { description: query };

        if (q.includes('customer')) {
            targetDocType = 'Customer';
            const nameMatch = query.match(/named\s+([a-zA-Z\s]+)/i);
            prefill = {
                customer_name: nameMatch ? nameMatch[1].trim() : 'New Customer',
                customer_group: 'Commercial',
                territory: 'All Territories'
            };
        } else if (q.includes('invoice')) {
            targetDocType = 'Sales Invoice';
            prefill = {
                customer: 'Walk In',
                due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
            };
        } else if (q.includes('lead')) {
            targetDocType = 'Lead';
            const nameMatch = query.match(/for\s+([a-zA-Z\s]+)/i);
            prefill = {
                lead_name: nameMatch ? nameMatch[1].trim() : 'New Lead',
                status: 'Lead'
            };
        }

        return { targetDocType, prefill };
    }
}
