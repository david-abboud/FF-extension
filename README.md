# Feature Flags Chrome Extension

A Chrome extension for managing feature flags across different environments. Easily toggle, search, pin, and manage feature flags for development and production environments.

<img width="312" alt="image" src="https://github.com/user-attachments/assets/05fec918-e79c-4014-b5e3-753ed4bbf17e">

## Features

- 🔄 Toggle multiple feature flags at once
- 📌 Pin frequently used flags
- 🔍 Search functionality
- 💾 Local caching (5-minute duration)
- 🔄 Auto-sync across tabs
- 🎯 Support for both development and Proj05 environments
= 💾 Preserves FF upon refresh and server rebuild (on save) as long as the FF is selected from the popup

## Installation

1. Clone the repository:
```bash
git clone https://github.com/david-abboud/FF-extension.git
```

2. Install in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `extension` folder from the cloned repository

## Usage

### Basic Operations
- Click "All" to toggle all feature flags
- Use the search bar to filter flags
- Click the refresh button (⟳) to force fetch latest flags
- Click "Apply Flags" to update the current tab's URL

### Adding New Flags
1. Choose environment type using the Dev/Proj05 toggle
2. Enter flag name in the input field
3. Click "Add" button

### Managing Flags
- Pin important flags using the 📌 button
- Delete flags using the trash icon
- Toggle individual flags using the checkbox

## Backend Infrastructure

The extension communicates with a REST API built with:
- AWS API Gateway for endpoint management
- AWS Lambda for handling API requests
- DynamoDB for storing feature flags
- AWS CDK for infrastructure deployment

## License

This project is licensed under the MIT License - see the LICENSE file for details.
