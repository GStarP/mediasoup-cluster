# @mc/server

![](https://img.shields.io/badge/status-working-green)

[mediasoup](https://github.com/versatica/mediasoup) is a wonderful audio-video lib, but it does not provide cluster capability by default.

This project aims to provide horizental scaling ability for mediasoup.

Many design and knowledge come from [owt-server](https://github.com/open-webrtc-toolkit/owt-server).

## Mediasoup build fails due to network

First, try to use proxy.

If build still fails, download prebuild mannually and move it to `node_modules/mediasoup/out/Release`.
