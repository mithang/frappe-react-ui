import React, { useState } from 'react';
import { Paperclip, Sparkles, History, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { AIChatService } from '@/lib/ai/AIChatService';

export const AIChatBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!query.trim() || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      const { targetDocType, prefill } = await AIChatService.parseQueryToDoc(query);
      
      setQuery('');
      // Navigate to the new form and pass the prefill data in route state
      navigate(`/doctype/${targetDocType}/new`, { state: { prefill } });
    } catch (error) {
      console.error("AI Parsing failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-3xl px-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="flex items-center gap-1.5 bg-background border border-primary/50 ring-2 ring-primary/20 rounded-[2rem] shadow-2xl shadow-primary/10 p-1.5 pr-1.5 pl-3">
        
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/50 shrink-0">
                <Paperclip className="h-4.5 w-4.5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Attach context</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/50 shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">AI Capabilities</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          placeholder={isProcessing ? "Processing via Vyogo AI..." : "Ask Vyogo AI about your data..."}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:outline-none px-3 py-2.5 text-[15px] placeholder:text-muted-foreground/70 min-w-0 disabled:opacity-50"
        />

        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/50 shrink-0">
                <History className="h-5 w-5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">Chat History</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        <Button 
          variant={query ? 'default' : 'secondary'}
          size="icon" 
          onClick={handleSubmit}
          disabled={!query.trim() || isProcessing}
          className={`h-9 w-9 rounded-full shrink-0 transition-all ml-1 ${query ? 'shadow-md' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
        >
          {isProcessing ? (
            <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" strokeWidth={1.5} />
          )}
        </Button>

      </div>
    </div>
  );
};
