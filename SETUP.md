# ENB Economic & MSME Survey — Setup Guide

**Division of Commerce & Industry, East New Britain Provincial Administration**

This guide walks you through setting up the app from scratch. You only need to do this once. After setup, the app runs entirely in the browser — no server to manage.

---

## What you need

- A free [Supabase](https://supabase.com) account
- A free [GitHub](https://github.com) account
- A computer with a browser (setup only — the app itself works on phone too)

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Give it a name (e.g. `enb-msme-survey`), choose a region close to PNG (e.g. Singapore), and set a database password. Save that password somewhere safe.
4. Wait about a minute for the project to be ready.

---

## Step 2 — Run the database schema

1. In your Supabase project, go to **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase_schema.sql` from this folder and **copy all the text** inside it.
4. Paste it into the SQL Editor and click **Run** (or press Ctrl+Enter).
5. You should see "Success. No rows returned." — that means the table, policies, and storage bucket are all created.

---

## Step 3 — Get your Supabase credentials

1. In your Supabase project, go to **Project Settings** → **API**.
2. Copy two values:
   - **Project URL** — looks like `https://xxxxxxxxxxx.supabase.co`
   - **anon / public key** — a long string starting with `eyJ...`

---

## Step 4 — Add your credentials to the app

1. Open `index.html` in a text editor (Notepad works, or VS Code is better).
2. Near the bottom of the file, find these two lines:

   ```js
   const SUPABASE_URL = "YOUR_SUPABASE_URL";
   const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
   ```

3. Replace `YOUR_SUPABASE_URL` with your Project URL (keep the quotes).
4. Replace `YOUR_SUPABASE_ANON_KEY` with your anon key (keep the quotes).
5. Save the file.

---

## Step 5 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in.
2. Click the **+** button → **New repository**.
3. Name it `enb-msme-survey` (or anything you like).
4. Leave it **Public** (required for free GitHub Pages hosting).
5. Click **Create repository**.

---

## Step 6 — Upload the app files

On the new repository page, click **uploading an existing file** (or drag and drop).

Upload **all** of these files and folders:

```
index.html
app.js
manifest.json
sw.js
icons/
  icon-192.png
  icon-512.png
```

Make sure the `icons` folder goes up with its files inside it — don't upload the icons separately into the root.

Click **Commit changes**.

---

## Step 7 — Enable GitHub Pages

1. In your repository, go to **Settings** → **Pages** (in the left sidebar).
2. Under **Source**, select **Deploy from a branch**.
3. Choose branch: **main**, folder: **/ (root)**.
4. Click **Save**.
5. Wait about 60 seconds, then refresh the page. You'll see a green box with your app URL — something like:

   ```
   https://yourusername.github.io/enb-msme-survey/
   ```

6. Open that URL in your browser to confirm the app is live.

---

## Step 8 — Install on Android (PWA)

To install the app on a phone so it opens like a native app:

1. Open the app URL in **Chrome** on the Android phone.
2. Tap the **three-dot menu** (⋮) in the top right.
3. Tap **Add to Home screen**.
4. Tap **Add** to confirm.

The app will appear on the home screen with the ENB icon and open fullscreen, just like a regular app.

---

## Replacing the icon with your official ENB logo

The current icon is a placeholder (pine green circle with "ENB" text). To use the real ENB Provincial Administration logo:

1. Prepare two square PNG versions of the logo:
   - `icon-192.png` — 192×192 pixels
   - `icon-512.png` — 512×512 pixels
2. Replace the files in the `icons/` folder on GitHub (upload and overwrite).
3. The app will automatically use the new icon after the next install.

---

## Day-to-day use

| Task | How |
|------|-----|
| Fill in a survey | Tab: **New Survey** → work through steps A–G → **Save survey** |
| View all records | Tab: **Records** |
| Search records | Use the search bar and district/status filters in Records |
| Export to spreadsheet | Records → **Export CSV** → open in Excel |
| View summary stats | Tab: **Dashboard** |
| Edit a saved record | Records → **Edit** on any card |
| Delete a record | Records → **Delete** (asks for confirmation) |

---

## Troubleshooting

**"Couldn't load records — check Supabase config."**
- The Supabase URL or anon key in `index.html` is wrong. Re-check Step 4.

**App shows but no data saves**
- Make sure you ran the full `supabase_schema.sql` in Step 2.
- Check Supabase → Table Editor → `msme_surveys` exists.

**GitHub Pages shows a 404**
- Pages may still be deploying — wait 2–3 minutes and refresh.
- Make sure `index.html` is in the root of the repository (not inside a subfolder).

**Trading license upload fails**
- Go to Supabase → Storage → check the `trading-licenses` bucket exists.
- If not, re-run `supabase_schema.sql` — the storage bucket creation is included.

---

*Built for the Division of Commerce & Industry, ENB Provincial Administration.*
*Same stack as the JASCO Daily Data Collection Report app.*
