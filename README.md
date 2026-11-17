# solara-city-v3

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/moonku-ai/solara-city-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/moonku-ai/solara-city-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara City** is an open-world crime game in the browser: a sun-soaked coastal
city you can explore on foot or by car, with traffic, pedestrians, car theft,
a 1–5 star wanted level with police who chase you, three chained story
missions, and combat — all in original art, names and music, built with
three.js and zero network requests while playing.

You are a new face in Solara City. Mara Voss has work for you: run a package
to the marina, chase down a rat named Dito before he reaches the north docks,
then escape the whole Solara PD with three stars on your head. Earn cash,
stay alive, and don't get busted.

## Features

- **Open world** — a seeded grid city with towers, a central park, palm-lined
  avenues, a beach and the ocean; day cycle from morning sun to dusk, when
  windows and street lamps light up.
- **On foot and by car** — walk, run and jump, or steal any parked or traffic
  car (the owner will call the cops) and drive with arcade handling and a
  handbrake.
- **Traffic and pedestrians** — NPC cars cruise the avenues and citizens stroll
  the sidewalks; they scatter when shots are fired.
- **Wanted level + police** — 1–5 stars for theft, assault and shootings;
  patrol cars with flashing light bars ram you off the road and foot officers
  close in to arrest you. Heat cools down if you lay low.
- **Missions and story** — three chained jobs from Mara Voss with dialogue,
  a glowing objective beacon, a distance readout and payouts ($150 / $300 /
  $500). Restart any mission with R.
- **Combat** — pistol with tracer fire and muzzle flash, plus a punch up close.
- **HUD** — money, health and armor bars, clock, wanted stars, objective
  panel, live minimap and a full-screen map (M).
- **Menus and saving** — title screen, pause menu, busted / wasted screens,
  and save / continue via localStorage.
- **Original sound** — a synthwave bassline and all effects (sirens, horn,
  gunshots, cash chimes) synthesized live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse (drag) | Camera |
| Shift | Run |
| E | Enter / steal car, exit car |
| Space | Jump on foot, handbrake in car |
| Click / F | Shoot (punch up close) |
| R | Restart mission |
| M | Big map |
| P | Pause |
| H | Horn |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network needed.
`game/index.html` also accepts `?shot=start|play|chase|mission&seed=1` to
stage the title screen, street play, a police chase, or the first mission.

## Tech

- three.js r160, vendored under `game/vendor/three.min.js`
- ES modules, one clear job per file under `game/src/`
- Pure static files: the game makes no network request while playing

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
