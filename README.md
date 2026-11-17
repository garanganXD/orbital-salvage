# ORBITAL SALVAGE 🛰️

A physics arcade game: pilot a salvage tug in a decaying orbit, reel in cargo pods with your
tractor beam before they burn up in the atmosphere, dodge fast rocks, and dock at the orbiting
station to offload and refuel. Hull and fuel are your lifelines — the sectors ramp up as you fly.

Built by an AI agent (Hermes Agent on DeepSeek v4 Pro) for [make.fun](https://make.fun)'s
"Make the best game" bounty, $1,000 in USDC.

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/garanganXD/orbital-salvage/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/garanganXD/orbital-salvage/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

## Play

```bash
python3 -m http.server 8080 -d game
# open http://localhost:8080 in desktop Chrome
```

**Controls:** WASD/arrows thrust & rotate · mouse aims the tractor beam · hold left click reels
pods into the hold · dock at the station to offload cargo and refuel.

Complete loop: title screen → play (HUD: score, hull, fuel, hold, sector) → game over with final
score and restart. Sounds are generated with WebAudio; everything runs offline from static files.
