# Blackglass character actions QA

## Blackglass Dock compatibility, version 0.3.4

Date: 2026-10-16. Isolated `deadline-test`, Foundry 12.331 / Cyberpunk RED Core 0.92.4, with REDLINE COMBAT 0.3.0. The first displayed Blackglass Dock concept is implemented by REDLINE itself. Night City UI detects its outer class/data marker, clears legacy presentation classes and injected toggles, and excludes it from legacy sizing/visibility CSS. Older REDLINE versions retain their existing adapter. DEADLINE styles were not changed.

Source visual truth, real browser screenshots, full-view and focused combined inputs, required fidelity surfaces and the three resolved P1/P2 iterations are recorded in the [REDLINE project-root design QA](https://github.com/Defaulter444/CPR-RED-COMBAT/blob/main/design-qa.md). Source and final desktop captures are both 1672 × 941 pixels / CSS pixels at 1×. Actual browser evidence is in [docs/blackglass](https://github.com/Defaulter444/CPR-RED-COMBAT/tree/main/docs/blackglass); the source and implementation were inspected together, not inferred from code.

GM and Player checks covered 1672 × 941, 1280 × 720 and 1024 × 768; the latter two included restricted player controls, a native attack dialog and cancellation without ammo loss. At 1024, REDLINE's own skills disclosure fits the map gap; with an expanded DEADLINE it temporarily overlays the dock while leaving queue and macros free. An active collapsed timer ends at y112 and the queue starts at y124; expanded timer ends at y223.72 and queue starts at y236; pausing restores queue y60. NCU disable/re-enable, common theme off/on and REDLINE's standalone header were exercised. One native collapse control remains, with 57 px idle compact dock. Final browser error logs were empty.

59 Night City UI tests and 93 REDLINE tests passed, including legacy exclusion and stale adapter cleanup. No actionable P0/P1/P2 remains in this scope. Residual P3: armor labels can be spaced more like the concept; the empty REDLINE prompt does not change height on collapse. Live sidebar collapse, mobile widths below 1024 px and arbitrary third-party combinations are not claimed. Production worlds were not changed.

final result: passed

## Navigation corrections, version 0.3.3

Date: 2026-10-16. Isolated deadline-test world, Foundry 12.331 / Cyberpunk RED Core v0.92.4, GM and Player clients at 1280 × 720. More's button bounds were x794.5–869.16, y2.5–44.5; the opened menu began at x794.5, y50.5 (6 px below its button), within the viewport. The previous menu was detached at x938 despite the button ending at x843.16. Demo entries and the duplicate scene tool were absent.

Agent ArrowDown focused the GM console entry at x301.64, y50.5; Escape closed it and restored focus without reopening. The console opened from the new entry, while the normal Agent button still opened the personal device. Opening Agent's disclosure closed More. The separate Player client had no GM disclosure or visible console action, including after ArrowDown on Agent. Its More menu contained only permitted actions. No browser errors were observed in these checks.

56 automated checks passed, including viewport positioning, resize/scroll behavior, hover/focus/touch events, permission loss, listener cleanup and preservation of scrolling inside long menus. Other viewport dimensions and pointer timing are covered by automated controller tests; this live pass used 1280 × 720. Production worlds were not changed.

## Atlas access follow-up, version 0.3.2

Date: 2026-10-16. Foundry VTT 12.331, Cyberpunk RED Core v0.92.4, isolated deadline-test world, 1280 × 720. The GM enabled player access to Atlas 0.2.0; a separate Player session opened the map through the City navigation button. Revoking access closed the player's Atlas and removed the City button without reloading. Re-enabling restored access. Both sessions were reloaded to verify persistence. Browser error logs were empty at the final check. Night City UI: 36 passing tests, including 7 access checks. The production campaign was not changed. The earlier combat QA below remains specific to version 0.3.1.

Date: 2026-10-16. Night City UI 0.3.1 with REDLINE COMBAT 0.2.0.
Result: passed for the tested scope below; release candidate verified before publication.

Environment: licensed Foundry VTT 12.331, Cyberpunk RED Core v0.92.4, isolated disposable deadline-test world, loopback port 30001. No production campaign was changed. An offline snapshot of the test world and module backups were taken before installation.

## Visual scope

Actual browser review at 1440 × 900 and 1024 × 768. Blackglass retained. Compact card 80 px high; expanded actions request 340 px and are limited by available space. At 1024 × 768 the expanded card measured 638 × 276 px, ending at y=658; hotbar starts at y=668. No page horizontal overflow. Weapons and skills are reachable through vertical scrolling. The collapse control remains reachable at the bottom of the scroll and was used successfully at both widths.

Evidence: five real screenshots in the separate night-city-character-actions deliverable. No generated mockup is used as runtime evidence. The map is a separate test-scene asset and is not bundled.

## Live functional scope

Tested as Player owning «Тест — Ви», then returned to Gamemaster:

- Cancelling an attack preserves ammunition; ordinary rifle attack 9 → 8, native chat card produced.
- Autofire disabled below 10 rounds with an explanatory tooltip.
- Reload with zero reserve does not create ammunition. For this test only, native inventory reserve set to 40. Reload filled 8 → 25 and reserve became 23, verified in native ammunition chooser.
- Autofire 25 → 15. Native autofire damage card 2d6 × 1 produced 8, without another ammunition charge or HP change.
- Evasion and Athletics opened native modifier dialogs and produced native skill cards. Athletics remained selected after refresh, roll and initiative.
- Initiative rolled 8 and updated native combat order, while keeping the current combatant unchanged.
- Aimed attack opened native hit-location dialog; cancelling preserved the magazine. Suppressive mode disables separate damage.
- Player cannot select other actors for control or advance the turn. Death save disabled while HP > 0.
- Final UI: rifle 15/25, pistol 6/8, HP unchanged at 10/40. Native browser error log empty in final player/GM checks.

## Automated checks and limits

REDLINE: 76 passing tests (actions, view, state projection). Night City UI: 29 passing tests. Zero failures or skips. Node syntax checks passed for all 9 scripts. Filesystem isolation audit passed for scratch runtime/data roots, world, port and runtime version.

Integration uses public CPR factories, modifier dialogs, item ammunition methods and chat rendering. Ranged attack awaits dischargeItem exactly once because CPR 0.92.4 confirmRoll does not await that write. No system files or global prototypes were patched. Selection/permission/item validation repeats after a roll dialog; local busy guard prevents duplicate clicks.

Limits: this exact build targets CPR 0.92.4. Death-save success and melee branches are covered with unit fixtures, not an additional live injury/melee scenario. Cross-client simultaneous edits follow native Foundry/CPR behavior; no transactions or remote defense requests are added. Native ammo selection owns its dialog and stays attached to the original weapon. Mobile layouts below 1024 px and arbitrary third-party combinations are not claimed. This QA pass did not include a production rollout. Release metadata and distribution files are handled separately.
