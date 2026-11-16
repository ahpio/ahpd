---
title: What bots and push devices take commands leaves
---

- **Removing the resource paths.** `resourceRead`, `resourceWrite` and `resourceDelete` on `bot://` and `push://` stay through 0.15. Removing them is a 0.16 decision, after ahpw and ahpapp send the commands.
