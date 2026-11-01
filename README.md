# Hidden Words Memorizer

A free app for memorizing the Hidden Words of Bahá’u’lláh. It runs in any modern browser, installs to the home screen on iPhone, iPad, Android, Mac, Windows and Chromebook, and works offline after the first visit.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The whole app, including all 155 passages |
| `manifest.webmanifest` | Lets phones and computers install it as an app |
| `sw.js` | Makes it work offline |
| `icons/` | App icons |

Keep these files together in one folder. The app must be served from a web address (https), not opened as a file, for installing and offline use to work.

## Put it online with Netlify (about 5 minutes, no coding)

1. Unzip `hidden-words-app.zip` on a computer. You should have a folder named `hidden-words-app`.
2. Go to **app.netlify.com/drop** in a web browser.
3. Drag the `hidden-words-app` folder onto the page.
4. Netlify gives you a web address like `https://random-name-123.netlify.app`. The app is live.
5. To keep the site permanently, create a free Netlify account when prompted (otherwise a dropped site expires after an hour).
6. Optional: in **Site configuration → Change site name**, choose a clearer address, such as `hidden-words-memorizer.netlify.app`.

To publish an update later: open your site in Netlify, go to **Deploys**, and drag the updated folder onto the page. Before uploading, open `sw.js` and change `hw-v1` to `hw-v2` (then `hw-v3`, and so on) so everyone's offline copy refreshes.

## Alternatives

- **GitHub Pages:** create a free repository, upload the contents of the folder, then turn on **Settings → Pages** and choose the main branch. Your address will be `https://your-name.github.io/repository-name/`.
- **Cloudflare Pages:** create a project, choose **Upload assets**, and drag in the folder.

## Installing the app (share these steps with others)

- **iPhone or iPad (Safari):** open the address, tap the **Share** button, then **Add to Home Screen**.
- **Android (Chrome):** open the address, tap the **⋮** menu, then **Install app** or **Add to Home screen**.
- **Mac, Windows or Chromebook (Chrome or Edge):** open the address and click the **install** icon at the right end of the address bar.
- **Mac (Safari):** **File → Add to Dock**.

## Notes

- Each person's progress (mastery, review dates, starred passages) is saved on their own device. It is not shared or uploaded anywhere.
- Clearing the browser's website data for this address will reset that device's progress.
- The text of *The Hidden Words* and the passages in the addendum come from the Bahá’í Reference Library (bahai.org/library). Its terms allow free copying for non-commercial use, so this app should stay free.
