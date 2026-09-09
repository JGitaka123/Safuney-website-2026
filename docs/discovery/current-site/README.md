# Originals from the current safuney.com

This folder is meant to hold the raw HTML, images and PDFs of the current site so that every old URL can
be 301-redirected at launch and no copy or image is lost.

**It is empty because the build environment used on 2026-09-09 could not reach `safuney.com`,
`www.safuney.com` or `web.archive.org` (outbound network policy).** The inventory in
`../current-site-inventory.md` was assembled from search-engine snippets of the site and from the
content the PO supplied in the master brief. It is flagged accordingly.

## PO: capture the site from your machine (5 minutes, PowerShell)

Run this from the repository root. It downloads every page, image and PDF that the site links to, keeping
the original paths, and writes the list of URLs.

```powershell
cd docs\discovery\current-site
winget install --id GnuWin32.Wget -e   # skip if `wget --version` already works
wget --mirror --page-requisites --adjust-extension --convert-links --no-parent `
     --wait=1 --random-wait --user-agent="Mozilla/5.0 (SafuneyRebuildCrawl)" `
     --domains=safuney.com,www.safuney.com https://safuney.com/
Get-ChildItem -Recurse -File | Select-Object -ExpandProperty FullName | Set-Content url-list.txt
cd ..\..\..
git add docs/discovery/current-site
git commit -m "docs(discovery): raw capture of current safuney.com"
git push
```

Then tell Claude "capture pushed" and the inventory will be regenerated from the real pages.
