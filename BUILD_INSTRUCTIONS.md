# Build Instructions

## Steps to Build and Load Extension

1. **Install dependencies:**
   ```bash
   cd extension
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run build
   ```

3. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `extension/dist` folder

4. **Verify build output:**
   The `dist` folder should contain:
   - `manifest.json`
   - `main.js` (React app)
   - `content.js` (content script)
   - `background.js` (background script)
   - `chunks/` folder (React chunks)
   - `assets/` folder (CSS and other assets)

## Troubleshooting

If you see "Could not load manifest":
- Make sure `dist/manifest.json` exists
- Check that the build completed successfully

If you see "Could not load css":
- The CSS is now bundled with the React app
- Make sure `main.js` is loading correctly

If extension doesn't appear:
- Check browser console for errors
- Verify all files are in `dist` folder
- Try reloading the extension
