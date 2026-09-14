# Putting Excel Trainer on your iPhone

No App Store, no review, no waiting. Three routes, and the first one is almost
certainly the one you want.

## Which route

| | A. Home screen web app | B. Native app, free Apple ID | C. Native app, paid account |
|---|---|---|---|
| **Cost** | free | free | $99 / year |
| **Mac needed** | no | yes (Xcode) | yes (Xcode) |
| **Expires** | **never** | **every 7 days** | after 1 year |
| **Time to set up** | ~10 minutes | ~30 minutes | ~30 minutes |
| **Works offline** | yes, after the first load | yes, immediately | yes |
| **Looks like an app** | yes: own icon, no Safari bars | yes | yes |
| **Hosting needed** | yes (GitHub Pages, free) | no | no |
| **Updating it** | push to the repo, relaunch | rebuild in Xcode | rebuild in Xcode |

Everything the trainer does — the spreadsheet, the pivot builder, the filters,
the marking, saving your progress — runs inside the page with no server behind
it. That is why route A is not a compromise: it is the same app.

**Take route A.** Take route B only if you want the app installed without any
hosting at all, or you intend to add genuinely native things later (Face ID,
notifications, Shortcuts, files in iCloud Drive).

---

# Route A — home screen web app (recommended)

## A1. Turn on GitHub Pages, once

1. Open `https://github.com/Sheeshlove/excel_test_YnP/settings/pages`
2. **Build and deployment → Source** → choose **GitHub Actions**
3. That is it. There is nothing to configure.

The repository is public, so Pages is free. (On a private repository Pages needs
a paid plan — either make the repo public, or use Cloudflare Pages or Netlify,
both of which serve private repositories free. Any HTTPS host works; the app is
a folder of static files.)

## A2. Push the branch

```bash
git checkout claude/iphone-app
git push -u origin claude/iphone-app
```

The workflow in `.github/workflows/pages.yml` runs on every push that touches
`app/`. Watch it under the **Actions** tab; it takes about a minute.

When it is green, the app is live at:

```
https://sheeshlove.github.io/excel_test_YnP/
```

Open that on your Mac first to confirm it works.

## A3. Install it on the iPhone

1. Open that URL **in Safari** on the iPhone. It has to be Safari — that is
   where "Add to Home Screen" lives.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down, tap **Add to Home Screen**.
4. The name is already filled in as "Excel Trainer". Tap **Add**.

You now have an icon on the home screen. Launch it from there: it opens
full-screen with no address bar and no tabs, has its own app switcher card, and
keeps its own storage separate from Safari.

## A4. Check it works offline

Open the app once with a connection so the service worker can cache it, then
turn on Airplane Mode and launch it again. Everything should still work — the
whole trainer is about 400 KB and lives on the phone after the first visit.

## A5. Updating it later

```bash
git push          # from the repo
```

Pages redeploys, and the phone picks the new version up the next time it is
launched with a connection. If it seems stale, the service worker is holding the
old copy: bump `CACHE` at the top of `app/sw.js` (`excel-trainer-v1` →
`v2`) and push again. That is the switch that forces every device to refetch.

## A6. About your progress on the phone

Progress lives in the web app's own storage, which is separate from Safari's and
survives closing the app. Two things to know:

* Deleting the home screen icon deletes the storage with it.
* iOS can clear the storage of a web app that has not been opened for a very
  long time.

So before anything important, use **Progress → Save progress to a file**. On iOS
that lands in Files, and **Load from a file** reads it back — which is also how
you move progress between the Mac and the phone.

---

# Route B — native app with a free Apple ID

You get a real `.app` installed on the device, with no hosting anywhere. The
catch is that Apple gives free accounts a **7-day** signing certificate, so the
app stops launching after a week until you rebuild it. It takes two minutes to
refresh, but you have to remember.

## B1. What you need

* A Mac with **Xcode** (free, from the Mac App Store — it is a large download)
* An **Apple ID** — the ordinary one you already have, no payment
* A Lightning/USB-C cable for the first install

## B2. Prepare the web assets

```bash
cd excel_test_YnP
./ios/sync-web.sh
```

This copies `app/` into `ios/Web/`, which is what gets bundled into the app.
Run it again whenever you change the trainer.

## B3. Create the project in Xcode

1. **Xcode → File → New → Project…**
2. Choose **iOS → App**, press Next.
3. Fill in:
   * **Product Name**: `ExcelTrainer`
   * **Team**: your Apple ID (**Add an Account…** if the list is empty — sign in
     with your ordinary Apple ID)
   * **Organization Identifier**: `com.yourname` — anything unique, it is not
     published anywhere
   * **Interface**: **SwiftUI**
   * **Language**: **Swift**
   * Leave the test checkboxes unticked
4. Save it anywhere, for example next to the repository.

## B4. Drop in the two pieces

**The code.** In the Xcode file list, open `ContentView.swift`, select
everything, and paste in the contents of `ios/ContentView.swift` from this
repository. That single file is the whole app.

**The web assets.** Drag the `ios/Web` folder from Finder into the Xcode file
list, and in the dialog that appears:

* tick **Copy items if needed**
* choose **Create folder references** — this is the important one. The folder
  must end up **blue** in the file list, not yellow. A yellow group flattens the
  directory structure and the app will not find `css/app.css`.
* tick your `ExcelTrainer` target

## B5. Run it on the phone

1. Plug the iPhone in. Unlock it and tap **Trust** if asked.
2. In the toolbar at the top of Xcode, pick your iPhone as the destination
   (instead of a simulator).
3. Press **▶ Run** (⌘R).
4. The first build fails on the device with *"Untrusted Developer"*. That is
   expected. On the iPhone: **Settings → General → VPN & Device Management →**
   your Apple ID **→ Trust**.
5. Press ▶ again.

The app is now on the home screen, works with no network, and needs no server.

## B6. Every 7 days

The signing certificate expires and the app refuses to launch. To refresh it:
plug the phone in, press ▶ in Xcode again. Nothing is lost — the app's storage,
and therefore your progress, survives a reinstall over the top.

If a weekly cable ritual annoys you, **AltStore** or **Sideloadly** can refresh
the signature over Wi-Fi automatically. They use the same free Apple ID
underneath and the same 7-day rule; they just do the refreshing for you.

Free accounts also allow only about three self-signed apps on a device at once.

---

# Route C — native app with the Apple Developer Program

Identical to route B, except that after paying $99/year:

* the certificate lasts **a year** instead of a week;
* you can install through **TestFlight** with no cable at all (each build stays
  valid for 90 days);
* ad-hoc distribution covers up to 100 devices.

Worth it if you end up building several apps. For one personal trainer it is
not.

---

# What is different on the phone

The trainer is meant to be driven from the keyboard, and a phone has none, so
the touch build replaces the shortcuts with buttons:

| On a Mac | On the iPhone |
|---|---|
| `⌘D` fill down | **Fill ↓** — one tap runs the formula to the end of the answer block |
| `⌘R` fill right | **Fill →** |
| `⌘T` cycle `$` | **$** — cycles `B8 → $B$8 → B$8 → $B8` in whatever you are typing |
| `⌘⇧F` filter | **Filter**, then the ▾ arrows on the headers |
| `⌘Z` undo | **↶** |
| `F2` edit a cell | **Edit**, or double-tap the cell |

While you are typing, a strip appears above the keyboard with the characters iOS
buries three taps deep — `= $ : , ( ) " & > <` — plus one-tap stubs for `SUM(`,
`IF(`, `SUMIFS(`, `VLOOKUP(`, `INDEX(`, `MATCH(` and `SUBTOTAL(9,`.

The question folds away with the ▴ button in its corner, which hands the whole
screen to the spreadsheet. The four sections live in a tab bar along the bottom.

A Bluetooth or Magic Keyboard works too, and then all the real shortcuts come
back — which makes an iPad with a keyboard a genuinely good way to practise.

---

# If something goes wrong

**"Add to Home Screen" is missing.** You are not in Safari, or you are in a
Private tab. Open the page in a normal Safari tab.

**The app opens in Safari with an address bar instead of full-screen.** It was
added from the browser's own bookmark rather than the site. Delete the icon and
add it again from the Share sheet.

**It does not work offline.** The service worker needs HTTPS. It will not
register over plain `http://` on a local network, and it will not register from
a file. Use the Pages URL.

**Changes are not showing up.** Bump `CACHE` in `app/sw.js` and push.

**Xcode: "Failed to register bundle identifier".** Your Organization Identifier
is already in use. Change it to something more unique.

**Xcode: the app shows a blank dark screen.** The `Web` folder went in as a
yellow group instead of a blue folder reference. Delete it from the project and
drag it in again with **Create folder references** selected.

**The app expired after a week.** Free Apple ID. Plug in, press ▶ in Xcode.
