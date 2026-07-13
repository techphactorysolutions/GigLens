# GigLens Monthly Calendar Analytics Audit

Release: 4.5.0

## Scope

Added a content-first monthly analysis section to the bottom of the Calendar tab without changing GigLens's static, local-first architecture.

## Monthly data shown

- Gross earnings
- Estimated profit
- Completed orders
- Business miles
- Work time
- Active days
- Gross per hour
- Profit per hour
- Average earnings per active day
- Estimated mileage deduction
- Earnings, profit, and order trend versus the previous month
- Best platform
- Best zone
- Strongest hour
- Top earning day
- Daily earnings chart
- Platform rankings
- Zone rankings

## Data sources

All values come from local deliveries, local settings, saved shift/break records, and screenshot timestamp estimates. No cloud analytics service, account system, or external database was added.

## Work-time rule

Saved shift time is preferred. When a day has no shift record, GigLens uses the existing screenshot-session estimate based on delivery timestamps and the 75-minute session-gap rule.

## Safety

Empty months and missing previous-month data render explanatory empty states rather than `NaN`, `Infinity`, or misleading percentages.
