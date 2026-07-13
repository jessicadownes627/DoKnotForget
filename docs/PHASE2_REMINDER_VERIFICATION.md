# Phase 2 Reminder Verification

Phase 2 verification covers the reminder resolution behaviors that now depend on the V2 relationship engine.

Run with:

```bash
npm run validate:phase2-reminders
```

Verified scenarios:

| Scenario | Reminder wording | Recipient | Text target | eCard target | Coffee | Gift | Notification title |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Direct friend birthday | `Ryan turns 36 today` | `Ryan` | `Ryan` | `Ryan` | Yes | No | `Ryan turns 36 today` |
| My child's birthday | `Sam turns 7 today` | `Alex` | `Alex about Sam` | `Alex about Sam` | No | No | `Sam turns 7 today` |
| Friend's child's birthday | `Jane turns 7 today` | `Ashley` | `Ashley about Jane` | `Ashley about Jane` | No | No | `Jane turns 7 today` |
| Parent birthday | `Mom turns 66 today` | `Mom` | `Mom` | `Mom` | Yes | No | `Mom turns 66 today` |
| Partner birthday | `Ben turns 38 today` | `Ben` | `Ben` | `Ben` | Yes | No | `Ben turns 38 today` |
| Anniversary | `Ben & J’s anniversary today` | `J` | `J` | `J` | Yes | No | `Ben & J’s anniversary today` |
| Standalone person with no relationship | `Taylor turns 34 today` | `Taylor` | `Taylor` | `Taylor` | Yes | No | `Taylor turns 34 today` |
| Embedded legacy child | `Anthony turns 7 today` | `Jessica` | `Jessica about Anthony` | `Jessica about Anthony` | No | No | `Anthony turns 7 today` |
| V2 graph child | `Jane turns 7 today` | `Ashley` | `Ashley about Jane` | `Ashley about Jane` | No | No | `Jane turns 7 today` |
| Person with unknown relationship context | `Morgan turns 31 today` | `Morgan` | `Morgan` | `Morgan` | Yes | No | `Morgan turns 31 today` |

Notes:

- Child-related reminders remain non-coffee and non-gift actions in the day-of flow. They prioritize reaching out to the resolved recipient.
- Embedded legacy children still preserve `child.parents` fallback contacts when present.
- Notification body remains intentionally generic:
  - `Don’t forget to send a quick message or plan something thoughtful.`
- Phase 2 changes notification titles to use the same V2-aware reminder wording used by Home, so anniversary and child-related reminders no longer flatten back to legacy raw labels.
