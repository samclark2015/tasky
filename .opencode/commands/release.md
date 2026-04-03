---
description: Trigger a pre-release build with CalVer version
---

Trigger a pre-release build of Tasky. The workflow will compute a CalVer version (`YYYY.M.D-<commit-count>`) automatically and publish a GitHub pre-release tagged with that version.

Use the Bash tool to push the current branch to the remote, then dispatch the workflow:

```
git push
gh workflow run build-macos.yml
```

The Actions page for monitoring progress: !`echo "$(gh repo view --json url -q .url)/actions"`

After dispatching, confirm to the user and include the Actions URL above.
