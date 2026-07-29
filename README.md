# Simple Web Server

[![Security](https://github.com/this-oliver/template-js/actions/workflows/security.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/security.yaml) [![CI](https://github.com/this-oliver/template-js/actions/workflows/ci.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/ci.yaml) [![CD](https://github.com/this-oliver/template-js/actions/workflows/cd.yaml/badge.svg)](https://github.com/this-oliver/template-js/actions/workflows/cd.yaml)

The purpose of this `simple-web-server` is to act as a demo application for containerized environments.

## Getting Started

Prerequisites:

- Podman/Docker

To build the container image, run:

```bash
podman build -t simple-web-server .
```

Alternatively, you can pull the container image from the GitHub Container Regsitry (GHCR):

```bash
podman pull ghcr.io/this-oliver/simple-web-app
```

## Usage

To start the simple webserver, run:

```bash
podman run --rm -p 3000:3000 simple-web-server
```

Alternatively, you can run the simple web server directly from the GHCR:

```bash
podman run --rm -p 3000:3000 ghcr.io/this-oliver/simple-web-app
```

To reach the server, visit [http://localhost:3000](http://localhost:3000).
