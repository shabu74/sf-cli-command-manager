const vscode = require('vscode');
const https = require('https');
const fs = require('fs');
const path = require('path');

function activate(context) {
    const disposable = vscode.commands.registerCommand('salesforce-cli-manager.openManager', () => {
        const panel = vscode.window.createWebviewPanel(
            'sfCliManager',
            'Salesforce CLI Command Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = getWebviewContent();

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'getCommandTypes':
                        handleGetCommandTypes(panel);
                        break;
                    case 'getSubCommands':
                        handleGetSubCommands(panel, message.commandType);
                        break;
                    case 'getCommandDetails':
                        handleGetCommandDetails(panel, message.commandType, message.commandName);
                        break;
                    case 'executeCommand':
                        handleExecuteCommand(panel, message.commandText, message.internal);
                        break;
                    case 'saveFile':
                        handleSaveFile(panel, message.filename, message.content);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        setTimeout(() => {
            handleGetCommandTypes(panel);
        }, 100);
    });

    context.subscriptions.push(disposable);
}

async function handleGetCommandTypes(panel) {
    try {
        const commandTypes = await fetchSfCommandTypes();
        panel.webview.postMessage({
            command: 'commandTypesLoaded',
            commandTypes: commandTypes
        });
    } catch (error) {
        panel.webview.postMessage({
            command: 'commandTypesError',
            errorMessage: error
        });
    }
}

function handleGetSubCommands(panel, commandType) {
    const subCommands = getSubCommands(commandType);
    panel.webview.postMessage({
        command: 'subCommandsLoaded',
        subCommands: subCommands
    });
}

function handleGetCommandDetails(panel, commandType, commandName) {
    const commandDetails = getCommandDetails(commandType, commandName);
    panel.webview.postMessage({
        command: 'commandDetailsLoaded',
        commandDetails: commandDetails
    });
}

function handleExecuteCommand(panel, commandText, internal = false) {
    const { exec } = require('child_process');
    
    // Execute the command with increased buffer size (10MB)
    exec(commandText, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        let result;
        if (error) {
            result = {
                error: true,
                message: error.message,
                stderr: stderr,
                stdout: stdout
            };
        } else {
            result = {
                error: false,
                stdout: stdout,
                stderr: stderr
            };
        }
        
        // Send result back to webview
        panel.webview.postMessage({
            command: 'commandExecuted',
            result: result,
            internal: internal // Pass the internal flag back to webview
        });
    });
}

function handleSaveFile(panel, filename, content) {
    const fs = require('fs');
    const path = require('path');
    
    // Get the current workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '.';
    
    // Create the full file path
    const filePath = path.join(workspaceFolder, filename);
    
    // For very large content, use streams to avoid memory issues
    // Convert content to string if it's not already
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    
    if (contentString.length > 1000000) { // If content is larger than ~1MB
        // Write large files using streams
        const writeStream = fs.createWriteStream(filePath);
        writeStream.write(contentString);
        writeStream.end();
        
        writeStream.on('finish', () => {
            // Show success message with file path
            vscode.window.showInformationMessage(`File saved successfully: ${filePath}`, 'Open File')
                .then(selection => {
                    if (selection === 'Open File') {
                        // Open the saved file
                        const fileUri = vscode.Uri.file(filePath);
                        vscode.workspace.openTextDocument(fileUri).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
        });
        
        writeStream.on('error', (err) => {
            // Show error message if file saving failed
            vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
        });
    } else {
        // Write the file
        fs.writeFile(filePath, contentString, (err) => {
            if (err) {
                // Show error message if file saving failed
                vscode.window.showErrorMessage(`Failed to save file: ${err.message}`);
            } else {
                // Show success message with file path
                vscode.window.showInformationMessage(`File saved successfully: ${filePath}`, 'Open File')
                    .then(selection => {
                        if (selection === 'Open File') {
                            // Open the saved file
                            const fileUri = vscode.Uri.file(filePath);
                            vscode.workspace.openTextDocument(fileUri).then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        }
                    });
            }
        });
    }
}

function getCommandDetails(commandType, commandName) {
    try {
        const commandsPath = path.join(__dirname, '..', 'command_json_files', `${commandType}.json`);
        if (!fs.existsSync(commandsPath)) {
            return null;
        }
        const commandsData = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
        if (!commandsData.commands) {
            return null;
        }
        
        // Find the command that matches the name
        const command = commandsData.commands.find(cmd => cmd.name === commandName);
        return command || null;
    } catch (error) {
        return null;
    }
}

async function fetchSfCommandTypes() {
    return new Promise((resolve) => {
        try {
            const commandTypesPath = path.join(__dirname, '..', 'command_types.json');
            const commandTypesData = JSON.parse(fs.readFileSync(commandTypesPath, 'utf8'));
            const commandTypes = commandTypesData.sort((a, b) => a.commandType.localeCompare(b.commandType)).map(item => ({
                name: item.commandType,
                label: item.description,
                tags: item.tags
            }));
            resolve(commandTypes);
        } catch (error) {
            resolve([]);
        }
    });
}

function getSubCommands(commandType) {
    try {
        const commandsPath = path.join(__dirname, '..', 'command_json_files', `${commandType}.json`);
        if (!fs.existsSync(commandsPath)) {
            return [];
        }
        const commandsData = JSON.parse(fs.readFileSync(commandsPath, 'utf8'));
        return commandsData.commands ? commandsData.commands.map(cmd => ({
            name: cmd.name,
            label: cmd.description
        })) : [];
    } catch (error) {
        return [];
    }
}



function getWebviewContent() {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Salesforce CLI Command Manager</title>
        <style>
            body { font-family: 'Salesforce Sans', Arial, sans-serif; font-size: 14px; line-height: 1.5; padding: 24px; background: #f3f3f3; color: #181818; }
            .spinner {
                border: 2px solid #f3f3f3;
                border-top: 2px solid #0070d2;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                animation: spin 1s linear infinite;
                display: none;
                margin-left: 10px;
                vertical-align: middle;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            h1 { font-size: 25px; font-weight: 300; color: #003876; margin-bottom: 24px; font-family: 'Aptos', Arial, sans-serif; }
            .form-group { margin-bottom: 16px; }
            label { display: block; margin-bottom: 8px; font-weight: 300; font-size: 20px; color: #444444; font-family: 'Aptos', Arial, sans-serif; }
            select, input { width: 100%; padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: white; color: #181818; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; }
            .flag-input.error { border: 3px solid red; }
            .error-message { color: red; font-size: 12px; margin-top: 5px; display: none; font-style: italic; }
            input[readonly] { width: calc(100% - 32px); }
            select:focus, input:focus { outline: none; border-color: #1589ee; box-shadow: 0 0 0 2px rgba(21, 137, 238, 0.1); }
            select:disabled { background: #f3f3f3; color: #706e6b; }
            .command-type-container { display: flex; align-items: center; }
            .form-group select, .form-group input { width: 100%; }
            /* Combobox styles */
            .combobox-container { position: relative; width: 100%; }
            .command-type-input { width: 100%; padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: white; color: #181818; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; font-style: italic; }
            .command-type-input:focus { outline: none; border-color: #1589ee; box-shadow: 0 0 0 2px rgba(21, 137, 238, 0.1); }
            .dropdown-list { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d8dde6; border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none; }
            .dropdown-item { padding: 8px 16px; cursor: pointer; }
            .dropdown-item:hover { background-color: #f3f3f3; }
            .dropdown-item.selected { background-color: #eef4ff; }
            .dropdown-item.highlighted { background-color: #eef4ff; }
            .flags-container {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-top: 10px;
            }
            .flag-group {
                width: 100%;
                margin-bottom: 20px;
            }
            .flag-row {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                margin-bottom: 5px;
            }
            .flag-item {
                flex: 1 1 23%;
                min-width: 150px;
            }
            .flags-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .flags-table td {
                padding: 5px 10px;
                vertical-align: top;
            }
            .flags-table tr:nth-child(even) {
                background-color: transparent;
            }
            .flag-label {
                display: block;
                font-size: 11px;
                color: #54698d;
                font-style: italic;
                margin-bottom: 3px;
                position: relative;
                cursor: help;
            }
            .flag-label.required::before {
                content: "*";
                color: red;
                margin-right: 4px;
            }
            .flag-input {
                width: 98%;
                padding: 6px 10px;
                border: 1px solid #d8dde6;
                border-radius: 4px;
                background: white;
                color: #181818;
                font-size: 13px;
                font-family: 'Salesforce Sans', Arial, sans-serif;
            }
            input[type="checkbox"].flag-input {
                width: auto;
                margin: 0;
                display: inline-block;
                text-align: left;
                vertical-align: middle;
            }
            .tooltip {
                position: fixed;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                width: 250px;
                z-index: 1000;
                display: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                pointer-events: none;
            }
            .flag-label:hover .tooltip {
                display: block;
            }
        </style>
    </head>
    <body>
        <h1>Salesforce CLI Command Manager</h1>
        
        <div class="form-group">
            <label>Command Type</label>
            <div class="command-type-container">
                <div class="combobox-container" style="position: relative; width: 100%;">
                    <input type="text" id="commandTypeInput" class="command-type-input" placeholder="Select or Search Command Type" style="width: calc(100% - 32px); padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: white; color: #181818; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; font-style: italic;" />
                    <div id="commandTypeDropdown" class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d8dde6; border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                        <!-- Options will be populated by JavaScript -->
                    </div>
                </div>
            </div>
        </div>

        <div class="form-group">
            <label id="commandLabel" style="display: none;">Command</label>
            <div class="command-type-container">
                <div class="combobox-container" style="position: relative; width: 100%;">
                    <input type="text" id="commandInput" class="command-type-input" placeholder="Select or Search Command" style="display: none; width: calc(100% - 32px); padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: white; color: #181818; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; font-style: italic;" />
                    <div id="commandDropdown" class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d8dde6; border-top: none; border-radius: 0 0 4px 4px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                        <!-- Options will be populated by JavaScript -->
                    </div>
                </div>
            </div>
        </div>

        <div id="flagsContainer" style="display: none;">
            <table id="flagsTable" class="flags-table"></table>
        </div>

        <div class="form-group">
            <textarea id="selectedCommand" readonly style="display: none; width: calc(100% - 32px); padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: #f8f8f8; color: #54698d; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; font-style: italic; margin-top: 10px; margin-bottom: 5px; resize: vertical;"></textarea>
            <div id="betaWarning" style="display: none; color: red; font-size: 12px; font-style: italic; margin-top: 0; margin-bottom: 15px;">This command is BETA version</div>
        </div>
        
        <div class="form-group">
            <button id="runButton" style="display: none; width: 100%; padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: #0070d2; color: white; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; cursor: pointer; margin-top: 10px; margin-bottom: 20px;">Run <span id="runSpinner" class="spinner"></span></button>
        </div>
        
        <div class="form-group">
            <label id="responseLabel" style="display: none;"></label>
            <div id="jsonResponse" style="display: none; width: calc(100% - 32px); padding: 12px 16px; border: 1px solid #d8dde6; border-radius: 4px; background: #f8f8f8; color: #54698d; font-size: 14px; font-family: 'Salesforce Sans', Arial, sans-serif; margin-top: 10px; margin-bottom: 5px; min-height: 100px; white-space: pre-wrap; max-height: 300px; overflow-y: auto;"></div>
            <a id="downloadLink" style="display: none; margin-top: 5px; color: #0070d2; text-decoration: underline; cursor: pointer; font-size: 12px; font-style: italic;">Download</a>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            let allCommandTypes = [];
            let filteredCommandTypes = [];
            let allCommands = []; // Global array to store all commands
            let filteredCommands = []; // Global array to store filtered commands
            let orgAliases = []; // Global array to store org aliases
            let selectedCommandType = ''; // Store the selected command type
            let highlightedIndex = -1; // Index of the currently highlighted item in dropdown
            let commandHighlightedIndex = -1; // Index of the currently highlighted command in dropdown
            
            // Function to handle command type selection from combobox
            function onCommandTypeSelect(commandType) {
                selectedCommandType = commandType;
                const commandInput = document.getElementById('commandInput');
                const commandLabel = document.getElementById('commandLabel');
                const commandDropdown = document.getElementById('commandDropdown');
                
                // Hide flag table, selected command, run button, and response section when command type changes
                document.getElementById('flagsContainer').style.display = 'none';
                document.getElementById('selectedCommand').style.display = 'none';
                document.getElementById('runButton').style.display = 'none';
                document.getElementById('responseLabel').style.display = 'none';
                document.getElementById('jsonResponse').style.display = 'none';
                document.getElementById('downloadLink').style.display = 'none';
                
                // Reset command input
                commandInput.value = '';
                
                if (commandType) {
                    // Show loading state in the input
                    commandInput.placeholder = 'Select or Search Command';
                    commandInput.style.display = 'block';
                    commandLabel.style.display = 'block';
                    
                    vscode.postMessage({
                        command: 'getSubCommands',
                        commandType: commandType
                    });
                } else {
                    // Hide all dependent elements when no command type is selected
                    hideDependentElements();
                }
            }
            
            // Function to handle command selection from combobox
            function onCommandSelect(commandName) {
                const commandType = selectedCommandType;
                const commandLabel = document.getElementById('commandLabel');
                const commandDropdown = document.getElementById('commandDropdown');
                
                // Hide response and download link when command is selected
                document.getElementById('responseLabel').style.display = 'none';
                document.getElementById('jsonResponse').style.display = 'none';
                document.getElementById('downloadLink').style.display = 'none';
                
                if (commandType && commandName) {
                    // Update selected command display
                    const selectedCommandInput = document.getElementById('selectedCommand');
                    // Find the command object to get its description
                    const commandObj = allCommands.find(cmd => cmd.name === commandName);
                    if (commandObj) {
                        selectedCommandInput.value = 'sf ' + commandName.replace(' (Beta)', '').replace(/\s+/g, ' ').trim();
                        selectedCommandInput.title = commandObj.label;
                        selectedCommandInput.style.display = 'block';
                        
                        // Show/hide beta warning
                        const betaWarning = document.getElementById('betaWarning');
                        if (commandName.includes('Beta')) {
                            betaWarning.style.display = 'block';
                        } else {
                            betaWarning.style.display = 'none';
                        }
                        
                        // Show flags container
                        document.getElementById('flagsContainer').style.display = 'block';
                        
                        // Request command details
                        vscode.postMessage({
                            command: 'getCommandDetails',
                            commandType: commandType,
                            commandName: commandName
                        });
                    }
                } else {
                    // Hide all elements if no command selected
                    hideDependentElements();
                }
            }
            
            // Function to populate command combobox
            function populateCommandCombobox(commands) {
                const commandInput = document.getElementById('commandInput');
                const commandDropdown = document.getElementById('commandDropdown');
                
                // Clear dropdown
                commandDropdown.innerHTML = '';
                
                // Add options to dropdown
                commands.forEach(cmd => {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    // Remove trailing dot from description if it exists
                    let label = cmd.label || cmd.name;
                    if (label.endsWith('.')) {
                        label = label.slice(0, -1);
                    }
                    // Remove ' (Beta)' from command name
                    const commandName = (cmd.name || cmd).replace(' (Beta)', '');
                    item.textContent = label + ' (sf ' + commandName + ')';
                    item.dataset.value = cmd.name;
                    item.addEventListener('click', function() {
                        commandInput.value = label + ' (sf ' + commandName + ')';
                        commandDropdown.style.display = 'none';
                        onCommandSelect(cmd.name);
                    });
                    commandDropdown.appendChild(item);
                });
            }
            
            // Function to filter commands for combobox
            function filterCommandsForCombobox(searchText) {
                const commandInput = document.getElementById('commandInput');
                const commandDropdown = document.getElementById('commandDropdown');
                
                if (!searchText) {
                    filteredCommands = [...allCommands];
                } else {
                    // Split the search text into individual search items
                    const searchItems = searchText.toLowerCase().split(',').map(item => item.trim()).filter(item => item.length > 0);
                    
                    // Filter commands based on any search items
                    filteredCommands = allCommands.filter(cmd => {
                        // Check if any search item matches either the name or label (description)
                        return searchItems.some(searchItem => {
                            // Check name
                            if (cmd.name.toLowerCase().includes(searchItem)) {
                                return true;
                            }
                            
                            // Check label (description)
                            if (cmd.label && cmd.label.toLowerCase().includes(searchItem)) {
                                return true;
                            }
                            
                            return false;
                        });
                    });
                }
                
                // Update dropdown with filtered options
                populateCommandCombobox(filteredCommands);
                
                // Show dropdown if there are filtered results
                if (filteredCommands.length > 0) {
                    commandDropdown.style.display = 'block';
                } else {
                    commandDropdown.style.display = 'none';
                }
            }
            
            // Function to populate command type combobox
            function populateCommandTypeCombobox(commandTypes) {
                const commandTypeInput = document.getElementById('commandTypeInput');
                const commandTypeDropdown = document.getElementById('commandTypeDropdown');
                
                // Clear dropdown
                commandTypeDropdown.innerHTML = '';
                
                // Add options to dropdown
                commandTypes.forEach(type => {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    item.textContent = type.label + ' (' + type.name + ')';
                    item.dataset.value = type.name;
                    item.addEventListener('click', function() {
                        commandTypeInput.value = type.label + ' (' + type.name + ')';
                        commandTypeDropdown.style.display = 'none';
                        onCommandTypeSelect(type.name);
                    });
                    commandTypeDropdown.appendChild(item);
                });
            }
            
            // Function to filter command types for combobox
            function filterCommandTypesForCombobox(searchText) {
                const commandTypeInput = document.getElementById('commandTypeInput');
                const commandTypeDropdown = document.getElementById('commandTypeDropdown');
                
                if (!searchText) {
                    filteredCommandTypes = [...allCommandTypes];
                } else {
                    // Split the search text into individual search items
                    const searchItems = searchText.toLowerCase().split(',').map(item => item.trim()).filter(item => item.length > 0);
                    
                    // Filter command types based on any search items
                    filteredCommandTypes = allCommandTypes.filter(type => {
                        // Check if any search item matches either the name, label, or tags
                        return searchItems.some(searchItem => {
                            // Check name
                            if (type.name.toLowerCase().includes(searchItem)) {
                                return true;
                            }
                            
                            // Check label
                            if (type.label && type.label.toLowerCase().includes(searchItem)) {
                                return true;
                            }
                            
                            // Check tags
                            if (type.tags && type.tags.some(tag => tag.toLowerCase().includes(searchItem))) {
                                return true;
                            }
                            
                            return false;
                        });
                    });
                }
                
                // Update dropdown with filtered options
                populateCommandTypeCombobox(filteredCommandTypes);
                
                // Show dropdown if there are filtered results
                if (filteredCommandTypes.length > 0) {
                    commandTypeDropdown.style.display = 'block';
                } else {
                    commandTypeDropdown.style.display = 'none';
                }
            }
            
            // Add event listeners for combobox
            document.addEventListener('DOMContentLoaded', function() {
                const commandTypeInput = document.getElementById('commandTypeInput');
                const commandTypeDropdown = document.getElementById('commandTypeDropdown');
                const commandInput = document.getElementById('commandInput');
                const commandDropdown = document.getElementById('commandDropdown');
                
                // Handle input in the command type combobox
                commandTypeInput.addEventListener('input', function() {
                    filterCommandTypesForCombobox(this.value);
                    highlightedIndex = -1; // Reset highlighted index
                    
                    // If the input is cleared, hide all dependent elements
                    if (!this.value) {
                        hideDependentElements();
                    }
                });
                
                // Handle focus on the command type input
                commandTypeInput.addEventListener('focus', function() {
                    filterCommandTypesForCombobox(this.value);
                });
                
                // Handle blur (click outside) on the command type input
                commandTypeInput.addEventListener('blur', function() {
                    // Delay hiding the dropdown to allow for item selection
                    setTimeout(() => {
                        commandTypeDropdown.style.display = 'none';
                    }, 150);
                });
                
                // Handle keyboard navigation for command type
                commandTypeInput.addEventListener('keydown', function(e) {
                    const items = commandTypeDropdown.querySelectorAll('.dropdown-item');
                    
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                            updateHighlightedItem(items, commandTypeDropdown);
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            highlightedIndex = Math.max(highlightedIndex - 1, 0);
                            updateHighlightedItem(items, commandTypeDropdown);
                            break;
                        case 'Enter':
                            e.preventDefault();
                            if (highlightedIndex >= 0 && highlightedIndex < items.length) {
                                items[highlightedIndex].click();
                            }
                            break;
                        case 'Escape':
                            commandTypeDropdown.style.display = 'none';
                            break;
                    }
                });
                
                // Handle input in the command combobox
                commandInput.addEventListener('input', function() {
                    filterCommandsForCombobox(this.value);
                    commandHighlightedIndex = -1; // Reset highlighted index
                    
                    // If the input is cleared, hide all dependent elements
                    if (!this.value) {
                        // Hide flag table, selected command, run button, and response section
                        document.getElementById('flagsContainer').style.display = 'none';
                        document.getElementById('selectedCommand').style.display = 'none';
                        document.getElementById('runButton').style.display = 'none';
                        document.getElementById('responseLabel').style.display = 'none';
                        document.getElementById('jsonResponse').style.display = 'none';
                        document.getElementById('downloadLink').style.display = 'none';
                        document.getElementById('betaWarning').style.display = 'none';
                    }
                });
                
                // Handle focus on the command input
                commandInput.addEventListener('focus', function() {
                    filterCommandsForCombobox(this.value);
                });
                
                // Handle blur (click outside) on the command input
                commandInput.addEventListener('blur', function() {
                    // Delay hiding the dropdown to allow for item selection
                    setTimeout(() => {
                        commandDropdown.style.display = 'none';
                    }, 150);
                });
                
                // Handle keyboard navigation for command
                commandInput.addEventListener('keydown', function(e) {
                    const items = commandDropdown.querySelectorAll('.dropdown-item');
                    
                    switch (e.key) {
                        case 'ArrowDown':
                            e.preventDefault();
                            commandHighlightedIndex = Math.min(commandHighlightedIndex + 1, items.length - 1);
                            updateHighlightedItem(items, commandDropdown);
                            break;
                        case 'ArrowUp':
                            e.preventDefault();
                            commandHighlightedIndex = Math.max(commandHighlightedIndex - 1, 0);
                            updateHighlightedItem(items, commandDropdown);
                            break;
                        case 'Enter':
                            e.preventDefault();
                            if (commandHighlightedIndex >= 0 && commandHighlightedIndex < items.length) {
                                items[commandHighlightedIndex].click();
                            }
                            break;
                        case 'Escape':
                            commandDropdown.style.display = 'none';
                            break;
                    }
                });
                
                // Function to update the highlighted item in the dropdown
                function updateHighlightedItem(items, dropdown) {
                    items.forEach((item, index) => {
                        if (index === highlightedIndex || index === commandHighlightedIndex) {
                            item.classList.add('highlighted');
                        } else {
                            item.classList.remove('highlighted');
                        }
                    });
                    
                    // Scroll to the highlighted item if needed
                    if ((highlightedIndex >= 0 && highlightedIndex < items.length) ||
                        (commandHighlightedIndex >= 0 && commandHighlightedIndex < items.length)) {
                        const index = highlightedIndex >= 0 ? highlightedIndex : commandHighlightedIndex;
                        items[index].scrollIntoView({block: 'nearest'});
                    }
                }
            });
            
            // Function to hide all dependent elements when command type is cleared
            function hideDependentElements() {
                // Hide flag table, selected command, run button, and response section
                document.getElementById('flagsContainer').style.display = 'none';
                document.getElementById('selectedCommand').style.display = 'none';
                document.getElementById('runButton').style.display = 'none';
                document.getElementById('responseLabel').style.display = 'none';
                document.getElementById('jsonResponse').style.display = 'none';
                document.getElementById('downloadLink').style.display = 'none';
                document.getElementById('betaWarning').style.display = 'none';
                
                // Hide command combobox and label
                const commandInput = document.getElementById('commandInput');
                const commandLabel = document.getElementById('commandLabel');
                const commandDropdown = document.getElementById('commandDropdown');
                commandInput.style.display = 'none';
                commandLabel.style.display = 'none';
                commandDropdown.style.display = 'none';
                
                // Reset command input
                commandInput.value = '';
            }
            
            function populateCommandTypeSelect(commandTypes) {
                const commandTypeInput = document.getElementById('commandTypeInput');
                const commandTypeDropdown = document.getElementById('commandTypeDropdown');
                
                // Set placeholder text
                commandTypeInput.placeholder = 'Select or Search Command Type';
                
                // Populate the combobox with all command types
                allCommandTypes = commandTypes;
                filteredCommandTypes = [...commandTypes];
                populateCommandTypeCombobox(commandTypes);
            }
            
            
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'commandTypesLoaded':
                        allCommandTypes = message.commandTypes;
                        filteredCommandTypes = [...allCommandTypes];
                        
                        populateCommandTypeSelect(filteredCommandTypes);
                        break;
                        
                    case 'commandTypesError':
                        const commandSelect = document.getElementById('commandType');
                        commandSelect.innerHTML = '<option value="" style="font-style: italic; color: #706e6b;">Error loading command types</option>';
                        break;
                        
                    case 'subCommandsLoaded':
                        const commandInput = document.getElementById('commandInput');
                        const commandLabel = document.getElementById('commandLabel');
                        const commandDropdown = document.getElementById('commandDropdown');
                        commandLabel.style.display = 'block';
                        commandInput.style.display = 'block';
                        
                        // Store all commands globally
                        allCommands = message.subCommands;
                        filteredCommands = [...allCommands];
                        
                        // Populate the combobox with all commands
                        populateCommandCombobox(filteredCommands);
                        break;
                        
                    case 'commandDetailsLoaded':
                        displayCommandDetails(message.commandDetails);
                        break;
                    case 'commandExecuted':
                        // Only display response if it's not for internal use
                        if (!message.internal) {
                            displayJsonResponse(message.result);
                        } else {
                            // Handle internal command responses (like sf config list)
                            try {
                                // Parse the JSON response
                                const response = JSON.parse(message.result.stdout || message.result.stderr);
                                
                                // Check if response has the expected structure
                                if (response && response.result && Array.isArray(response.result)) {
                                    // Find the target-org config item
                                    const targetOrgConfig = response.result.find(item => item.key === 'target-org');
                                    if (targetOrgConfig && targetOrgConfig.value) {
                                        window.defaultOrgAlias = targetOrgConfig.value;
                                        console.log('Default org alias loaded:', window.defaultOrgAlias);
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing config list response:', e);
                            }
                        }
                        break;
                }
            });
            
            // Function to display JSON response
            function displayJsonResponse(response) {
                // Hide spinner
                document.getElementById('runSpinner').style.display = 'none';
                
                // Update response label to "Response"
                const responseLabel = document.getElementById('responseLabel');
                responseLabel.textContent = 'Response';
                responseLabel.style.display = 'block';
                
                const jsonResponseDiv = document.getElementById('jsonResponse');
                jsonResponseDiv.style.display = 'block';
                
                // Show download link
                const downloadLink = document.getElementById('downloadLink');
                downloadLink.style.display = 'block';
                
                // Handle the response format from the extension
                if (response && typeof response === 'object') {
                    if (response.error) {
                        // Display error information
                        jsonResponseDiv.innerHTML = '<span style="color: red;">Error:</span> ' + response.message +
                            (response.stderr ? '<br><br><span style="color: orange;">stderr:</span> ' + response.stderr : '') +
                            (response.stdout ? '<br><br><span style="color: blue;">stdout:</span> ' + response.stdout : '');
                        
                        // Store the response for download
                        // Check if stderr or stdout is JSON, if so store as object, otherwise as text
                        let outputForDownload;
                        if (response.stderr) {
                            try {
                                outputForDownload = JSON.parse(response.stderr);
                            } catch (e) {
                                outputForDownload = response.stderr;
                            }
                        } else if (response.stdout) {
                            try {
                                outputForDownload = JSON.parse(response.stdout);
                            } catch (e) {
                                outputForDownload = response.stdout;
                            }
                        } else {
                            outputForDownload = response.message;
                        }
                        
                        window.currentResponse = {
                            cliCommand: document.getElementById('selectedCommand').value,
                            output: outputForDownload
                        };
                        return;
                    } else {
                        // Display stdout with JSON styling if it's valid JSON
                        const stdout = response.stdout || response.stderr;
                        if (stdout) {
                            try {
                                // Try to parse as JSON and apply styling
                                const parsed = JSON.parse(stdout);
                                
                                // Apply styling to all JSON responses regardless of size
                                jsonResponseDiv.innerHTML = styleJson(parsed);
                                
                                // Store the response for download
                                window.currentResponse = {
                                    cliCommand: document.getElementById('selectedCommand').value,
                                    output: parsed
                                };
                                return;
                            } catch (e) {
                                // If not valid JSON, display as plain text
                                // For very large text responses, truncate to avoid performance issues
                                if (stdout.length > 100000) { // If text is larger than ~100KB
                                    jsonResponseDiv.textContent = stdout.substring(0, 100000) + '... (truncated, download to see full response)';
                                } else {
                                    jsonResponseDiv.textContent = stdout;
                                }
                                
                                // Store the response for download as text
                                window.currentResponse = {
                                    cliCommand: document.getElementById('selectedCommand').value,
                                    output: stdout
                                };
                                return;
                            }
                        }
                    }
                }
                
                // Fallback for other response formats
                const responseText = typeof response === 'string' ? response : JSON.stringify(response, null, 2);
                // Try to parse as JSON and apply styling if possible
                try {
                    const parsed = JSON.parse(responseText);
                    // Apply styling to all JSON responses regardless of size
                    jsonResponseDiv.innerHTML = styleJson(parsed);
                    // Store the response for download
                    window.currentResponse = {
                        cliCommand: document.getElementById('selectedCommand').value,
                        output: parsed
                    };
                } catch (e) {
                    // If not valid JSON, display as plain text
                    jsonResponseDiv.textContent = responseText;
                    // Store the response for download
                    window.currentResponse = {
                        cliCommand: document.getElementById('selectedCommand').value,
                        output: responseText
                    };
                }
            }
            
            // Function to apply styling to JSON
            function styleJson(obj, indent = 0) {
                const indentStr = ' '.repeat(indent);
                const nextIndentStr = ' '.repeat(indent + 2);
                
                if (obj === null) return '<span style="color: grey; font-weight: bold; font-style: italic;">null</span>';
                if (obj === undefined) return '<span style="color: red; font-weight: bold; font-style: italic;">undefined</span>';
                if (typeof obj === 'boolean') return '<span style="color: purple; font-weight: bold; font-style: italic;">' + obj + '</span>';
                if (typeof obj === 'number') return '<span style="color: #107000; font-weight: bold; font-style: italic;">' + obj + '</span>';
                if (typeof obj === 'string') return '<span style="color: brown; font-style: italic;">"' + obj + '"</span>';
                
                if (Array.isArray(obj)) {
                    if (obj.length === 0) return '<span style="color: goldenrod; font-weight: bold;">[</span><span style="color: goldenrod; font-weight: bold;">]</span>';
                    const items = obj.map(function(item) {
                        return nextIndentStr + styleJson(item, indent + 2);
                    }).join(',\\n');
                    return '<span style="color: goldenrod; font-weight: bold;">[</span>\\n' + items + '\\n' + indentStr + '<span style="color: goldenrod; font-weight: bold;">]</span>';
                }
                
                if (typeof obj === 'object') {
                    const keys = Object.keys(obj);
                    if (keys.length === 0) return '<span style="color: red; font-weight: bold;">{</span><span style="color: red; font-weight: bold;">}</span>';
                    
                    const items = keys.map(function(key) {
                        const value = obj[key];
                        const styledKey = '<span style="color: darkblue; font-weight: bold;">"' + key + '"</span>';
                        return nextIndentStr + styledKey + ': ' + styleJson(value, indent + 2);
                    }).join(',\\n');
                    
                    return '<span style="color: red; font-weight: bold;">{</span>\\n' + items + '\\n' + indentStr + '<span style="color: red; font-weight: bold;">}</span>';
                }
                
                return String(obj);
            }
            
            
            // Add event listener for Run button
            document.getElementById('runButton').addEventListener('click', function() {
                const command = document.getElementById('selectedCommand').value;
                if (command) {
                    // Validate required flags
                    let hasMissingRequired = false;
                    const flagInputs = document.querySelectorAll('.flag-input');
                    flagInputs.forEach(input => {
                        // Get the flag name from the input id
                        const flagId = input.id.replace('flag-', '');
                        // Check if this is a required flag by looking at the currentFlags array
                        const flag = currentFlags.find(f => f.name.replace(/[^a-zA-Z0-9]/g, '-') === flagId);
                        if (flag && flag.required) {
                            // Check if the input is empty
                            if (!input.value) {
                                hasMissingRequired = true;
                                // Add error border to the input
                                input.classList.add('error');
                                
                                // Show error message
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'error-message';
                                errorDiv.textContent = 'Value is required.';
                                errorDiv.style.display = 'block';
                                input.parentElement.appendChild(errorDiv);
                            }
                        }
                    });
                    
                    // If there are missing required fields, don't execute the command
                    if (hasMissingRequired) {
                        return;
                    }
                    
                    // Clear the JSON response div
                    document.getElementById('jsonResponse').textContent = '';
                    
                    // Hide download link
                    document.getElementById('downloadLink').style.display = 'none';
                    
                    // Show response label with "Awaiting response..." text
                    const responseLabel = document.getElementById('responseLabel');
                    responseLabel.textContent = 'Awaiting response...';
                    responseLabel.style.display = 'block';
                    
                    // Show spinner
                    document.getElementById('runSpinner').style.display = 'inline-block';
                    
                    // Send message to extension to execute command
                    vscode.postMessage({
                        command: 'executeCommand',
                        commandText: command
                    });
                }
            });
            
            // Add event listener for download link
            document.getElementById('downloadLink').addEventListener('click', function() {
                console.log('Download link clicked');
                // Get the current response data
                if (window.currentResponse) {
                    console.log('Current response found:', window.currentResponse);
                    
                    // Determine if the output is JSON or text
                    let content;
                    let fileExtension = '.json';
                    
                    if (typeof window.currentResponse.output === 'string') {
                        // If it's already a string, use it as is
                        content = window.currentResponse.output;
                        // Check if it looks like JSON
                        try {
                            JSON.parse(window.currentResponse.output);
                            // It's valid JSON, keep .json extension
                        } catch (e) {
                            // It's not JSON, use .txt extension
                            fileExtension = '.txt';
                        }
                    } else {
                        // If it's an object, convert to JSON
                        content = JSON.stringify({
                            command: window.currentResponse.cliCommand,
                            output: window.currentResponse.output
                        }, null, 2);
                    }
                    
                    // Create the filename using the selected command name without flags
                    const selectedCommand = document.getElementById('selectedCommand').value;
                    console.log('Selected command:', selectedCommand);
                    // Extract command name (everything after 'sf' and before flags) and replace spaces with hyphens
                    let commandName = 'sf-command'; // default name
                    if (selectedCommand) {
                        // Remove 'sf' prefix and trim
                        let commandPart = selectedCommand.replace('sf', '').trim();
                        // Split by space to separate command from flags
                        const parts = commandPart.split(' ');
                        // Find the index of the first flag (starts with --)
                        let commandEndIndex = parts.length;
                        for (let i = 0; i < parts.length; i++) {
                            if (parts[i].startsWith('--')) {
                                commandEndIndex = i;
                                break;
                            }
                        }
                        // Take only the command parts (before flags) and join with hyphens
                        if (commandEndIndex > 0) {
                            commandName = 'sf-' + parts.slice(0, commandEndIndex).join('-');
                        } else {
                            commandName = 'sf-command';
                        }
                        // Replace any remaining colons with hyphens
                        commandName = commandName.replace(/:/g, '-');
                    }
                    const timestamp = new Date().getTime();
                    const filename = commandName + '-' + timestamp + fileExtension;
                    console.log('Filename created:', filename);
                    
                    // Send message to VS Code extension to save the file
                    vscode.postMessage({
                        command: 'saveFile',
                        filename: filename,
                        content: content
                    });
                } else {
                    console.log('No current response found');
                }
            });
            
            // Initialize the combobox when the page loads
           document.addEventListener('DOMContentLoaded', function() {
               // Set initial placeholder text
               document.getElementById('commandTypeInput').placeholder = 'Loading command types...';
               // Hide command input by default
               document.getElementById('commandInput').style.display = 'none';
           });
            
            // Call sf config list command on page load to get target-org
            function loadOrgAliases() {
                // Execute sf config list command
                vscode.postMessage({
                    command: 'executeCommand',
                    commandText: 'sf config list --json',
                    internal: true // Flag to indicate this is for internal use
                });
            }
            
            // Call loadOrgAliases on page load
            loadOrgAliases();
            
            // Function to update the selected command display with flag values
            function updateSelectedCommandDisplay(commandName, flags) {
                // Remove ' (Beta)' from command name
                const cleanCommandName = commandName.replace(' (Beta)', '');
                let commandString = 'sf ' + cleanCommandName;
                
                // Check if this is one of the special commands that needs --output-dir
                let defaultOutputDir = null;
                if (commandName === 'apex generate class') {
                    defaultOutputDir = 'force-app/main/default/classes';
                } else if (commandName === 'apex generate trigger') {
                    defaultOutputDir = 'force-app/main/default/triggers';
                }
                
                // Set the default value in the --output-dir input field if it's one of our special commands
                if (defaultOutputDir) {
                    const outputDirInput = document.getElementById('flag---output-dir');
                    if (outputDirInput && !outputDirInput.value) {
                        outputDirInput.value = defaultOutputDir;
                    }
                }
                
                // Add flags with values to the command string
                flags.forEach(flag => {
                    const input = document.getElementById('flag-' + flag.name.replace(/[^a-zA-Z0-9]/g, '-'));
                    if (input) {
                        // Handle boolean flags (checkboxes)
                        if (flag.type === 'boolean') {
                            // If checkbox is checked, add the flag without a value
                            if (input.checked) {
                                commandString += ' ' + flag.name;
                            }
                        } else {
                            // Handle text and select inputs
                            let value = input.value;
                            
                            // Set default value for --target-org if it's empty and we have a default org
                            if (flag.name === '--target-org' && !value && window.defaultOrgAlias) {
                                value = window.defaultOrgAlias;
                                input.value = window.defaultOrgAlias;
                            }
                            
                            // If there's a value (user-entered or default), add it to the command
                            if (value) {
                                commandString += ' ' + flag.name + ' "' + value + '"';
                            }
                            // If it's a required flag and has no value, add <<REQUIRED>> placeholder
                            // This includes both initial load and when user selects empty option
                            else if (flag.required && !value) {
                                commandString += ' ' + flag.name + ' "<<REQUIRED>>"';
                            }
                        }
                    }
                });
                
                // Add the --output-dir to the command string if it's one of our special commands
                if (defaultOutputDir) {
                    // Check if --output-dir is already in the command string
                    if (!commandString.includes('--output-dir')) {
                        commandString += ' --output-dir "' + defaultOutputDir + '"';
                    }
                }
                
                // Update the selected command input
                const selectedCommandInput = document.getElementById('selectedCommand');
                selectedCommandInput.value = commandString;
                
                // Show/hide beta warning
                const betaWarning = document.getElementById('betaWarning');
                if (commandName.includes('Beta')) {
                    betaWarning.style.display = 'block';
                } else {
                    betaWarning.style.display = 'none';
                }
                
                // Show the Run button when there's a command
                if (commandString.trim() !== '') {
                    document.getElementById('runButton').style.display = 'block';
                } else {
                    document.getElementById('runButton').style.display = 'none';
                }
            }
            
            function displayCommandDetails(commandDetails) {
                if (!commandDetails) return;
                
                // Clear existing flags
                const table = document.getElementById('flagsTable');
                table.innerHTML = '';
                
                // Combine required and optional flags with required flags first
                let allFlags = [];
                if (commandDetails.requiredFlags && commandDetails.requiredFlags.length > 0) {
                    allFlags = allFlags.concat(commandDetails.requiredFlags.map(flag => ({...flag, required: true})));
                }
                if (commandDetails.optionalFlags && commandDetails.optionalFlags.length > 0) {
                    allFlags = allFlags.concat(commandDetails.optionalFlags.map(flag => ({...flag, required: false})));
                }
                
                // Display all flags in table
                if (allFlags.length > 0) {
                    displayFlagsInTable(table, allFlags);
                }
            }
            
            // Store flags data globally so it can be accessed by update functions
            let currentCommandName = '';
            let currentFlags = [];
            
            function displayCommandDetails(commandDetails) {
                if (!commandDetails) return;
                
                // Clear existing flags
                const table = document.getElementById('flagsTable');
                table.innerHTML = '';
                
                // Combine required and optional flags with required flags first
                let allFlags = [];
                if (commandDetails.requiredFlags && commandDetails.requiredFlags.length > 0) {
                    allFlags = allFlags.concat(commandDetails.requiredFlags.map(flag => ({...flag, required: true})));
                }
                if (commandDetails.optionalFlags && commandDetails.optionalFlags.length > 0) {
                    allFlags = allFlags.concat(commandDetails.optionalFlags.map(flag => ({...flag, required: false})));
                }
                
                // Store flags data globally
                currentCommandName = commandDetails.name;
                currentFlags = allFlags;
                
                // Display all flags in table
                if (allFlags.length > 0) {
                    displayFlagsInTable(table, allFlags);
                }
                
                // Update selected command display with default values
                updateSelectedCommandDisplay(commandDetails.name, allFlags);
            }
            
            function displayFlagsInTable(table, flags) {
                // Create table rows with 4 flags per row
                for (let i = 0; i < flags.length; i += 4) {
                    const row = document.createElement('tr');
                    
                    // Add up to 4 flags per row
                    for (let j = i; j < i + 4 && j < flags.length; j++) {
                        const flag = flags[j];
                        const cell = document.createElement('td');
                        
                        // Create label with tooltip
                        const label = document.createElement('label');
                        label.className = 'flag-label';
                        if (flag.required) {
                            label.classList.add('required');
                        }
                        label.textContent = flag.name;
                        
                        // Add tooltip element
                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip';
                        tooltip.textContent = flag.description;
                        label.appendChild(tooltip);
                        
                        // Add event listeners for tooltip positioning
                        label.addEventListener('mouseenter', function(e) {
                            tooltip.style.display = 'block';
                        });
                        
                        label.addEventListener('mousemove', function(e) {
                            tooltip.style.left = e.pageX + 10 + 'px';
                            tooltip.style.top = e.pageY - 30 + 'px';
                        });
                        
                        label.addEventListener('mouseleave', function() {
                            tooltip.style.display = 'none';
                        });
                        
                        // Create input or select based on flag properties
                        let input;
                        if (flag.type === 'boolean') {
                            // Create checkbox for boolean flags
                            input = document.createElement('input');
                            input.type = 'checkbox';
                            input.className = 'flag-input';
                            input.id = 'flag-' + flag.name.replace(/[^a-zA-Z0-9]/g, '-');
                            
                            // Set default value if available
                            if (flag.defaultValue) {
                                input.checked = flag.defaultValue === 'true';
                            }
                        } else if (flag.name === '--target-org') {
                            // Create input for --target-org flag
                            input = document.createElement('input');
                            input.type = 'text';
                            input.className = 'flag-input';
                            input.id = 'flag-' + flag.name.replace(/[^a-zA-Z0-9]/g, '-');
                            
                            // Set default value if available
                            if (flag.defaultValue) {
                                input.value = flag.defaultValue;
                            }
                            
                            // Add event listener to remove error message when user selects a value
                            input.addEventListener('input', function() {
                                updateSelectedCommandDisplay(currentCommandName, currentFlags);
                                
                                // Hide response and download link when flag is modified
                                document.getElementById('responseLabel').style.display = 'none';
                                document.getElementById('jsonResponse').style.display = 'none';
                                document.getElementById('downloadLink').style.display = 'none';
                                
                                // Remove error message if it exists
                                const errorDiv = input.parentElement.querySelector('.error-message');
                                if (errorDiv) {
                                    errorDiv.remove();
                                }
                                
                                // Remove error border if it exists
                                input.classList.remove('error');
                            });
                        } else if (flag.permissibleValues && flag.permissibleValues.length > 0) {
                            // Create select for flags with permissible values
                            input = document.createElement('select');
                            input.className = 'flag-input';
                            input.id = 'flag-' + flag.name.replace(/[^a-zA-Z0-9]/g, '-');
                            
                            // Add empty option for required flags without default value and for optional flags
                            if ((flag.required && !flag.defaultValue) || !flag.required) {
                                const emptyOption = document.createElement('option');
                                emptyOption.value = '';
                                input.appendChild(emptyOption);
                            }
                            
                            // Add options from permissible values
                            flag.permissibleValues.forEach(value => {
                                const option = document.createElement('option');
                                option.value = value;
                                option.textContent = value;
                                input.appendChild(option);
                            });
                            
                            // Set default value if available
                            if (flag.defaultValue) {
                                input.value = flag.defaultValue;
                            }
                            
                            // Add event listener to remove error message when user selects a value
                            input.addEventListener('change', function() {
                                // Set userSelectedEmpty flag if empty option is selected
                                if (input.value === '') {
                                    input.dataset.userSelectedEmpty = 'true';
                                } else {
                                    // Remove the flag if a value is selected
                                    delete input.dataset.userSelectedEmpty;
                                }
                                
                                // Hide response and download link when flag is modified
                                document.getElementById('responseLabel').style.display = 'none';
                                document.getElementById('jsonResponse').style.display = 'none';
                                document.getElementById('downloadLink').style.display = 'none';
                                
                                // Remove error message if it exists
                                const errorDiv = input.parentElement.querySelector('.error-message');
                                if (errorDiv) {
                                    errorDiv.remove();
                                }
                                
                                // Remove error border if it exists
                                input.classList.remove('error');
                                
                                // Update selected command display when value changes
                                updateSelectedCommandDisplay(currentCommandName, currentFlags);
                            });
                        } else {
                            // Create input for regular flags
                            input = document.createElement('input');
                            input.type = 'text';
                            input.className = 'flag-input';
                            // Remove placeholder text
                            input.id = 'flag-' + flag.name.replace(/[^a-zA-Z0-9]/g, '-');
                            
                            // Set default value if available
                            if (flag.defaultValue) {
                                input.value = flag.defaultValue;
                            }
                        }
                        
                        // Add event listener to update selected command display when input changes
                        input.addEventListener('input', function() {
                            updateSelectedCommandDisplay(currentCommandName, currentFlags);
                            
                            // Hide response and download link when flag is modified
                            document.getElementById('responseLabel').style.display = 'none';
                            document.getElementById('jsonResponse').style.display = 'none';
                            document.getElementById('downloadLink').style.display = 'none';
                            
                            // Remove error message if it exists
                            const errorDiv = input.parentElement.querySelector('.error-message');
                            if (errorDiv) {
                                errorDiv.remove();
                            }
                            
                            // Remove error border if it exists
                            input.classList.remove('error');
                        });
                        
                        // For checkboxes, also add a change event listener
                        if (flag.type === 'boolean') {
                            input.addEventListener('change', function() {
                                updateSelectedCommandDisplay(currentCommandName, currentFlags);
                                
                                // Hide response and download link when flag is modified
                                document.getElementById('responseLabel').style.display = 'none';
                                document.getElementById('jsonResponse').style.display = 'none';
                                document.getElementById('downloadLink').style.display = 'none';
                                
                                // Remove error message if it exists
                                const errorDiv = input.parentElement.querySelector('.error-message');
                                if (errorDiv) {
                                    errorDiv.remove();
                                }
                                
                                // Remove error border if it exists
                                input.classList.remove('error');
                            });
                        }
                        
                        cell.appendChild(label);
                        cell.appendChild(input);
                        row.appendChild(cell);
                    }
                    
                    // Fill remaining cells with empty content if less than 4 flags in row
                    for (let j = (flags.length - i < 4 ? flags.length - i : 4); j < 4; j++) {
                        const emptyCell = document.createElement('td');
                        row.appendChild(emptyCell);
                    }
                    
                    table.appendChild(row);
                }
            }
            
            vscode.postMessage({ command: 'getCommandTypes' });
        </script>
    </body>
    </html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
