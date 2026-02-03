import * as vscode from 'vscode';
import { DataLoader } from './data/dataLoader';
import { BDSPCompletionProvider, BDSPSignatureHelpProvider } from './providers/completionProvider';
import { BDSPHoverProvider } from './providers/hoverProvider';
import { BDSPDefinitionProvider, BDSPReferenceProvider, BDSPDocumentSymbolProvider } from './providers/definitionProvider';
import { BDSPDiagnosticProvider } from './providers/diagnosticProvider';

let diagnosticProvider: BDSPDiagnosticProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('BDSP Event Script extension is now active');

    // Load data files
    const dataLoader = DataLoader.getInstance();
    dataLoader.load(context.extensionPath);

    // Register language selector
    const selector: vscode.DocumentSelector = { language: 'bdsp-ev', scheme: 'file' };

    // Register completion provider
    const completionProvider = new BDSPCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            selector,
            completionProvider,
            '(', ',', '@', '#', '$'
        )
    );

    // Register signature help provider
    const signatureHelpProvider = new BDSPSignatureHelpProvider();
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            selector,
            signatureHelpProvider,
            '(', ','
        )
    );

    // Register hover provider
    const hoverProvider = new BDSPHoverProvider();
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(selector, hoverProvider)
    );

    // Register definition provider
    const definitionProvider = new BDSPDefinitionProvider();
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(selector, definitionProvider)
    );

    // Register reference provider
    const referenceProvider = new BDSPReferenceProvider();
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(selector, referenceProvider)
    );

    // Register document symbol provider
    const documentSymbolProvider = new BDSPDocumentSymbolProvider();
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(selector, documentSymbolProvider)
    );

    // Register diagnostic provider
    diagnosticProvider = new BDSPDiagnosticProvider();
    context.subscriptions.push(diagnosticProvider.getDiagnosticCollection());

    // Update diagnostics when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'bdsp-ev') {
                diagnosticProvider.updateDiagnostics(event.document);
            }
        })
    );

    // Update diagnostics when document is opened
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            if (document.languageId === 'bdsp-ev') {
                diagnosticProvider.updateDiagnostics(document);
            }
        })
    );

    // Update diagnostics for all open documents
    vscode.workspace.textDocuments.forEach(document => {
        if (document.languageId === 'bdsp-ev') {
            diagnosticProvider.updateDiagnostics(document);
        }
    });

    // Clear diagnostics when document is closed
    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument(document => {
            diagnosticProvider.getDiagnosticCollection().delete(document.uri);
        })
    );

    console.log(`Loaded ${dataLoader.commands.length} commands, ${dataLoader.workVariables.length} work variables, ${dataLoader.flags.length} flags, ${dataLoader.sysFlags.length} system flags`);
}

export function deactivate() {
    if (diagnosticProvider) {
        diagnosticProvider.dispose();
    }
}
