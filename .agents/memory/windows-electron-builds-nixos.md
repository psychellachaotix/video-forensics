---
name: Windows Electron builds on NixOS
description: Reproducible fallback when electron-builder Windows packaging helpers cannot execute in the Replit Nix environment.
---

Use electron-builder to create the Windows unpacked application and portable EXE, but expect its downloaded Linux `7za` helper or Wine step to be incompatible with the Nix dynamic loader. Use the Nix `p7zip` binary for portable compression. When Wine cannot execute the 32-bit NSIS bootstrap, build the installer from the verified `win-unpacked` directory with native Nix `makensis`.

**Why:** The Nix Wine package may expose a 32-bit executable the host cannot load, while `wine64` cannot run the required NSIS loader. Electron-builder's downloaded `7za` can fail for the same loader reason. Both failures happen after a valid Windows unpacked app has already been produced.

**How to apply:** Keep Windows CI as the canonical reproducible builder. For a local Replit deliverable, verify the unpacked PE executable and bundled resources first, substitute the system `7za` only in temporary builder cache, then use the versioned NSIS script to produce the installer without Wine.