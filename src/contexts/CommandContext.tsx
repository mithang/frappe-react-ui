
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface CommandContextType {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    toggle: () => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export const CommandProvider = ({ children }: { children: ReactNode }) => {
    const [open, setOpen] = useState(false);

    const toggle = useCallback(() => {
        setOpen((prev) => !prev);
    }, []);

    return (
        <CommandContext.Provider value={{ open, setOpen, toggle }}>
            {children}
        </CommandContext.Provider>
    );
};

export const useCommand = () => {
    const context = useContext(CommandContext);
    if (context === undefined) {
        throw new Error('useCommand must be used within a CommandProvider');
    }
    return context;
};
