---
title: Attachments come back after a restart
---

# Attachments come back after a restart

Plan [host/20261128-0534-a-sent-attachment-comes-back](../plans/host/20261128-0534-a-sent-attachment-comes-back/plan.md) puts a message's attachments back after a restart.
Run it once your dev daemon runs a build that holds the plan.

1. Open the Claude session `229a97fe-a42f-4522-b62d-ea15fac2c814` in ahpapp.
2. Scroll to a message you sent a photo or a screenshot with before 2026-11-28.
   - Pass: the picture shows on its message, and in the chat's gallery.
   - Fail: the message shows no attachment.
3. Send a new message with a picture in any Claude session, then restart the daemon.
4. Open that session again.
   - Pass: the new message shows its picture.
   - Fail: the message shows no attachment.

## Results

Not run yet.
