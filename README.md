# BDSP Event Script

VSCode extension providing language support for Pokemon Brilliant Diamond & Shining Pearl event scripts (`.ev` files).

## Features

### Syntax Highlighting
- **Labels** - Script labels like `ev_start:`
- **Commands** - 500+ commands like `_TALKMSG()`, `_JUMP()`
- **Work Variables** - `@LOCALWORK0`, `@SCWK_ANSWER`
- **Flags** - `#FH_01`, `#FLAG_NAME`
- **System Flags** - `$SYS_FLAG_GAME_CLEAR`
- **Strings** - `"label_name"`, `'text'`
- **Comments** - `; comment` or `// comment`
- **Comparators** - `EQ`, `NE`, `LT`, `LE`, `GT`, `GE`

### IntelliSense
- **Autocomplete** - Command suggestions with parameter snippets
- **Signature Help** - Shows argument names and types as you type
- **Context-Aware Suggestions** - Suggests @work, #flag, $sysflag based on expected argument type

### Navigation
- **Go to Definition** - `Ctrl+Click` on a label reference to jump to its definition
- **Find All References** - Right-click a label and select "Find All References"
- **Document Outline** - View all labels in the Outline panel

### Diagnostics
- Unknown command names
- Invalid argument count
- Invalid argument types
- Undefined label references
- Invalid comparators in `_IFVAL_JUMP`/`_IFVAL_CALL`

## Installation

### From Source
```bash
cd G:\Lumi\vscode-bdsp-ev
npm install
npm run compile
```

Then either:
- Press `F5` in VSCode to launch Extension Development Host
- Or run `npx vsce package` and install the generated `.vsix` file

### Install VSIX
1. `Ctrl+Shift+P` in VSCode
2. Type "Extensions: Install from VSIX"
3. Select the `.vsix` file

## Usage

Open any `.ev` file and the extension activates automatically.

### Example Script
```
; Sample event script
ev_start:
    _TALKMSG("ss_rival%greeting")
    _TIME_WAIT(30, @LOCALWORK0)

    _IF_FLAGON_JUMP(#FH_01, "ev_has_flag")
    _JUMP("ev_no_flag")

ev_has_flag:
    _TALKMSG("ss_rival%has_flag_message")
    _END()

ev_no_flag:
    _IFVAL_JUMP(@LOCALWORK1, EQ, 5, "ev_special")
    _TALKMSG("ss_rival%no_flag_message")
    _END()

ev_special:
    _FLAG_SET($SYS_FLAG_GAME_CLEAR)
    _END()
```

## Data Files

The extension uses JSON data files in the `data/` folder:
- `commands.json` - Command definitions with arguments and descriptions
- `work.json` - Work variable names
- `flags.json` - Flag names
- `sys_flags.json` - System flag names

These are sourced from [RelumiScript](https://github.com/TeamLumi/RelumiScript).

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npx vsce package
```

## License

MIT
