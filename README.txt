Grolinx RE Investment App bundle

Files included:
- index.html        -> Main HTML file. Place at your site root.
- grolinx.css       -> Scoped CSS for the module area. Link from <head> or paste into a <style> block.
- app.js            -> Application JavaScript. Must be loaded after the DOM (script tag at the end of body).
- GroLinx_logo_light.png -> (optional) logo file if you want to include branding.

Quick deployment instructions:
1) Unzip the bundle and place all files in the same directory on your static host (Netlify / S3 / any web server).
2) Ensure the files are served as static assets. The index.html references grolinx.css and app.js by relative paths.
3) Important: The grolinx.css file must be linked in the <head> of index.html. The provided index.html already includes:
   <link rel="stylesheet" href="grolinx.css">
   Alternatively, you can open grolinx.css and copy its contents into a <style>...</style> block inside <head>.
4) Clear caches and publish. Open the site URL and verify the Module Hub loads.

Why you might see a file displayed as ????????
- If you open the ZIP in your browser tab instead of downloading it, some browsers attempt to render binary content showing garbled characters.
- To correctly access the files: download the ZIP, extract locally (or use your hosting provider's file upload), then open index.html in a browser.

If you want the CSS embedded directly inside index.html (single-file deployment), replace the
<link rel="stylesheet" href="grolinx.css"> line with:

<style>
  (paste contents of grolinx.css here)
</style>

Need me to produce a single-file HTML with CSS inlined? Reply: please inline and I will create and zip it.
