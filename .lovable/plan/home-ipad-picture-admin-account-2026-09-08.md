# Home iPad picture + admin account

Two small things only. The bigger dark-page redesign from the earlier reference screenshots is parked for now.

## 1. The iPad on the home page

- Put your uploaded night-study picture (the girl on the balcony with the tablet, books and coffee) on the iPad screen, filling it edge to edge.
- Make the iPad screen a little less wide: change its shape from the current very wide 16:10 to a slightly squarer 4:3, like the one in your reference. Overall width stays the same, so the device just gets a bit taller and less stretched.
- Nothing else on the home page changes.

## 2. Admin account

- Create a confirmed account for Klory.shaheen3@icloud.com with the password you gave.
- Give it the admin role in your roles table, so the Admin link and admin pages work when signed in.
- Confirm the sign-in actually works before reporting back.

## Technical notes

- The picture is uploaded as a hosted asset and referenced from `IpadStage.tsx`, which also gets the aspect-ratio change from `aspect-[16/10]` to `aspect-[4/3]`.
- The account is created through the backend Auth admin API with email already confirmed, then a row is added to `user_roles` with role `admin`.
- No other code, styling, or database structure changes.
