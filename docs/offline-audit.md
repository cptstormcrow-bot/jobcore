
### 218 - Instructions URL on price-sheet tasks
- New optional `service_tasks.instructions_url` (migration 0137, drafted, NOT pushed) plus the `price_sheet_lookup()` RPC returns it so techs can read it.
- Admin edits it in Add Task #0071, Price Sheet Editor #0020 and the Tasks dropdown on Job Details #0041; techs see a tappable read-only "Instructions" link. Tap uses `Linking.openURL` (device browser/PDF viewer/video app).
- Saves go through `service_task.update` / `service_task.create` write-through, so offline queues and retries like every other price-sheet edit. Before 0137 is live the column write is rejected by the server and the queue retries.
- Tasks dropdown fields share one label column width so inputs line up; order is Quantity, URL, SKU, Notes, Fixed Labor.
