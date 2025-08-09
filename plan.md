Task: Brainstorm enhancements to make the player page better for Chinese learners (ideas only, no code).

High‑impact, low effort first:

Pinyin toggle: Show/hide pinyin under each line.
Meaning / translation toggle: Inline or side panel.
Tone coloring: Color syllables by tone (e.g., 1=blue, 2=green, 3=orange, 4=red, neutral=gray).
Auto‑pause at each subtitle: Playback stops when a new line starts; user presses space to continue.
[Done]Replay current line & slow playback (0.75x / 0.5x) buttons beside each subtitle line.
Click-to-copy line; clipboard confirmation.
HSK level tagging per word (color badges).
Deeper vocabulary support: 8. Word segmentation (jieba or segmenter) applied to each subtitle line with clickable tokens. 9. Hover popover: word → pinyin + definition + HSK + frequency rank. 10. “Unknown” toggle: User marks words they don’t know → highlighted across all lines. 11. Vocabulary side drawer: Aggregated list of (new | all) words for this video. 12. Export selected words to CSV / Anki (simple tab-delimited). 13. Frequency sorting: Show rare words first for targeted study.

Pronunciation & tones: 14. Tone mismatch warning: User records pronunciation (later) and compares pitch contour (stub for future). 15. Tone sandhi hints (e.g., 3rd + 3rd changes). 16. Optional tone number overlay (ni3 hao3) in a subtle monospace row.

Grammar & structure: 17. Highlight grammar patterns (把, 被, 了, 过, 着, aspect particles, modal verbs). 18. Tooltip examples: Show 1–2 alternative sentences using same pattern. 19. Classifier detection: Flag measure words (个, 条, 张) for quick review. 20. Collocation grouping: Merge multi‑character words (比如 “提高”, “交流”, “经验”) even if segmentation splits oddly.

Active learning: 21. Quick quiz mode: Hide meanings; user guesses then reveals. 22. Cloze mode: Randomly blank out 1–2 target words in upcoming lines. 23. Shadowing mode: Auto‑pause, countdown (3…2…1), resume after user repeats. 24. A/B loop selection: Drag over timeline or pick start/end from current & next line. 25. SRS seed: “Add line as card” (front: Chinese, back: pinyin + meaning).

Progress & personalization: 26. Session stats: Words seen, new words added, lines reviewed. 27. Persist known words & progress in IndexedDB keyed by videoId. 28. Difficulty heat map: Mini bar showing proportion of unknown words per line. 29. Streak indicator (days practiced). 30. Estimated comprehension % (known tokens / total tokens).

UI / UX polish: 31. Sidebar tabs: (Subtitles | Words | Grammar | Review). 32. Inline icons: speaker (replay line), snail (slow), star (add to review), plus (add note). 33. Keyboard shortcuts: J/K (prev/next line), Space (play/pause), R (replay line), S (slow toggle). 34. Smooth auto-scroll with “lock” toggle to prevent jump if user is reading earlier lines. 35. Mini progress bar inside each line showing how far through that line playback is.

Data enrichment (future backend or API): 36. Fetch multi-dictionary merges (CC-CEDICT + frequency list + HSK list). 37. Example sentence injection (1 external usage example per non-trivial word). 38. Similar words (synonyms / near-synonyms) section beneath difficult vocabulary.

Retention & review: 39. Daily “5 random words from last session” prompt on load. 40. Spaced repetition scheduling stored locally (nextDue timestamp). 41. Quick self-assessment buttons on each reviewed card (Again / Hard / Good / Easy) adjusting intervals.

Accessibility / flexibility: 42. Dark mode toggle (tailwind class). 43. Adjustable font size and line spacing for Chinese characters. 44. Toggle pinyin above vs below characters vs inline (汉字(hànzì)).

Analytics / quality: 45. Detect unusually long silence gaps—offer skipping dead time. 46. Flag overlapping or suspect timestamps for cleanup.

Prioritized phased roadmap: Phase 1 (MVP upgrades): 1,2,3,4,5,7,8,9,12 (immediate learner value, small incremental code). Phase 2: 10,11,15,18,21,24,31,33. Phase 3: 16,17,19,20,22,23,25,26,28,30. Phase 4: 32,34,35,36,37,38,39,40,41. Phase 5 (advanced / ML): 14,45,46 + pronunciation comparison.

Data model additions (IndexedDB augment):

wordStore: { id (word), pinyin, hskLevel, freqRank, known:boolean, addedAt }
lineStore: { videoId, start, end, text, tokens:[{w, known:boolean}] }
srsStore: { wordId, dueAt, interval, easeFactor, reviewHistory[] }
Low risk quick wins to implement next (suggested order):

Tokenization + hover popovers (foundation for many features).
Pinyin / meaning toggles & tone coloring.
Auto-pause per line + replay & slow buttons.
Word list panel with export.
Known / unknown tracking & highlight.
Let me know which subset you want to implement first and I can produce a focused implementation plan.