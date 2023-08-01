#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
YAR_VERSION=$(yarn -v)

echo "{
  \"node\": \"$NODE_VERSION\",
  \"npm\":  \"$NPM_VERSION\",
  \"yarn\":  \"$YAR_VERSION\"
}"
