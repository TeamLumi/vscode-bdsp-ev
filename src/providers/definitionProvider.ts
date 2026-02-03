import * as vscode from 'vscode';
import { parseDocument } from '../utils/parser';

export class BDSPDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const line = document.lineAt(position.line).text;

        // Check if we're clicking on a string (label reference)
        const labelInString = this.getLabelFromString(line, position.character);
        if (labelInString) {
            return this.findLabelDefinition(document, labelInString);
        }

        // Check if we're clicking on a label definition itself (allow jumping from references)
        const parsed = parseDocument(document);

        // Find what word we're on
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);

        // Check if this word is a label reference in the labelReferences list
        for (const ref of parsed.labelReferences) {
            const refLabelName = ref.name;
            if (refLabelName === word && ref.line === position.line) {
                const label = parsed.labels.get(refLabelName);
                if (label) {
                    return new vscode.Location(document.uri, label.range);
                }
            }
        }

        // Check if the word matches any label
        const label = parsed.labels.get(word);
        if (label && label.line !== position.line) {
            return new vscode.Location(document.uri, label.range);
        }

        return null;
    }

    private getLabelFromString(line: string, charPos: number): string | null {
        // Find if cursor is inside a quoted string
        let inString = false;
        let stringChar = '';
        let stringStart = -1;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
                stringStart = i;
            } else if (inString && char === stringChar) {
                // End of string - check if cursor was inside
                if (charPos > stringStart && charPos <= i) {
                    return line.substring(stringStart + 1, i);
                }
                inString = false;
            }
        }

        return null;
    }

    private findLabelDefinition(document: vscode.TextDocument, labelName: string): vscode.Location | null {
        const parsed = parseDocument(document);
        const label = parsed.labels.get(labelName);

        if (label) {
            return new vscode.Location(document.uri, label.range);
        }

        return null;
    }
}

export class BDSPReferenceProvider implements vscode.ReferenceProvider {
    provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        const parsed = parseDocument(document);

        // Find what word we're on
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);

        // Check if this is a label
        const label = parsed.labels.get(word);
        if (!label) return null;

        const locations: vscode.Location[] = [];

        // Include definition if requested
        if (context.includeDeclaration) {
            locations.push(new vscode.Location(document.uri, label.range));
        }

        // Find all references to this label
        for (const ref of parsed.labelReferences) {
            if (ref.name === word) {
                locations.push(new vscode.Location(document.uri, ref.range));
            }
        }

        return locations;
    }
}

export class BDSPDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    provideDocumentSymbols(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const parsed = parseDocument(document);
        const symbols: vscode.DocumentSymbol[] = [];

        // Add all labels as symbols
        for (const [name, label] of parsed.labels) {
            const symbol = new vscode.DocumentSymbol(
                name,
                'Label',
                vscode.SymbolKind.Function,
                label.range,
                label.range
            );
            symbols.push(symbol);
        }

        return symbols;
    }
}
