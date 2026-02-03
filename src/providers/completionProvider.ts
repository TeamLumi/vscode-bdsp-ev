import * as vscode from 'vscode';
import { DataLoader } from '../data/dataLoader';
import { getActiveContext, parseDocument } from '../utils/parser';

export class BDSPCompletionProvider implements vscode.CompletionItemProvider {
    private dataLoader: DataLoader;

    constructor() {
        this.dataLoader = DataLoader.getInstance();
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const line = document.lineAt(position.line).text;
        const textBeforeCursor = line.substring(0, position.character);

        // Check for @work prefix
        if (textBeforeCursor.endsWith('@') || /@[a-zA-Z0-9_\-]*$/.test(textBeforeCursor)) {
            return this.provideWorkCompletions(textBeforeCursor);
        }

        // Check for #flag prefix
        if (textBeforeCursor.endsWith('#') || /#[a-zA-Z0-9_\-]*$/.test(textBeforeCursor)) {
            return this.provideFlagCompletions(textBeforeCursor);
        }

        // Check for $sysflag prefix
        if (textBeforeCursor.endsWith('$') || /\$[a-zA-Z0-9_\-]*$/.test(textBeforeCursor)) {
            return this.provideSysFlagCompletions(textBeforeCursor);
        }

        // Check if we're inside a command's arguments
        const ctx = getActiveContext(document, position);
        if (ctx) {
            const cmd = this.dataLoader.getCommand(ctx.cmdName);
            if (cmd && cmd.Args && cmd.Args[ctx.argIndex]) {
                const arg = cmd.Args[ctx.argIndex];
                const types = arg.Type || [];

                // Provide context-aware completions based on argument type
                const items: vscode.CompletionItem[] = [];

                if (types.includes('Work')) {
                    items.push(...this.provideWorkCompletions(textBeforeCursor));
                }
                if (types.includes('Flag')) {
                    items.push(...this.provideFlagCompletions(textBeforeCursor));
                }
                if (types.includes('SysFlag')) {
                    items.push(...this.provideSysFlagCompletions(textBeforeCursor));
                }
                if (types.includes('Label')) {
                    items.push(...this.provideLabelCompletions(document, textBeforeCursor));
                }

                // Add comparator suggestions for relevant commands
                if (ctx.cmdName.includes('IFVAL') && ctx.argIndex === 1) {
                    items.push(...this.provideComparatorCompletions());
                }

                if (items.length > 0) {
                    return items;
                }
            }
        }

        // Default: provide command completions
        return this.provideCommandCompletions();
    }

    private provideCommandCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        for (const cmd of this.dataLoader.commands) {
            if (cmd.Dummy) continue;

            const item = new vscode.CompletionItem(cmd.Name, vscode.CompletionItemKind.Function);

            // Build snippet with placeholders for arguments
            const args = cmd.Args || [];
            const snippetArgs = args.map((arg, i) => {
                return `\${${i + 1}:${arg.TentativeName || 'arg'}}`;
            }).join(', ');

            item.insertText = new vscode.SnippetString(`${cmd.Name}(${snippetArgs})`);
            item.detail = this.dataLoader.getCommandSignature(cmd);
            item.documentation = new vscode.MarkdownString(cmd.Description || 'No description available.');

            items.push(item);
        }

        return items;
    }

    private provideWorkCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const hasPrefix = textBeforeCursor.includes('@');

        for (const work of this.dataLoader.workVariables) {
            const item = new vscode.CompletionItem(work.Name, vscode.CompletionItemKind.Variable);
            item.insertText = hasPrefix ? work.Name : `@${work.Name}`;
            item.detail = `Work Variable (ID: ${work.Id})`;
            if (work.Description) {
                item.documentation = new vscode.MarkdownString(work.Description);
            }
            item.sortText = work.Id.toString().padStart(5, '0');
            items.push(item);
        }

        return items;
    }

    private provideFlagCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const hasPrefix = textBeforeCursor.includes('#');

        for (const flag of this.dataLoader.flags) {
            const item = new vscode.CompletionItem(flag.Name, vscode.CompletionItemKind.EnumMember);
            item.insertText = hasPrefix ? flag.Name : `#${flag.Name}`;
            item.detail = `Flag (ID: ${flag.Id})`;
            if (flag.Description) {
                item.documentation = new vscode.MarkdownString(flag.Description);
            }
            item.sortText = flag.Id.toString().padStart(5, '0');
            items.push(item);
        }

        return items;
    }

    private provideSysFlagCompletions(textBeforeCursor: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const hasPrefix = textBeforeCursor.includes('$');

        for (const sysFlag of this.dataLoader.sysFlags) {
            const item = new vscode.CompletionItem(sysFlag.Name, vscode.CompletionItemKind.Constant);
            item.insertText = hasPrefix ? sysFlag.Name : `$${sysFlag.Name}`;
            item.detail = `System Flag (ID: ${sysFlag.Id})`;
            if (sysFlag.Description) {
                item.documentation = new vscode.MarkdownString(sysFlag.Description);
            }
            item.sortText = sysFlag.Id.toString().padStart(5, '0');
            items.push(item);
        }

        return items;
    }

    private provideLabelCompletions(document: vscode.TextDocument, textBeforeCursor: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const parsed = parseDocument(document);

        for (const [labelName, label] of parsed.labels) {
            const item = new vscode.CompletionItem(labelName, vscode.CompletionItemKind.Reference);
            item.insertText = `"${labelName}"`;
            item.detail = `Label at line ${label.line + 1}`;
            items.push(item);
        }

        return items;
    }

    private provideComparatorCompletions(): vscode.CompletionItem[] {
        const comparators = [
            { name: 'EQ', desc: 'Equal to' },
            { name: 'NE', desc: 'Not equal to' },
            { name: 'LT', desc: 'Less than' },
            { name: 'LE', desc: 'Less than or equal to' },
            { name: 'GT', desc: 'Greater than' },
            { name: 'GE', desc: 'Greater than or equal to' }
        ];

        return comparators.map(c => {
            const item = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Operator);
            item.detail = c.desc;
            return item;
        });
    }
}

export class BDSPSignatureHelpProvider implements vscode.SignatureHelpProvider {
    private dataLoader: DataLoader;

    constructor() {
        this.dataLoader = DataLoader.getInstance();
    }

    provideSignatureHelp(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.SignatureHelpContext
    ): vscode.ProviderResult<vscode.SignatureHelp> {
        const ctx = getActiveContext(document, position);
        if (!ctx) return null;

        const cmd = this.dataLoader.getCommand(ctx.cmdName);
        if (!cmd) return null;

        const args = cmd.Args || [];
        const paramLabels = args.map(arg => arg.TentativeName || 'arg');
        const signature = `${cmd.Name}(${paramLabels.join(', ')})`;

        const signatureInfo = new vscode.SignatureInformation(signature, cmd.Description);

        signatureInfo.parameters = args.map(arg => {
            const paramDoc = this.dataLoader.getArgDocumentation(arg);
            return new vscode.ParameterInformation(arg.TentativeName || 'arg', new vscode.MarkdownString(paramDoc));
        });

        const signatureHelp = new vscode.SignatureHelp();
        signatureHelp.signatures = [signatureInfo];
        signatureHelp.activeSignature = 0;
        signatureHelp.activeParameter = Math.min(ctx.argIndex, args.length - 1);

        return signatureHelp;
    }
}
