# CivicTrack: demo video script (target 3:45, hard limit 5:00)

Every beat below is something the app really does. Nothing relies on slides.

## Before recording

1. **Reset the data.** Open `/about`, scroll to **Demo controls**, enter the reset token (the `RESET_TOKEN` env var on Vercel) and press **Reset demo data**. Then reload.
2. **Check the server** at `/api/health`. It should show `"mode":"db"` and 16 projects.
3. **Set up the browser:** 1920×1080 window at 110–125% zoom, extra tabs closed, bookmarks bar hidden.
4. **Start in the Resident view** (header toggle).
5. **Map tiles:** if they fail on the venue Wi-Fi, carry on. Roads still draw, and every beat works from the lists.
6. **Placeholder names:** "Lakeview Rd" is the seed placeholder. If D renamed it to a real street, read that name instead. The numbers stay the same.

## Script

| Time      | Screen                            | What to do                                                                                                                   | Say (roughly)                                                                                                                                                                                                                                                                                                                                                          |
| --------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Registry `/`                      | Show the banner and the map                                                                                                  | "Roads in our cities get dug up again and again by different departments, often weeks after they were resurfaced. Residents can't tell who is digging, why, or until when. This is CivicTrack: one register of public works, checked before anyone digs."                                                                                                              |
| 0:20–0:50 | Registry                          | Set **Road → Lakeview Rd**. Point at the table. Click **P03 Storm-water drain repair**                                       | "As a resident I pick my street and see every work, who is responsible and until when."                                                                                                                                                                                                                                                                                |
| 0:50–1:10 | `/projects/P03`                   | Point at **Overdue 5 days** and the **History**                                                                              | "This drain is 5 days overdue. Every date change has a public reason here: 'monsoon rain flooded the trench'. Deadlines can't slip silently any more."                                                                                                                                                                                                                 |
| 1:10–1:25 | Header                            | Switch to **Officer**. Open **Propose work**, press **Fill in demo example**                                                 | "Now I'm the Power Utility, planning a cable on 500–1000 m of the same road, 25 October to 5 November."                                                                                                                                                                                                                                                                |
| 1:25–2:10 | `/propose`                        | Wait for the two flags. Point at the red stretch on the map and the timeline                                                 | "Before anything is saved, CivicTrack flags two problems, and says exactly why. One: this stretch was resurfaced 66 days earlier, inside the one-year protection window. Two: the Water Board is digging 200 m of it on 3–5 November. Every flag shows the metres, the days, a confidence level and its caveats. It never accuses anyone; it asks for a human review." |
| 2:10–2:35 | `/propose`                        | Click **Join P02's window (3–20 Nov)**                                                                                       | "One click aligns us with the Water Board: one trench instead of two. That flag turns blue: coordinated."                                                                                                                                                                                                                                                              |
| 2:35–2:55 | `/propose`                        | Point at **Earliest start with no open flags on this stretch: 21 Aug 2027**. Type a justification and **Submit to register** | "For the resurfaced road, CivicTrack shows when the protection ends. If we must go ahead now, a written justification is required and goes into the public history."                                                                                                                                                                                                   |
| 2:55–3:15 | `/coordination`                   | Show the new flags. Press **Acknowledge** on one with a note                                                                 | "Officers see every possible conflict across the ward, with filters, and record their review publicly."                                                                                                                                                                                                                                                                |
| 3:15–3:35 | Resident view, `/projects/P03`    | Add a report: **No work seen**, "No work seen for 10 days." Reload                                                           | "Residents can report problems on the exact project. The report stays, so the department can't miss it."                                                                                                                                                                                                                                                               |
| 3:35–3:50 | GitHub: README or the green build | Show the passing tests and the "How it works" link                                                                           | "The rules are deterministic and covered by tests, which run on every deploy, so a broken rule can't ship."                                                                                                                                                                                                                                                            |
| 3:50–4:00 | Registry                          | End on the map                                                                                                               | "CivicTrack: check before you dig, explain when you're late."                                                                                                                                                                                                                                                                                                          |

## If something goes wrong while recording

- **A flag shows unexpected extra items:** someone added a test work. Reset (step 1) and record again.
- **A page shows "offline demo mode" or saving fails:** the database is unreachable. Record anyway in memory mode, and don't say changes are stored permanently.
- **The map is blank:** say "the map is display-only; the flags come from the register" and carry on.

## After recording

- **Export:** 720p or 1080p H.264, under 25 MB. For example:
  ```
  ffmpeg -i raw.mp4 -vf scale=-2:720 -c:v libx264 -crf 28 -c:a aac -b:a 96k demo/civictrack-demo.mp4
  ```
- **Commit** it to `demo/`. Upload an unlisted backup and put both links in the README.
- **Reset the data again** so judges see the clean seed.
