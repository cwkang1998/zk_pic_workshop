FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

# Install basic build tools (for native deps if needed)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    build-essential \
  && rm -rf /var/lib/apt/lists/*
