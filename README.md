# Salesforce CLI Command Manager

A VS Code extension that provides an intuitive interface for managing all Salesforce CLI commands with advanced features for efficient development.

[![Salesforce CLI Command Manager Interface](https://img.youtube.com/vi/m9gw_vSaqNQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=m9gw_vSaqNQ)
*Short video of the Salesforce CLI Command Manager*

## Features

### Comprehensive Command Coverage
This extension handles all available sf CLI commands, providing a complete interface for Salesforce CLI operations directly within VS Code.

### 1. Command Type Selection
Easily select from the full list of available Salesforce CLI command types through an intuitive dropdown interface.

![Command Type Selection](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/command-type-selection.png)
*Select from all available command types*

### 2. Command Types Filtering
Filter command types using comma-separated search strings for quick access to the commands you need.

![Command Type Filtering](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/command-type-filtering.png)
*Filter command types with comma-separated values*

### 3. Command Filtering
Filter command using comma-separated search strings for quick access to the commands you need.
![Command Filtering](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/command-filtering.png)
*Filter command types with comma-separated values*

### 4. Flag Value Components
Dedicated components for specifying values for both optional and required flags for each command, ensuring all necessary parameters are captured.

![Flag Components](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/flag-components.png)
*Components for specifying flag values*

### 5. Boolean Flag Checkboxes
Specialized checkboxes for boolean flags like `--json`, `--ignore-warnings`, etc., making it easy to toggle these options.

![Boolean Flags](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/boolean-flags.png)
*Checkboxes for boolean flags*

### 6. Permissible Value Picklists
Picklists for flags with a set of permissible values, such as `--test-level` with values RunLocalTests, RunAllTestsInOrg, and RunSpecifiedTests.

![Permissible Values](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/permissible-values.png)
*Picklists for flags with permissible values*

### 7. Required Flag Indicators
Required flag labels are clearly marked with red asterisks for quick identification of mandatory fields.

![Required Flags](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/required-flags-new.png)
*Required flags marked with red asterisks*

### 8. Flag Tooltip Information
Hover over any flag label to view detailed tooltip information about the flag's purpose and usage, providing quick access to documentation without leaving the interface.

![Flag Tooltip](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/flag-tooltip-new.png)
*Flag tooltip information on hover*

### 9. Automatic setting of --target-org flag
The `--target-org` flag is automatically set with target org configured in config file.

![Target Org Picklist](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/target-org.png)
*Auto-populated target org picklist*

### 10. Default Flag Values
Smart default values are set for flags where applicable, speeding up command configuration.

![Default Values](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/default-values.png)
*Automatic default values for flags*

### 11. Selected Command Display
A read-only multi-line text box displays the selected command with flags, showing default values and placeholders for required flags.

Example:
```
sf project deploy validate --target-org "<<REQUIRED>>" --test-level "RunLocalTests" --wait "33"
```

![Selected Command](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/selected-command-new.png)
*Selected command display with flag values*

### 12. Real-time Command Preview
When specifying or selecting a value for any flag, it automatically appears in the selected command text box for immediate preview.

![Command Preview](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/command-preview-new.png)
*Real-time command preview as flags are updated*

### 13. Dynamic Command Updates
Removing or deselecting a flag value automatically removes it from the selected command text box, with placeholders for required flags reappearing as needed.

### 14. Required Field Validation
Clicking the Run button without specifying required values triggers validation errors, displaying "Value is required" below the red-bordered flag component.

![Validation Error](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/validation-error-new.png)
*Validation error for missing required fields*

### 15. Progress Indication
When executing a command, a progress spinner is displayed to indicate that the operation is in progress.

![Progress Spinner](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/progress-spinner-new.png)
*Progress spinner during command execution*

### 16. Styled Error Responses
Error responses are displayed in a well-styled format for easy identification and troubleshooting.

![Error Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/error-response.png)
*Well-styled error response display*

### 17. Formatted JSON Responses
Commands that support JSON responses are displayed in a well-formatted, color-styled format (use the `--json` flag for commands that require it).

![JSON Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/json-response.png)
*Color-styled JSON response formatting*

### 18. Success Response Download Capability
Download a JSON file containing the full command and its success response for documentation or sharing purposes, with notification.

![Download Success Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/download-success-response.png)
*Download success response as JSON file*

![Downloaded Success Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/downloaded-success-json.png)
*Downloaded success response JSON file*

### 19. Failed Response Download Capability
Download a JSON file containing the full command and its failed response for documentation or sharing purposes, with notification.

![Download Failed Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/download-failed-response.png)
*Download failed response as JSON file*

![Downloaded Failed Response](https://raw.githubusercontent.com/shabu74/sf-cli-command-manager/main/downloaded-failed-json.png)
*Downloaded failed response JSON file*

### 20. Contextual Command Display
The command picklist is displayed only after selecting a command type, providing a focused workflow.

### 21. Conditional UI Elements
Flag components, the selected command display, and the Run button are only shown after a command has been selected, reducing visual clutter.

### 22. Smart Response Management
The response section and download link are automatically hidden when you select a new command type, command, or modify flags, ensuring you're always working with current data.

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Open Salesforce CLI Command Manager"
3. Select a command type from the dropdown or use the filter to find it quickly
4. Choose a specific command from the command picklist
5. Set values for required and optional flags as needed
6. Click the "Run" button to execute the command
7. View the response in the formatted display area
8. Download the response as a JSON file if needed

## Installation

1. Package the extension: `vsce package`
2. Install the generated `.vsix` file in VS Code

## Development

This extension is built for extensibility. Additional features can be easily added to enhance the Salesforce CLI command management experience.

## Requirements

- Salesforce CLI installed and configured
- VS Code version 1.50.0 or higher
- An authenticated Salesforce org

## Release Notes

### 1.0.4
- Implemented combo box for commands to select or search required command

### 1.0.3
- Implemented sf config list command to get target org value
- Text box re-introduced for --target-org flag

### 1.0.2
- Fixed file buffer size limit issue that was causing "stdout maxBuffer length exceeded" errors
- Fixed connected org fetching issue for the --target-org flag
- Default connected org will be set as default value for --target-org flag
- force-app folder path will be set as default value for --output-dir if selected command is sf apex generate class/trigger

### 1.0.1
- Included video link demonstration of the Salesforce CLI Command Manager interface

### 1.0.0
- Initial release of Salesforce CLI Command Manager
- Full command type selection and filtering
- Complete flag management system
- Advanced response handling and formatting