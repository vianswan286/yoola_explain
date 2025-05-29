# Yoola Browser Extension

A Chrome/Firefox extension that simplifies Terms of Service and Privacy Policies using AI-powered summarization.

## Features

- **Right-Click Summarization**: Right-click on any link to terms of service to summarize the content
- **Current Page Summarization**: Summarize the terms of service on the current page
- **Multi-Language Support**: Get summaries in multiple languages including English, Spanish, Russian, French, and more
- **Visual Indicators**: Option to highlight Terms of Service links on web pages
- **Customizable Settings**: Configure API server URL and default language preferences

## How It Works

1. **Detection**: The extension detects Terms of Service content on web pages
2. **Extraction**: When requested, the extension extracts the relevant text
3. **AI Processing**: The text is sent to the Yoola API server for AI-powered summarization
4. **Presentation**: The summary is displayed in an easy-to-read format with key points, data collection info, user rights, and important alerts

## Installation

### Developer Mode Installation (Chrome)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the `extension` folder
5. The Yoola extension is now installed and ready to use

### Developer Mode Installation (Firefox)

1. Download or clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Navigate to and select the `manifest.json` file in the `extension` folder
5. The Yoola extension is now installed and ready to use

## Usage

### Summarizing from a Link

1. Find a link to Terms of Service or Privacy Policy on any website
2. Right-click on the link
3. Select "Summarize Terms with Yoola" from the context menu
4. The extension will navigate to the page and display a summary

### Summarizing the Current Page

1. Navigate to a Terms of Service or Privacy Policy page
2. Click the Yoola extension icon in the toolbar
3. Click "Summarize This Page"
4. The extension will extract the content and display a summary

### Changing the Summary Language

1. Click the Yoola extension icon in the toolbar
2. Select your preferred language from the dropdown
3. When viewing a summary, you can also change the language directly in the summary view

## Configuration

1. Click the Yoola extension icon in the toolbar
2. Click "Settings"
3. Configure the following options:
   - API URL: The URL of your Yoola API server
   - Default Language: Your preferred language for summaries
   - Display Options: Whether to highlight terms links and show indicators

## Extension Structure

```
/extension
|-- images/                 # Icon images
|-- popup/                  # Popup UI files
|   |-- popup.html
|   |-- popup.css
|   |-- popup.js
|-- options/                # Settings page files
|   |-- options.html
|   |-- options.css
|   |-- options.js
|-- background.js           # Background script
|-- content.js              # Content script that runs on web pages
|-- manifest.json           # Extension manifest
|-- README.md               # This file
```

## Building for Production

For production deployment, you may want to:

1. Minify the JavaScript and CSS files
2. Update the API endpoint to your production server
3. Package the extension for the Chrome Web Store or Firefox Add-ons

## Requirements

- Chrome 88+ or Firefox 78+
- Active Yoola API server (default: http://127.0.0.1:8000)
