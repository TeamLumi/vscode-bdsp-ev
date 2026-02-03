import * as vscode from 'vscode';
import { DataLoader } from '../data/dataLoader';
import { getWordAtPosition, parseDocument } from '../utils/parser';

export class BDSPHoverProvider implements vscode.HoverProvider {
    private dataLoader: DataLoader;

    constructor() {
        this.dataLoader = DataLoader.getInstance();
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const wordInfo = getWordAtPosition(document, position);
        if (!wordInfo) return null;

        const word = wordInfo.word;

        // Check for command hover
        const cmd = this.dataLoader.getCommand(word);
        if (cmd) {
            return this.createCommandHover(cmd);
        }

        // Check for @work variable hover
        if (word.startsWith('@')) {
            const workName = word.substring(1);
            const work = this.dataLoader.getWork(workName);
            if (work) {
                return this.createWorkHover(work);
            }
            // Check if it's a numeric work reference
            if (/^\d+$/.test(workName)) {
                const workById = this.dataLoader.workVariables.find(w => w.Id === parseInt(workName));
                if (workById) {
                    return this.createWorkHover(workById);
                }
            }
        }

        // Check for #flag hover
        if (word.startsWith('#')) {
            const flagName = word.substring(1);
            const flag = this.dataLoader.getFlag(flagName);
            if (flag) {
                return this.createFlagHover(flag);
            }
            // Check if it's a numeric flag reference
            if (/^\d+$/.test(flagName)) {
                const flagById = this.dataLoader.flags.find(f => f.Id === parseInt(flagName));
                if (flagById) {
                    return this.createFlagHover(flagById);
                }
            }
        }

        // Check for $sysflag hover
        if (word.startsWith('$')) {
            const sysFlagName = word.substring(1);
            const sysFlag = this.dataLoader.getSysFlag(sysFlagName);
            if (sysFlag) {
                return this.createSysFlagHover(sysFlag);
            }
            // Check if it's a numeric sysflag reference
            if (/^\d+$/.test(sysFlagName)) {
                const sysFlagById = this.dataLoader.sysFlags.find(f => f.Id === parseInt(sysFlagName));
                if (sysFlagById) {
                    return this.createSysFlagHover(sysFlagById);
                }
            }
        }

        // Check for label hover
        const parsed = parseDocument(document);
        const label = parsed.labels.get(word);
        if (label) {
            return this.createLabelHover(label.name, label.line);
        }

        // Check for comparator hover
        if (/^(GE|GT|LE|LT|EQ|NE)$/.test(word)) {
            return this.createComparatorHover(word);
        }

        return null;
    }

    private createCommandHover(cmd: { Name: string; Description: string; Args?: { TentativeName: string; Type: string[]; Optional: boolean; Description: string }[] }): vscode.Hover {
        const signature = this.dataLoader.getCommandSignature(cmd as any);
        const contents = new vscode.MarkdownString();

        contents.appendCodeblock(signature, 'bdsp-ev');

        if (cmd.Description) {
            contents.appendMarkdown(`\n\n**Description:**\n\n${cmd.Description}`);
        }

        if (cmd.Args && cmd.Args.length > 0) {
            contents.appendMarkdown('\n\n**Arguments:**\n\n');
            cmd.Args.forEach((arg, i) => {
                const typeStr = arg.Type ? arg.Type.join(' | ') : 'Any';
                const optional = arg.Optional ? ' (Optional)' : '';
                contents.appendMarkdown(`${i + 1}. **${arg.TentativeName || 'arg'}** \`${typeStr}\`${optional}`);
                if (arg.Description) {
                    contents.appendMarkdown(` - ${arg.Description}`);
                }
                contents.appendMarkdown('\n');
            });
        }

        return new vscode.Hover(contents);
    }

    private createWorkHover(work: { Name: string; Id: number; Description: string }): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**Work Variable:** \`@${work.Name}\`\n\n`);
        contents.appendMarkdown(`**ID:** ${work.Id}`);
        if (work.Description) {
            contents.appendMarkdown(`\n\n${work.Description}`);
        }
        return new vscode.Hover(contents);
    }

    private createFlagHover(flag: { Name: string; Id: number; Description: string }): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**Flag:** \`#${flag.Name}\`\n\n`);
        contents.appendMarkdown(`**ID:** ${flag.Id}`);
        if (flag.Description) {
            contents.appendMarkdown(`\n\n${flag.Description}`);
        }
        return new vscode.Hover(contents);
    }

    private createSysFlagHover(sysFlag: { Name: string; Id: number; Description: string }): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**System Flag:** \`$${sysFlag.Name}\`\n\n`);
        contents.appendMarkdown(`**ID:** ${sysFlag.Id}`);
        if (sysFlag.Description) {
            contents.appendMarkdown(`\n\n${sysFlag.Description}`);
        }
        return new vscode.Hover(contents);
    }

    private createLabelHover(name: string, line: number): vscode.Hover {
        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**Label:** \`${name}\`\n\n`);
        contents.appendMarkdown(`Defined at line ${line + 1}`);
        return new vscode.Hover(contents);
    }

    private createComparatorHover(comparator: string): vscode.Hover {
        const descriptions: Record<string, string> = {
            'EQ': 'Equal to (==)',
            'NE': 'Not equal to (!=)',
            'LT': 'Less than (<)',
            'LE': 'Less than or equal to (<=)',
            'GT': 'Greater than (>)',
            'GE': 'Greater than or equal to (>=)'
        };

        const contents = new vscode.MarkdownString();
        contents.appendMarkdown(`**Comparator:** \`${comparator}\`\n\n`);
        contents.appendMarkdown(descriptions[comparator] || 'Unknown comparator');
        return new vscode.Hover(contents);
    }
}
