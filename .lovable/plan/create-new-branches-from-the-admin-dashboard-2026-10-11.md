# Create new branches from the admin dashboard

## Goal
Add a «➕ إنشاء فرع جديد» button to the admin dashboard. It creates a new branch for LE DOUX or Best Sweet with no new code: the branch page looks and works exactly like the existing branch pages, and the branch appears automatically across the system.

## What the user sees
1. In `admin-dashboard.html`, a new «إدارة الفروع» tab:
   - A form: branch name in Arabic, a short English id (suggested automatically), brand (LE DOUX / Best Sweet), order (position among buttons), and active / hidden.
   - A list of the branches I've added, with edit, hide, and delete buttons.
2. After saving:
   - **LE DOUX:** the branch button appears in `main.html` next to the Korba, Dokki, Tagamo3, and Obour buttons, in the same style.
   - **Best Sweet:** the branch button appears in `best-sweet.html` under the other branch buttons.
   - The branch page opens at `branch.html?id=<id>`. It is a copy of the brand's reference page (Korba for LE DOUX, Helwan for Best Sweet) that reads the branch name and id from the database. It handles uploading Excel files, recalling a previous order with the password check, the edit log, and the catalog in the same way.
3. The new branch is linked into the pages that list branches, based on its brand:
   - LE DOUX: `all-orders.html`, `execution-tracking.html` (adds a branch column), `range-orders.html`, `manage-uploads.html`, `compare.html`, `summary.html`, and the user-permissions screen.
   - Best Sweet: `best-sweet-all-orders.html`, `best-sweet-execution-tracking.html`, `manage-uploads-best-sweet.html`, and the user-permissions screen.

## Keeping existing pages unchanged
- The current 10 branch pages and their links stay exactly as they are. Only branches created from the new button are loaded dynamically.
- On each linked page I add one small step: after the built-in branch list loads, it adds the new branches from the database. If no branches have been added, the page behaves exactly as it does today.

## Undoing the change
- **Undo one branch:** delete or hide it from the «إدارة الفروع» tab. Its button and columns disappear, and its uploaded orders stay saved.
- **Undo the whole feature:** restore the version from before this message using the edit history in the chat (the "Restore" option on the message before it). Everything goes back to how it was.

## Technical details
- Data: the existing `branches` table (jsonb `data`): `{ id, name, brand: 'ledoux'|'bestsweet', order, active, createdAt, createdBy }`. No schema change.
- New file `public/lovable-data/branches-registry.js` exposes `BranchRegistry.list(brand)`, `.get(id)`, `.names(brand)`, and helpers that inject buttons and branch options and columns into the existing lists (`branchNames`, `<select>` options, checkbox groups, and table column arrays).
- `public/branch.html`: a generic branch page built from `korba.html` (LE DOUX) or `best-sweet-helwan.html` (Best Sweet) logic. The hard-coded `'korba'` / `BRANCH` constants are replaced by the id from the URL, and the collection is `orders` or `orders_best_sweet` by brand. It includes `edit-audit.js` with the dynamic branch.
- Branch ids are validated as unique and different from the existing ids (korba, dokki, tagamo3, obour, best_sweet_*).
- Each linked page gets a `<script src="/lovable-data/branches-registry.js">` plus a one-line hook at its branch-list definition. These are additive edits only.
- Verification: create a test branch in each brand, upload a sample Excel file, and confirm it appears in the main page, the aggregation, execution tracking, and the manage-uploads pages. Then delete the test branch.

## Points to confirm
- The «فيصل» and «جمال» Best Sweet branches are listed in the aggregation page, but no separate page file exists for them. Should they be created later using this same button?
