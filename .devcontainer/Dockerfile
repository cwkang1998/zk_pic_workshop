FROM mcr.microsoft.com/devcontainers/javascript-node:24

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    xz-utils \
  && rm -rf /var/lib/apt/lists/*

ARG USERNAME=node
ARG USER_HOME=/home/${USERNAME}
ARG NOIR_VERSION=1.0.0-beta.18
ARG BB_VERSION=3.0.0-nightly.20260102

USER ${USERNAME}

ENV PATH=${USER_HOME}/.nargo/bin:${USER_HOME}/.bb:${PATH}

RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
RUN /bin/bash -lc "/home/node/.nargo/bin/noirup -v ${NOIR_VERSION}"

RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
RUN /bin/bash -lc "/home/node/.bb/bbup -v ${BB_VERSION}"
RUN /bin/bash -lc "echo 'export PATH=${USER_HOME}/.nargo/bin:${USER_HOME}/.bb:${PATH}' >> ${USER_HOME}/.bashrc"
