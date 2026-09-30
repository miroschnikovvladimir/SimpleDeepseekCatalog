# Creating and publishing catalog stories

Follow [STORY_WORKFLOW.md](STORY_WORKFLOW.md) for stories authored in this chat.
A completed catalog story includes publication and verification on the public
site used by Telegram, unless the user explicitly asks for a draft or asks to
delay publication. Brainstorming and unfinished writing remain drafts.

Do not stop at a local preview, generated index, commit, push, or successful
deployment. Verify the expected deployed commit and the public story files.
Report public links and actual validation results. If publication fails, retain
the files, diagnose the failure and clearly report the incomplete publication.

Use author «Администрация» for administration-authored stories. Never rewrite
community authors. Generate images with clear composition and recognizable
forms; avoid high frequency artificial detail. Preserve unregistered drafts,
unrelated changes, personal data and already started games.

Mini App routing must accept Telegram launch fragments as a catalog entry, keep
explicit story links working and preserve a real missing-story state. Any reply
keyboard containing the catalog Web App button must not be one-time; users must
still be able to hide it manually. Test the deployed site with a synthetic
Telegram launch fragment and a phone-sized viewport. Do not claim this proves
physical Android/iOS client behavior.

Bot restarts follow the root AGENTS.md and the Task Scheduler restart skill.
