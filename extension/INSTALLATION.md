# Cognia Extension Installation Guide

## Enterprise / managed install

Administrators deploying Cognia via Chrome Enterprise (Group Policy / MDM)
can use the template at `policy/cognia-extension-policy.json` to force-install
the extension and apply runtime host blocklists (banking, health, admin
consoles). Replace `<extension-id>` with the published Web Store id and merge
the JSON into your existing `ExtensionSettings` policy.

## Hardening roadmap (host permissions)

The current `manifest.json` requests `<all_urls>` host permissions to support
the extension's continuous capture flow. The hardening migration moves this
to `optional_host_permissions` with `activeTab` as the default. This change
is intentionally deferred until the popup/background flow is updated to
request optional permissions on demand — see TODO in
`extension/src/content/index.ts`. Tracked as part of Phase 6 Slice C.

## Quick Start

### Option A: Install from Pre-built Release (4 Steps)

1. **Download**: [Get the latest release](https://github.com/cogniahq/Cognia/releases/latest)
2. **Extract**: Unzip the downloaded file
3. **Enable**: Chrome → Extensions → Developer mode → ON
4. **Load**: Click "Load unpacked" → Select the extracted `dist` folder

### Option B: Build from Source (5 Steps)

1. **Clone**: Clone the repository or download the source code
2. **Install**: Run `npm install` in the `extension` directory
3. **Build**: Run `npm run build` to create the `dist` folder
4. **Enable**: Chrome → Extensions → Developer mode → ON
5. **Load**: Click "Load unpacked" → Select the `dist` folder

**System Requirements**: Chrome 88+, 4GB RAM minimum, stable internet connection

---

## Overview

Cognia is a browser extension that automatically captures and processes your web browsing activity to create a searchable, AI-powered memory network. The extension uses Manifest V3 and supports Chrome. Since the extension is not yet published to browser extension stores, you'll need to install it manually using developer mode.

## Installation Steps

### Method 1: Install from Pre-built Release

#### Step 1: Download the Extension

1. Go to the [Cognia GitHub Releases page](https://github.com/cogniahq/Cognia/releases/latest)
2. Look for the latest release with a file named `cognia-extension-vX.X.X.zip`
3. Click the download link to save the zip file to your computer
4. Note the location where you saved the file (usually your Downloads folder)

#### Step 2: Extract the Extension Files

1. Navigate to the folder where you downloaded the zip file
2. Right-click on the `cognia-extension-vX.X.X.zip` file
3. Select "Extract All" or "Extract Here" (depending on your operating system)
4. This will create a new folder with the extension files
5. **Important**: Navigate into the extracted folder and locate the `dist` folder - this is what you'll load in the browser

#### Step 3: Enable Developer Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. In the top-right corner, toggle **"Developer mode"** to ON
3. You should see new buttons appear: "Load unpacked", "Pack extension", and "Update"

#### Step 4: Load the Extension

1. Click the **"Load unpacked"** button
2. Navigate to the `dist` folder (it should contain files like `manifest.json`, `popup.html`, `background.js`, etc.)
3. Click **"Select Folder"**

#### Step 5: Verify Installation

1. You should see the Cognia extension appear in your extensions list
2. Look for the Cognia icon in your browser toolbar (top-right area)
3. Click on the Cognia icon to open the extension popup
4. You should see the Cognia interface with status indicators and settings

### Method 2: Build from Source

#### Step 1: Prerequisites

- Node.js 18+ and npm installed
- Git (if cloning the repository)

#### Step 2: Get the Source Code

1. Clone the repository:

   ```bash
   git clone https://github.com/cogniahq/Cognia.git
   cd Cognia/extension
   ```

   Or download the source code from GitHub and extract it

#### Step 3: Install Dependencies

```bash
npm install
```

#### Step 4: Build the Extension

```bash
npm run build
```

This will create a `dist` folder with all the compiled extension files.

#### Step 5: Load the Extension

Follow **Step 3** and **Step 4** from Method 1 above, using the `dist` folder created by the build process.

**Note**: For development, you can use `npm run watch` to automatically rebuild when files change.

## Post-Installation Setup

### Configure Settings

1. Click the Cognia extension icon to open the popup
2. Review the status indicators:
   - **API**: Shows connection status to the Cognia API server
   - **Auth**: Shows authentication status
   - **Last Capture**: Displays when content was last captured

3. Configure your preferences:
   - **Extension Toggle**: Enable/disable the extension's content capture functionality
   - **Memory Injection**: Enable/disable automatic memory injection into AI chat interfaces (ChatGPT, Claude, etc.)
   - **Blocked Websites**: Add domains to exclude from content capture
     - Enter a domain (e.g., `example.com`) and click "Add"
     - Or click "Block Current Domain" to block the site you're currently viewing
     - Click "Unblock" to remove a domain from the blocked list

**Note**: The extension requires a running Cognia API server. Make sure your API endpoint is configured correctly in the extension settings.

## Troubleshooting

### Extension Not Loading

**Problem**: The extension doesn't appear after clicking "Load unpacked"

**Solutions**:

- Make sure you selected the `dist` folder (the one containing `manifest.json`, `popup.html`, `background.js`, etc.)
- If building from source, ensure you ran `npm run build` first
- Check that Developer mode is enabled
- Try refreshing the extensions page (`chrome://extensions/`)
- Check the browser console for error messages
- Restart your browser and try again

### Extension Icon Not Visible

**Problem**: Can't find the Cognia icon in the toolbar

**Solutions**:

- Click the puzzle piece icon in the toolbar
- Look for Cognia in the list and click the pin icon to pin it to the toolbar
- Check if the extension is enabled in the extensions page

### API Connection Issues

**Problem**: Can't connect the extension to the API (shows "Not connected" in popup)

**Solutions**:

- Ensure the Cognia API server is running and reachable
- Verify the API endpoint URL is correctly configured (check extension storage or settings)
- Check browser DevTools console (F12) for network errors
- Verify CORS settings on the API server allow requests from the extension
- Check that the API health endpoint is accessible

### Permission Errors

**Problem**: Extension shows permission errors

**Solutions**:

- Go to the extensions page and click "Details" on Cognia
- Review and approve all required permissions
- Make sure the extension has access to the sites you want to monitor

## Security Notes

- **Developer Mode**: Installing unpacked extensions requires Developer mode, which is intended for developers
- **Source Verification**: Only download the extension from the official Cognia GitHub repository
- **Permissions**: Review the extension permissions before installation
- **Updates**: You'll need to manually update the extension by downloading new releases

## Uninstalling the Extension

If you need to remove the extension:

1. Go to `chrome://extensions/`
2. Find Cognia in the list
3. Click **"Remove"** or the trash icon
4. Confirm the removal

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the Issues**: Visit the [GitHub Issues page](https://github.com/cogniahq/Cognia/issues)
2. **Read the Documentation**: Check the main [README.md](../README.md) for more information
3. **Join the Community**: Look for community discussions in GitHub Discussions
4. **Report Bugs**: Create a new issue on GitHub with detailed information about your problem

## System Requirements

- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **Browser**: Chrome 88+
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 100MB free space for extension files
- **Internet**: Stable connection for AI processing and API communication
- **Node.js** (for building from source): Node.js 18+ and npm

## Privacy and Data

- **Local Processing**: Content is processed locally when possible
- **Cloud/Local AI**: Content is optionally processed locally via Ollama
- **No Tracking**: The extension doesn't track your browsing habits for advertising
- **User Control**: You control what gets captured and stored

## Quick Reference

### Installation Checklist

**For Pre-built Release:**

- [ ] Downloaded extension from GitHub releases
- [ ] Extracted zip file to a folder
- [ ] Located the `dist` folder
- [ ] Enabled Developer mode in browser
- [ ] Loaded unpacked extension (selected `dist` folder)
- [ ] Verified extension appears in browser
- [ ] Checked API connection status in popup
- [ ] Configured extension settings (if needed)
- [ ] Started browsing to test capture

**For Building from Source:**

- [ ] Cloned/downloaded source code
- [ ] Installed dependencies (`npm install`)
- [ ] Built the extension (`npm run build`)
- [ ] Located the `dist` folder
- [ ] Enabled Developer mode in browser
- [ ] Loaded unpacked extension (selected `dist` folder)
- [ ] Verified extension appears in browser
- [ ] Checked API connection status in popup
- [ ] Configured extension settings (if needed)
- [ ] Started browsing to test capture

### Common Commands

**Browser Extension Page:**

- Chrome: `chrome://extensions/`

**Developer Mode:**

- Chrome: Toggle in top-right corner

**Build Commands (from source):**

- Install dependencies: `npm install`
- Build extension: `npm run build`
- Watch mode (development): `npm run watch`
- Clean build: `npm run clean`

### Need Help?

- 📖 **This Guide**: Complete installation and troubleshooting
- 🐛 **Report Issues**: [GitHub Issues](https://github.com/cogniahq/Cognia/issues)
- 💬 **Get Support**: [GitHub Discussions](https://github.com/cogniahq/Cognia/discussions)
- 📚 **Documentation**: [Main README](../README.md)

---

**Note**: This is a development version of Cognia (v0.1.0). The extension is still in development and may have bugs or incomplete features. Use at your own discretion and report any issues you encounter.

## Development

If you're contributing to the extension or want to modify it:

1. **Clone the repository** and navigate to the `extension` directory
2. **Install dependencies**: `npm install`
3. **Build**: `npm run build` (creates `dist` folder)
4. **Watch mode**: `npm run watch` (auto-rebuilds on file changes)
5. **Lint**: `npm run lint` or `npm run lint:fix`
6. **Format**: `npm run format` or `npm run format:check`
7. **Full check**: `npm run check` (runs lint, format, and build)

The extension is built using:

- TypeScript
- React 18
- Tailwind CSS
- esbuild
- Manifest V3

For more development details, see [README.md](./README.md).
