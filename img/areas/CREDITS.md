# Area header photos: sources and licences

These photos appear, blurred, behind the header of the booking site (eatearlybird.com/book). There is one photo per city we serve. Each file here is a resized (1600 px wide), blurred copy that we host ourselves. Nothing is hotlinked. A city without a photo gets a plain colour background.

| File | City | Original | Author | Licence | Downloaded |
|---|---|---|---|---|---|
| `new-york.jpg` | New York | [Manhattan Skyline from Weehawken 078.jpg](https://commons.wikimedia.org/wiki/File:Manhattan_Skyline_from_Weehawken_078.jpg) (Wikimedia Commons, taken 27 Aug 2024) | Kidfly182 | [CC0 1.0 (public domain dedication)](https://creativecommons.org/publicdomain/zero/1.0/) | 21 Nov 2026, 1920 px Commons thumbnail |
| `los-angeles.jpg` | Los Angeles | [SkylineFromThe101LookingWest-Winter.jpg](https://commons.wikimedia.org/wiki/File:SkylineFromThe101LookingWest-Winter.jpg) (Wikimedia Commons, taken 9 Jan 2019) | Michael Chusid | [CC0 1.0 (public domain dedication)](https://creativecommons.org/publicdomain/zero/1.0/) | 21 Nov 2026, 1920 px Commons thumbnail |

CC0 needs no credit. We name the authors anyway, and the site shows a small "Photo: <author>, CC0" note under the header.

To add a city:
1. Use only photos we're allowed to use: CC0 or public domain, CC BY with the credit shown, or the Unsplash licence. Don't take images from search results or other websites.
2. Save a 1600 px wide copy with a Gaussian blur of about 6 px as `img/areas/<city slug>.jpg`.
3. Add a row to this file.
4. Add the slug, author and licence to `AREA_PHOTOS` in `book/app.js`.
