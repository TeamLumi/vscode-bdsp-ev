import * as fs from 'fs';
import * as path from 'path';

export interface CommandArg {
    TentativeName: string;
    Description: string;
    Type: string[];
    Optional: boolean;
}

export interface Command {
    Id: number;
    Name: string;
    Description: string;
    Dummy: boolean;
    Animation: boolean;
    Args: CommandArg[];
}

export interface WorkVariable {
    Id: number;
    Name: string;
    Description: string;
}

export interface Flag {
    Id: number;
    Name: string;
    Description: string;
}

export interface SysFlag {
    Id: number;
    Name: string;
    Description: string;
}

export class DataLoader {
    private static instance: DataLoader;

    public commands: Command[] = [];
    public commandLookup: Map<string, Command> = new Map();
    public workVariables: WorkVariable[] = [];
    public workLookup: Map<string, WorkVariable> = new Map();
    public flags: Flag[] = [];
    public flagLookup: Map<string, Flag> = new Map();
    public sysFlags: SysFlag[] = [];
    public sysFlagLookup: Map<string, SysFlag> = new Map();

    private constructor() {}

    public static getInstance(): DataLoader {
        if (!DataLoader.instance) {
            DataLoader.instance = new DataLoader();
        }
        return DataLoader.instance;
    }

    public load(extensionPath: string): void {
        const dataPath = path.join(extensionPath, 'data');

        this.loadCommands(path.join(dataPath, 'commands.json'));
        this.loadWork(path.join(dataPath, 'work.json'));
        this.loadFlags(path.join(dataPath, 'flags.json'));
        this.loadSysFlags(path.join(dataPath, 'sys_flags.json'));
    }

    private loadCommands(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.commands = JSON.parse(content);
            this.commandLookup.clear();
            for (const cmd of this.commands) {
                if (cmd.Name) {
                    this.commandLookup.set(cmd.Name, cmd);
                }
            }
        } catch (e) {
            console.error('Failed to load commands.json:', e);
        }
    }

    private loadWork(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.workVariables = JSON.parse(content);
            this.workLookup.clear();
            for (const work of this.workVariables) {
                if (work.Name) {
                    this.workLookup.set(work.Name, work);
                }
            }
        } catch (e) {
            console.error('Failed to load work.json:', e);
        }
    }

    private loadFlags(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.flags = JSON.parse(content);
            this.flagLookup.clear();
            for (const flag of this.flags) {
                if (flag.Name) {
                    this.flagLookup.set(flag.Name, flag);
                }
            }
        } catch (e) {
            console.error('Failed to load flags.json:', e);
        }
    }

    private loadSysFlags(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.sysFlags = JSON.parse(content);
            this.sysFlagLookup.clear();
            for (const sysFlag of this.sysFlags) {
                if (sysFlag.Name) {
                    this.sysFlagLookup.set(sysFlag.Name, sysFlag);
                }
            }
        } catch (e) {
            console.error('Failed to load sys_flags.json:', e);
        }
    }

    public getCommand(name: string): Command | undefined {
        return this.commandLookup.get(name);
    }

    public getWork(name: string): WorkVariable | undefined {
        return this.workLookup.get(name);
    }

    public getFlag(name: string): Flag | undefined {
        return this.flagLookup.get(name);
    }

    public getSysFlag(name: string): SysFlag | undefined {
        return this.sysFlagLookup.get(name);
    }

    public getCommandSignature(cmd: Command): string {
        const args = cmd.Args || [];
        const paramLabels = args.map(arg => arg.TentativeName || 'arg');
        return `${cmd.Name}(${paramLabels.join(', ')})`;
    }

    public getArgDocumentation(arg: CommandArg): string {
        const typeStr = arg.Type ? arg.Type.join(' | ') : 'Any';
        let doc = `(\`${typeStr}\`)`;
        if (arg.Optional) {
            doc += ' (Optional)';
        }
        if (arg.Description) {
            doc += `\n\n${arg.Description}`;
        }
        return doc;
    }
}
