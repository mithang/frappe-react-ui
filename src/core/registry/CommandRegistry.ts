// CommandRegistry (1C) — command-palette (⌘K) entries. CommandPalette.tsx currently hardcodes
// its command list; 2D wires it to read from here so extensions can add entries.

export interface Command {
  label: string;
  onRun: () => void;
  group?: string;
  icon?: string;
  shortcut?: string;
}

class CommandRegistryImpl {
  private commands: Command[] = [];

  add(command: Command): () => void {
    this.commands.push(command);
    return () => {
      this.commands = this.commands.filter((c) => c !== command);
    };
  }

  getCommands(): Command[] {
    return [...this.commands];
  }

  clear(): void {
    this.commands = [];
  }
}

export const CommandRegistry = new CommandRegistryImpl();
