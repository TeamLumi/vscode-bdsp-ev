import * as vscode from 'vscode';

export interface ParsedLabel {
    name: string;
    line: number;
    range: vscode.Range;
}

export interface ParsedCommand {
    name: string;
    line: number;
    column: number;
    args: ParsedArgument[];
    range: vscode.Range;
}

export interface ParsedArgument {
    value: string;
    type: 'number' | 'string' | 'work' | 'flag' | 'sysflag' | 'label' | 'comparator' | 'unknown';
    range: vscode.Range;
}

export interface ParsedDocument {
    labels: Map<string, ParsedLabel>;
    commands: ParsedCommand[];
    labelReferences: { name: string; range: vscode.Range; line: number }[];
}

export function parseDocument(document: vscode.TextDocument): ParsedDocument {
    const labels = new Map<string, ParsedLabel>();
    const commands: ParsedCommand[] = [];
    const labelReferences: { name: string; range: vscode.Range; line: number }[] = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        // Skip empty lines and comments
        const trimmed = text.trim();
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('//')) {
            continue;
        }

        // Parse labels (name:)
        const labelMatch = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*):/);
        if (labelMatch) {
            const labelName = labelMatch[1];
            const startCol = text.indexOf(labelName);
            labels.set(labelName, {
                name: labelName,
                line: i,
                range: new vscode.Range(i, startCol, i, startCol + labelName.length + 1)
            });
        }

        // Parse commands (NAME(args))
        const cmdMatch = text.match(/([A-Z_][A-Z0-9_]*)\s*\(/);
        if (cmdMatch) {
            const cmdName = cmdMatch[1];
            const cmdStartCol = text.indexOf(cmdName);
            const openParen = text.indexOf('(', cmdStartCol);
            const closeParen = findMatchingParen(text, openParen);

            const argsText = closeParen > openParen
                ? text.substring(openParen + 1, closeParen)
                : text.substring(openParen + 1);

            const args = parseArguments(argsText, i, openParen + 1);

            commands.push({
                name: cmdName,
                line: i,
                column: cmdStartCol,
                args,
                range: new vscode.Range(i, cmdStartCol, i, closeParen > 0 ? closeParen + 1 : text.length)
            });

            // Track label references in jump/call commands
            if (isJumpCommand(cmdName) && args.length > 0) {
                const labelArg = getLabelArgument(cmdName, args);
                if (labelArg && labelArg.type === 'string') {
                    const labelName = labelArg.value.replace(/['"]/g, '');
                    labelReferences.push({
                        name: labelName,
                        range: labelArg.range,
                        line: i
                    });
                }
            }
        }
    }

    return { labels, commands, labelReferences };
}

function findMatchingParen(text: string, openIndex: number): number {
    let depth = 1;
    for (let i = openIndex + 1; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function parseArguments(argsText: string, line: number, startCol: number): ParsedArgument[] {
    const args: ParsedArgument[] = [];
    if (!argsText.trim()) return args;

    let currentArg = '';
    let inString = false;
    let stringChar = '';
    let argStartCol = startCol;
    let col = startCol;

    for (let i = 0; i < argsText.length; i++) {
        const char = argsText[i];
        col = startCol + i;

        if (!inString && (char === '"' || char === "'")) {
            inString = true;
            stringChar = char;
            currentArg += char;
        } else if (inString && char === stringChar) {
            inString = false;
            currentArg += char;
        } else if (!inString && char === ',') {
            if (currentArg.trim()) {
                args.push(createArgument(currentArg.trim(), line, argStartCol, col));
            }
            currentArg = '';
            argStartCol = col + 1;
        } else {
            if (!currentArg && char !== ' ' && char !== '\t') {
                argStartCol = col;
            }
            currentArg += char;
        }
    }

    if (currentArg.trim()) {
        args.push(createArgument(currentArg.trim(), line, argStartCol, col + 1));
    }

    return args;
}

function createArgument(value: string, line: number, startCol: number, endCol: number): ParsedArgument {
    const range = new vscode.Range(line, startCol, line, endCol);

    if (value.startsWith('@')) {
        return { value, type: 'work', range };
    }
    if (value.startsWith('#')) {
        return { value, type: 'flag', range };
    }
    if (value.startsWith('$')) {
        return { value, type: 'sysflag', range };
    }
    if (value.startsWith('"') || value.startsWith("'")) {
        return { value, type: 'string', range };
    }
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return { value, type: 'number', range };
    }
    if (/^(GE|GT|LE|LT|EQ|NE)$/.test(value)) {
        return { value, type: 'comparator', range };
    }

    return { value, type: 'unknown', range };
}

const JUMP_COMMANDS = new Set([
    '_JUMP', '_CALL',
    '_IF_FLAGON_JUMP', '_IF_FLAGOFF_JUMP',
    '_IF_FLAGON_CALL', '_IF_FLAGOFF_CALL',
    '_IFVAL_JUMP', '_IFVAL_CALL',
    '_OBJ_ANIME'
]);

function isJumpCommand(cmdName: string): boolean {
    return JUMP_COMMANDS.has(cmdName);
}

function getLabelArgument(cmdName: string, args: ParsedArgument[]): ParsedArgument | null {
    switch (cmdName) {
        case '_JUMP':
        case '_CALL':
            return args[0] || null;
        case '_IF_FLAGON_JUMP':
        case '_IF_FLAGOFF_JUMP':
        case '_IF_FLAGON_CALL':
        case '_IF_FLAGOFF_CALL':
            return args[1] || null;
        case '_IFVAL_JUMP':
        case '_IFVAL_CALL':
            return args[3] || null;
        case '_OBJ_ANIME':
            return args[1] || null;
        default:
            return null;
    }
}

export function getWordAtPosition(document: vscode.TextDocument, position: vscode.Position): { word: string; range: vscode.Range } | null {
    const line = document.lineAt(position.line).text;

    // Check for @work, #flag, $sysflag
    const prefixPattern = /[@#$][a-zA-Z0-9_\-]+/g;
    let match;
    while ((match = prefixPattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                range: new vscode.Range(position.line, start, position.line, end)
            };
        }
    }

    // Check for command names
    const cmdPattern = /[A-Z_][A-Z0-9_]*/g;
    while ((match = cmdPattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                range: new vscode.Range(position.line, start, position.line, end)
            };
        }
    }

    // Check for label names
    const labelPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    while ((match = labelPattern.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
            return {
                word: match[0],
                range: new vscode.Range(position.line, start, position.line, end)
            };
        }
    }

    return null;
}

export function getActiveContext(document: vscode.TextDocument, position: vscode.Position): { cmdName: string; argIndex: number } | null {
    const line = document.lineAt(position.line).text;
    const textUntilPosition = line.substring(0, position.character);

    // Match "COMMAND(" looking backwards
    const match = textUntilPosition.match(/([A-Z_][A-Z0-9_]*)\s*\(/g);
    if (!match) return null;

    const lastMatch = match[match.length - 1];
    const cmdName = lastMatch.replace('(', '').trim();

    const openParenIndex = textUntilPosition.lastIndexOf('(');
    const textAfterOpenParen = textUntilPosition.substring(openParenIndex);
    if (textAfterOpenParen.includes(')')) return null;

    const commas = (textAfterOpenParen.match(/,/g) || []).length;

    return { cmdName, argIndex: commas };
}
