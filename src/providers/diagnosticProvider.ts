import * as vscode from 'vscode';
import { DataLoader, Command, CommandArg } from '../data/dataLoader';
import { parseDocument, ParsedCommand, ParsedArgument } from '../utils/parser';

export class BDSPDiagnosticProvider {
    private dataLoader: DataLoader;
    private diagnosticCollection: vscode.DiagnosticCollection;

    private static readonly VALID_COMPARATORS = new Set(['GE', 'GT', 'LE', 'LT', 'EQ', 'NE']);

    private static readonly JUMP_COMMANDS: Map<string, number> = new Map([
        ['_JUMP', 0],
        ['_CALL', 0],
        ['_IF_FLAGON_JUMP', 1],
        ['_IF_FLAGOFF_JUMP', 1],
        ['_IF_FLAGON_CALL', 1],
        ['_IF_FLAGOFF_CALL', 1],
        ['_IFVAL_JUMP', 3],
        ['_IFVAL_CALL', 3],
        ['_OBJ_ANIME', 1]
    ]);

    private static readonly IFVAL_COMMANDS = new Set([
        '_IFVAL_JUMP',
        '_IFVAL_CALL'
    ]);

    constructor() {
        this.dataLoader = DataLoader.getInstance();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('bdsp-ev');
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }

    public getDiagnosticCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    public updateDiagnostics(document: vscode.TextDocument): void {
        if (document.languageId !== 'bdsp-ev') {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        const parsed = parseDocument(document);

        for (const cmd of parsed.commands) {
            // Check for unknown command
            const cmdDef = this.dataLoader.getCommand(cmd.name);
            if (!cmdDef) {
                diagnostics.push(this.createDiagnostic(
                    cmd.range,
                    `Unknown command: ${cmd.name}`,
                    vscode.DiagnosticSeverity.Error
                ));
                continue;
            }

            // Check argument count
            const argCountDiag = this.validateArgumentCount(cmd, cmdDef);
            if (argCountDiag) {
                diagnostics.push(argCountDiag);
            }

            // Check argument types
            const typeDiags = this.validateArgumentTypes(cmd, cmdDef);
            diagnostics.push(...typeDiags);

            // Check label references
            const labelDiag = this.validateLabelReference(cmd, cmdDef, parsed.labels);
            if (labelDiag) {
                diagnostics.push(labelDiag);
            }

            // Check comparators in IFVAL commands
            const compDiag = this.validateComparator(cmd, cmdDef);
            if (compDiag) {
                diagnostics.push(compDiag);
            }
        }

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private createDiagnostic(
        range: vscode.Range,
        message: string,
        severity: vscode.DiagnosticSeverity
    ): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = 'bdsp-ev';
        return diagnostic;
    }

    private validateArgumentCount(cmd: ParsedCommand, cmdDef: Command): vscode.Diagnostic | null {
        const expectedArgs = cmdDef.Args || [];
        const requiredCount = expectedArgs.filter(arg => !arg.Optional).length;
        const maxCount = expectedArgs.length;
        const actualCount = cmd.args.length;

        if (actualCount < requiredCount) {
            return this.createDiagnostic(
                cmd.range,
                `${cmd.name} requires at least ${requiredCount} argument(s), but got ${actualCount}`,
                vscode.DiagnosticSeverity.Error
            );
        }

        if (actualCount > maxCount) {
            return this.createDiagnostic(
                cmd.range,
                `${cmd.name} accepts at most ${maxCount} argument(s), but got ${actualCount}`,
                vscode.DiagnosticSeverity.Warning
            );
        }

        return null;
    }

    private validateArgumentTypes(cmd: ParsedCommand, cmdDef: Command): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const expectedArgs = cmdDef.Args || [];

        for (let i = 0; i < cmd.args.length && i < expectedArgs.length; i++) {
            const arg = cmd.args[i];
            const expectedArg = expectedArgs[i];
            const expectedTypes = expectedArg.Type || [];

            if (expectedTypes.length === 0) continue;

            const isValid = this.isArgumentTypeValid(arg, expectedTypes);
            if (!isValid) {
                diagnostics.push(this.createDiagnostic(
                    arg.range,
                    `Argument ${i + 1} (${expectedArg.TentativeName}): expected ${expectedTypes.join(' | ')}, got ${arg.type}`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }

        return diagnostics;
    }

    private isArgumentTypeValid(arg: ParsedArgument, expectedTypes: string[]): boolean {
        for (const expectedType of expectedTypes) {
            switch (expectedType) {
                case 'Number':
                    if (arg.type === 'number') return true;
                    break;
                case 'Work':
                    if (arg.type === 'work' || arg.type === 'number') return true;
                    break;
                case 'Flag':
                    if (arg.type === 'flag' || arg.type === 'number') return true;
                    break;
                case 'SysFlag':
                case 'System':
                    if (arg.type === 'sysflag' || arg.type === 'number') return true;
                    break;
                case 'Label':
                    if (arg.type === 'string') return true;
                    break;
                case 'String':
                    if (arg.type === 'string') return true;
                    break;
            }
        }

        // If we couldn't determine validity, assume it's ok
        if (arg.type === 'unknown') return true;

        return false;
    }

    private validateLabelReference(
        cmd: ParsedCommand,
        cmdDef: Command,
        labels: Map<string, { name: string; line: number; range: vscode.Range }>
    ): vscode.Diagnostic | null {
        const labelArgIndex = BDSPDiagnosticProvider.JUMP_COMMANDS.get(cmd.name);
        if (labelArgIndex === undefined) return null;

        const arg = cmd.args[labelArgIndex];
        if (!arg || arg.type !== 'string') return null;

        const labelName = arg.value.replace(/['"]/g, '');
        if (!labels.has(labelName)) {
            return this.createDiagnostic(
                arg.range,
                `Undefined label: ${labelName}`,
                vscode.DiagnosticSeverity.Error
            );
        }

        return null;
    }

    private validateComparator(cmd: ParsedCommand, cmdDef: Command): vscode.Diagnostic | null {
        if (!BDSPDiagnosticProvider.IFVAL_COMMANDS.has(cmd.name)) return null;

        // Comparator is at index 1 for IFVAL commands
        const arg = cmd.args[1];
        if (!arg) return null;

        // Remove quotes if present
        const value = arg.value.replace(/['"]/g, '');

        if (!BDSPDiagnosticProvider.VALID_COMPARATORS.has(value)) {
            return this.createDiagnostic(
                arg.range,
                `Invalid comparator: ${value}. Expected one of: GE, GT, LE, LT, EQ, NE`,
                vscode.DiagnosticSeverity.Error
            );
        }

        return null;
    }
}
